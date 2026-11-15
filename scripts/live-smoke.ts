/**
 * Minimal opt-in live OpenAI smoke test (exactly 3 provider calls).
 *
 * End-to-end path (must not silently substitute fixtures for success):
 *   A. extract architecture from V01 NL
 *   B. extract scenario from V01 question against architecture from A (fallback: formal if A failed)
 *   C. if B OK → simulate(extractedArch|formal, extractedScenario) → explain
 *      if B fails → mark E2E FAILED; optional independent baseline diagnostic only
 *
 * Hard cap: MAX_PROVIDER_REQUESTS = 3.
 * Never invoked by `npm test`. No persistence.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { architectureDocumentSchema } from '../src/architecture/domain/schema';
import type { ArchitectureDocument } from '../src/architecture/domain/types';
import { loadLlmConfig } from '../src/llm/config';
import { explainSimulationResult } from '../src/llm/explanation/explain-result';
import { extractArchitecture } from '../src/llm/extraction/extract-architecture';
import { extractScenario } from '../src/llm/extraction/extract-scenario';
import { createLlmProvider } from '../src/llm/provider/create-provider';
import type { LlmProvider } from '../src/llm/provider/llm-provider';
import type { StructuredParseRequest } from '../src/llm/provider/llm-provider';
import {
  clearUsageRecords,
  getUsageRecords,
  projectCostPer1000Analyses,
} from '../src/llm/usage/usage-recorder';
import { sanitizeForLog } from '../src/llm/errors';
import { simulate } from '../src/simulation/simulate';
import type { Scenario } from '../src/simulation/domain/scenario';
import type { z } from 'zod';

const MAX_PROVIDER_REQUESTS = 3;
const FIXTURE = 'V01_capacity_sum';

function assertLiveEnabled(): void {
  if (process.env['RUN_LIVE_OPENAI'] !== '1') {
    process.stderr.write(
      'Refusing: set RUN_LIVE_OPENAI=1 to opt in to live OpenAI calls.\n',
    );
    process.exit(2);
  }
  if (!process.env['OPENAI_API_KEY']?.trim()) {
    process.stderr.write(
      'OPENAI_API_KEY is required (from env / --env-file=.env).\n',
    );
    process.exit(2);
  }
}

function withRequestCap(inner: LlmProvider): LlmProvider {
  let started = 0;
  return {
    name: inner.name,
    async parseStructured<T extends z.ZodType>(
      request: StructuredParseRequest<T>,
    ) {
      started += 1;
      if (started > MAX_PROVIDER_REQUESTS) {
        throw new Error(
          `Live smoke aborted: exceeded MAX_PROVIDER_REQUESTS=${MAX_PROVIDER_REQUESTS}`,
        );
      }
      process.stdout.write(
        `[live-smoke] provider call ${started}/${MAX_PROVIDER_REQUESTS}: ${request.operation}\n`,
      );
      return inner.parseStructured(request);
    },
  };
}

function line(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

async function main(): Promise<void> {
  assertLiveEnabled();
  clearUsageRecords();

  const config = loadLlmConfig({
    ...process.env,
    LLM_PROVIDER: 'openai',
  });

  line('=== Live smoke (controlled) ===');
  line(`model: ${config.openaiModel}`);
  line(`timeoutMs: ${config.openaiTimeoutMs}`);
  line(`maxProviderRequests: ${MAX_PROVIDER_REQUESTS}`);
  line(`fixture: tests/validation/${FIXTURE}`);
  line('persist: none');
  line('');

  const provider = withRequestCap(createLlmProvider(config));
  const dir = join(process.cwd(), 'tests', 'validation', FIXTURE);
  const nl = readFileSync(join(dir, 'architecture_nl.md'), 'utf8');
  const question = readFileSync(join(dir, 'scenario_nl.md'), 'utf8');
  const formal = architectureDocumentSchema.parse(
    JSON.parse(readFileSync(join(dir, 'formal_model.json'), 'utf8')),
  );
  const expectedScenario = JSON.parse(
    readFileSync(join(dir, 'expected_scenario.json'), 'utf8'),
  ) as Scenario;

  let e2eOk = true;
  const diagnostics: string[] = [];

  // A — architecture extraction
  const arch = await extractArchitecture({
    architectureText: nl,
    provider,
    config,
  });
  line(`A extractArchitecture: ${arch.status}`);
  if (arch.status === 'EXTRACTION_FAILED') {
    e2eOk = false;
    diagnostics.push(`A_ERROR:${arch.errorClass}`);
    line(`  errorClass: ${arch.errorClass}`);
    line(`  message: ${sanitizeForLog(arch.message)}`);
  } else {
    diagnostics.push('A_PROPOSED');
    line(
      `  nodes=${arch.document.nodes.length} findings=${arch.findings.length} canPersist=${arch.canPersist}`,
    );
    const findingCodes = [
      ...new Set(arch.findings.map((f) => f.code)),
    ].sort();
    if (findingCodes.length > 0) {
      line(`  findingCodes: ${findingCodes.join(',')}`);
    }
  }

  const architectureForB: ArchitectureDocument =
    arch.status === 'PROPOSED' ? arch.document : formal;
  if (arch.status !== 'PROPOSED') {
    line(
      '  note: scenario extraction will use formal fixture model (A failed)',
    );
  }

  // B — scenario extraction against architecture from A when available
  const scen = await extractScenario({
    question,
    architecture: architectureForB,
    provider,
    config,
  });
  line(`B extractScenario: ${scen.status}`);
  diagnostics.push(`B_${scen.status}`);
  if (scen.status === 'OK') {
    line(`  scenarioIntent: ${scen.scenario.type}`);
    line(`  scenario: ${JSON.stringify(scen.scenario)}`);
    line(`  fixtureExpected: ${JSON.stringify(expectedScenario)}`);
  } else if (scen.status === 'FAILED') {
    e2eOk = false;
    line(`  errorClass: ${scen.errorClass}`);
    line(`  message: ${sanitizeForLog(scen.message)}`);
  } else {
    e2eOk = false;
    line(`  reason: ${sanitizeForLog(scen.reason)}`);
    if (scen.status === 'NEEDS_CLARIFICATION') {
      line(
        `  clarificationCount: ${scen.clarificationQuestions.length}`,
      );
    }
  }

  // C — only run live explain on the true E2E path when B succeeded
  if (scen.status === 'OK' && arch.status === 'PROPOSED') {
    const sim = simulate(arch.document, scen.scenario);
    line(
      `C e2e simulate: status=${sim.status} metrics=${sim.metrics.length} refused=${sim.refused.length}`,
    );
    diagnostics.push(`C_SIM_${sim.status}`);

    const explained = await explainSimulationResult({
      result: sim,
      provider,
      config,
    });
    line(
      `C e2e explain: source=${explained.source} fallback=${explained.source === 'deterministic_fallback'}`,
    );
    diagnostics.push(`C_EXPLAIN_${explained.source}`);
    if (explained.errorClass) {
      line(`  explainErrorClass: ${explained.errorClass}`);
    }
    if (explained.validationErrors && explained.validationErrors.length > 0) {
      line(
        `  explainRejectionReasons: ${explained.validationErrors.map((r) => sanitizeForLog(r)).join(' | ')}`,
      );
      e2eOk = false;
    }
    if (explained.source === 'deterministic_fallback') {
      e2eOk = false;
    }
  } else {
    e2eOk = false;
    line(
      'C e2e simulate+explain: SKIPPED — end-to-end requires A=PROPOSED and B=OK',
    );
    diagnostics.push('C_E2E_SKIPPED');

    // Independent deterministic baseline (not counted as E2E success)
    line('');
    line(
      '=== Independent baseline (formal model + fixture expected scenario; NOT e2e) ===',
    );
    const baselineSim = simulate(formal, expectedScenario);
    line(
      `baseline simulate: status=${baselineSim.status} (diagnostic only)`,
    );

    // Still consume the 3rd provider call for explain diagnostics on baseline
    const explained = await explainSimulationResult({
      result: baselineSim,
      provider,
      config,
    });
    line(
      `baseline explain: source=${explained.source} fallback=${explained.source === 'deterministic_fallback'}`,
    );
    if (explained.errorClass) {
      line(`  explainErrorClass: ${explained.errorClass}`);
    }
    if (explained.validationErrors && explained.validationErrors.length > 0) {
      line(
        `  explainRejectionReasons: ${explained.validationErrors.map((r) => sanitizeForLog(r)).join(' | ')}`,
      );
    }
    diagnostics.push(`BASELINE_EXPLAIN_${explained.source}`);
  }

  const usage = getUsageRecords();
  const proj = projectCostPer1000Analyses(usage);
  let totalCost: number | null = 0;
  for (const r of usage) {
    if (r.estimatedCostUsd === null) {
      totalCost = null;
      break;
    }
    totalCost += r.estimatedCostUsd;
  }

  line('');
  line('=== Diagnostics (sanitized) ===');
  line(`codes: ${diagnostics.join(',')}`);
  line(`e2eSuccess: ${e2eOk}`);
  line(`questionKind: utilization_under_stated_baseline_load`);

  line('');
  line('=== Usage (measured) ===');
  for (const r of usage) {
    line(
      `- ${r.operation}: model=${r.model} in=${r.inputTokens} out=${r.outputTokens} total=${r.totalTokens} ms=${r.durationMs} usd=${r.estimatedCostUsd ?? 'null'} id=${r.providerRequestId ?? 'n/a'}`,
    );
  }
  line(`calls=${usage.length} (cap ${MAX_PROVIDER_REQUESTS})`);
  line(
    `smokeEstimatedUsd=${totalCost ?? 'null'} pricingIncomplete=${proj.pricingIncomplete}`,
  );
  line('Note: credentials/prompts/architecture body not printed. Persist not invoked.');

  process.exitCode = e2eOk ? 0 : 3;
}

main().catch((err) => {
  process.stderr.write(sanitizeForLog(String(err)) + '\n');
  process.exit(1);
});
