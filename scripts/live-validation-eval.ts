/**
 * Opt-in live OpenAI evaluation against V01–V12.
 *
 * SAFETY:
 *   - Requires RUN_LIVE_OPENAI=1 and OPENAI_API_KEY
 *   - Hard cap MAX_PROVIDER_REQUESTS = 34
 *   - maxRetries: 0 (provider); model gpt-4.1; timeout 60000 ms (via config)
 *   - No persistence; no silent fixture substitution
 *   - Writes JSON artifact under artifacts/eval/
 *
 * DO NOT invoke from CI / npm test.
 *
 * Usage (after explicit human approval):
 *   $env:RUN_LIVE_OPENAI='1'
 *   $env:LLM_PROVIDER='openai'
 *   node --env-file=.env --import tsx scripts/live-validation-eval.ts
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { architectureDocumentSchema } from '../src/architecture/domain/schema';
import type { ArchitectureDocument } from '../src/architecture/domain/types';
import { loadLlmConfig } from '../src/llm/config';
import { compareArchitectures } from '../src/llm/eval/compare-architecture';
import { compareScenarioExtraction } from '../src/llm/eval/compare-scenario';
import { projectEvaluationCosts } from '../src/llm/eval/cost-projections';
import { buildArchitectureExtractionDiagnostics } from '../src/llm/eval/extraction-diagnostics';
import {
  assertUnderRequestCap,
  checkLiveEvalGate,
  LIVE_EVAL_MAX_PROVIDER_REQUESTS,
} from '../src/llm/eval/live-eval-guards';
import { summarizeLatencies } from '../src/llm/eval/percentiles';
import {
  aggregateCaseRecords,
  classifyCaseFailureCategories,
  classifyPipelineFailure,
  type CaseEvalRecord,
} from '../src/llm/eval/score-report';
import { sanitizeForLog } from '../src/llm/errors';
import { explainSimulationResult } from '../src/llm/explanation/explain-result';
import { extractArchitecture } from '../src/llm/extraction/extract-architecture';
import { extractScenario } from '../src/llm/extraction/extract-scenario';
import { createLlmProvider } from '../src/llm/provider/create-provider';
import type { LlmProvider } from '../src/llm/provider/llm-provider';
import type { StructuredParseRequest } from '../src/llm/provider/llm-provider';
import {
  clearUsageRecords,
  getUsageRecords,
} from '../src/llm/usage/usage-recorder';
import { estimateCostUsd } from '../src/llm/usage/pricing';
import { simulate } from '../src/simulation/simulate';
import type { Scenario } from '../src/simulation/domain/scenario';
import type { z } from 'zod';

function withRequestCap(inner: LlmProvider): LlmProvider {
  let started = 0;
  return {
    name: inner.name,
    async parseStructured<T extends z.ZodType>(
      request: StructuredParseRequest<T>,
    ) {
      started += 1;
      assertUnderRequestCap(started, LIVE_EVAL_MAX_PROVIDER_REQUESTS);
      process.stdout.write(
        `[live-eval] provider call ${started}/${LIVE_EVAL_MAX_PROVIDER_REQUESTS}: ${request.operation}\n`,
      );
      return inner.parseStructured(request);
    },
  };
}

function printPreflight(model: string): void {
  const estArch = estimateCostUsd({
    model,
    inputTokens: 2500,
    outputTokens: 320,
  });
  const estScen = estimateCostUsd({
    model,
    inputTokens: 600,
    outputTokens: 70,
  });
  const estExplain = estimateCostUsd({
    model,
    inputTokens: 900,
    outputTokens: 400,
  });
  const perFull =
    estArch.estimatedCostUsd !== null &&
    estScen.estimatedCostUsd !== null &&
    estExplain.estimatedCostUsd !== null
      ? estArch.estimatedCostUsd +
        estScen.estimatedCostUsd +
        estExplain.estimatedCostUsd
      : null;
  const planned =
    12 * (estArch.estimatedCostUsd ?? 0) +
    12 * (estScen.estimatedCostUsd ?? 0) +
    10 * (estExplain.estimatedCostUsd ?? 0);

  process.stdout.write('=== LIVE EVAL PREFLIGHT ===\n');
  process.stdout.write(`model: ${model}\n`);
  process.stdout.write(
    `timeoutMs: ${process.env['OPENAI_TIMEOUT_MS'] ?? '60000'}\n`,
  );
  process.stdout.write('maxRetries: 0\n');
  process.stdout.write(
    `maxProviderRequests: ${LIVE_EVAL_MAX_PROVIDER_REQUESTS}\n`,
  );
  process.stdout.write(
    'plannedCalls: 12 extract_architecture + 12 extract_scenario + ≤10 explain\n',
  );
  process.stdout.write(
    'tokenRanges (approx from smoke): arch 2.0–2.8k in / 0.25–0.4k out; scenario 0.4–0.8k / 0.05–0.1k; explain 0.7–1.2k / 0.2–0.5k\n',
  );
  process.stdout.write(`estimatedUsdPerFullAnalysis: ${perFull ?? 'null'}\n`);
  process.stdout.write(
    `estimatedUsdThisRun (12+12+10 upper): ~${planned.toFixed(4)} (estimated API charges, not invoice)\n`,
  );
  process.stdout.write('persist: none\n');
  process.stdout.write('===========================\n');
}

async function main(): Promise<void> {
  const gate = checkLiveEvalGate();
  if (!gate.ok) {
    process.stderr.write(`${gate.message}\n`);
    process.exit(2);
  }

  clearUsageRecords();

  const config = loadLlmConfig({
    ...process.env,
    LLM_PROVIDER: 'openai',
  });
  printPreflight(config.openaiModel);

  const provider = withRequestCap(createLlmProvider(config));
  const root = join(process.cwd(), 'tests', 'validation');
  const cases = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^V\d{2}_/.test(d.name))
    .map((d) => d.name)
    .sort();

  const caseRecords: CaseEvalRecord[] = [];
  const wallSamples: number[] = [];
  const archDur: number[] = [];
  const scenDur: number[] = [];
  const simDur: number[] = [];
  const explDur: number[] = [];

  for (const name of cases) {
    const dir = join(root, name);
    const nl = readFileSync(join(dir, 'architecture_nl.md'), 'utf8');
    const q = readFileSync(join(dir, 'scenario_nl.md'), 'utf8');
    const formal = architectureDocumentSchema.parse(
      JSON.parse(readFileSync(join(dir, 'formal_model.json'), 'utf8')),
    ) as ArchitectureDocument;
    const expectedScenario = JSON.parse(
      readFileSync(join(dir, 'expected_scenario.json'), 'utf8'),
    ) as Scenario | null;
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as {
      execution?: string;
    };

    const record: CaseEvalRecord = {
      caseId: name,
      pipelineFailureClass: 'none',
    };

    const wallStart = performance.now();
    try {
      const archStart = performance.now();
      const extracted = await extractArchitecture({
        architectureText: nl,
        provider,
        config,
      });
      const archMs = performance.now() - archStart;
      archDur.push(archMs);
      record.architectureStatus = extracted.status;
      record.timingsMs = { extractArchitecture: archMs };

      let architectureOk = false;
      if (extracted.status === 'PROPOSED') {
        const cmp = compareArchitectures(formal, extracted.document);
        record.architectureCompare = cmp;
        record.architectureDiagnostics = buildArchitectureExtractionDiagnostics({
          dto: extracted.extractionDto,
          document: extracted.document,
          findings: extracted.findings,
        });
        architectureOk = true;
        const cp = cmp.conflictPreservation;
        process.stdout.write(
          `\n=== ${name} arch PROPOSED field ${cmp.fieldAccuracy.matches}/${cmp.fieldAccuracy.total} extras_nodes=${cmp.extraNodeIds.length} fieldConflicts=${cp.fieldLevelPreserved} docConflicts=${cp.documentLevelPreserved} extraDoc=${cp.extraDocumentConflicts} ===\n`,
        );
      } else {
        record.errorClass = extracted.errorClass;
        record.errorMessageSanitized = sanitizeForLog(extracted.message);
        process.stdout.write(
          `\n=== ${name} arch ${extracted.status} ${extracted.errorClass} ===\n`,
        );
      }

      const scenStart = performance.now();
      const scen = await extractScenario({
        question: q,
        architecture: formal,
        provider,
        config,
      });
      const scenMs = performance.now() - scenStart;
      scenDur.push(scenMs);
      record.timingsMs = { ...record.timingsMs, extractScenario: scenMs };

      const scenCmp = compareScenarioExtraction(expectedScenario, scen);
      record.scenarioCompare = scenCmp;
      process.stdout.write(
        `scenario intent=${scenCmp.actualIntent} overall=${scenCmp.overallMatch}\n`,
      );

      let simulationMatched: boolean | null = null;
      let simulationRan = false;

      if (
        scen.status === 'OK' &&
        meta.execution === 'simulate' &&
        expectedScenario !== null
      ) {
        const simStart = performance.now();
        const sim = simulate(formal, scen.scenario);
        const simMs = performance.now() - simStart;
        simDur.push(simMs);
        simulationRan = true;
        record.simulationStatus = sim.status;
        record.timingsMs = { ...record.timingsMs, simulate: simMs };
        simulationMatched = scenCmp.overallMatch ? true : null;

        if (scenCmp.overallMatch) {
          const explStart = performance.now();
          const explained = await explainSimulationResult({
            result: sim,
            provider,
            config,
          });
          const explMs = performance.now() - explStart;
          explDur.push(explMs);
          record.explanationSource = explained.source;
          record.explanationValidationOk =
            explained.source === 'llm+deterministic';
          if (explained.validationErrors !== undefined) {
            record.explanationValidationErrors = explained.validationErrors.map(
              (r) => sanitizeForLog(r),
            );
          }
          if (explained.validationErrorCodes !== undefined) {
            record.explanationValidationErrorCodes =
              explained.validationErrorCodes;
          }
          record.invalidReferenceCount =
            explained.source === 'deterministic_fallback' &&
            explained.errorClass === 'EXPLANATION_INVALID'
              ? (explained.validationErrors?.length ?? 1)
              : 0;
          record.unsupportedNumericClaimRejections =
            explained.validationErrors?.filter((r) =>
              r.includes('unsupported qualitative claim'),
            ).length ?? 0;
          record.timingsMs = { ...record.timingsMs, explain: explMs };
          process.stdout.write(
            `explain source=${explained.source}${
              explained.validationErrorCodes?.length
                ? ` codes=${explained.validationErrorCodes.join(',')}`
                : ''
            }\n`,
          );
        }
      }

      record.pipelineFailureClass = classifyPipelineFailure({
        architectureOk,
        scenarioOverallOk: scenCmp.overallMatch,
        simulationRan,
        simulationMatchedExpected: simulationMatched,
      });
      record.failureCategories = classifyCaseFailureCategories(record);
    } catch (err) {
      record.pipelineFailureClass =
        record.architectureStatus === undefined
          ? 'architecture_extraction'
          : 'scenario_extraction';
      record.errorMessageSanitized = sanitizeForLog(
        err instanceof Error ? err.message : String(err),
      );
      process.stderr.write(
        `[live-eval] case ${name} error: ${record.errorMessageSanitized}\n`,
      );
    }

    const wallMs = performance.now() - wallStart;
    wallSamples.push(wallMs);
    record.timingsMs = { ...record.timingsMs, totalWall: wallMs };
    if (!record.failureCategories) {
      record.failureCategories = classifyCaseFailureCategories(record);
    }
    caseRecords.push(record);
  }

  const usage = getUsageRecords();
  const cost = projectEvaluationCosts(usage);
  const report = aggregateCaseRecords(
    caseRecords,
    cost,
    {
      extractArchitecture: summarizeLatencies(archDur),
      extractScenario: summarizeLatencies(scenDur),
      simulate: summarizeLatencies(simDur),
      explain: summarizeLatencies(explDur),
      totalWall: summarizeLatencies(wallSamples),
    },
    'MEASURED',
  );

  const outDir = join(process.cwd(), 'artifacts', 'eval');
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(outDir, `run-${stamp}.json`);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        model: config.openaiModel,
        maxProviderRequests: LIVE_EVAL_MAX_PROVIDER_REQUESTS,
        usage,
        report,
      },
      null,
      2,
    ),
    'utf8',
  );

  process.stdout.write('\n=== SUMMARY ===\n');
  process.stdout.write(
    `arch field accuracy: ${report.architectureFieldAccuracy.matches}/${report.architectureFieldAccuracy.total}\n`,
  );
  process.stdout.write(
    `scenario structured overall: ${report.scenarioStructured.overallOk}/${report.scenarioStructured.denominator}\n`,
  );
  process.stdout.write(
    `unsupported NL: ${report.scenarioUnsupportedNl.ok}/${report.scenarioUnsupportedNl.denominator}\n`,
  );
  process.stdout.write(
    `cost A full/1000: ${cost.fullAnalysis.projectedPer1000Usd ?? 'null'}\n`,
  );
  process.stdout.write(
    `cost B persisted/1000: ${cost.persistedArchitectureAnalysis.projectedPer1000Usd ?? 'null'}\n`,
  );
  process.stdout.write(
    `cost C early/1000: ${cost.earlyTerminal.projectedPer1000Usd ?? 'null'}\n`,
  );
  process.stdout.write(
    `wall p50/p95 (N=${report.latency.totalWall.sampleSize}): ${report.latency.totalWall.p50Ms}/${report.latency.totalWall.p95Ms}\n`,
  );
  process.stdout.write(`artifact: ${outPath}\n`);
  process.stdout.write(
    'Note: estimated API charges ≠ invoice; latencies are request timings, not architecture model latency.\n',
  );
}

main().catch((err) => {
  process.stderr.write(sanitizeForLog(String(err)) + '\n');
  process.exit(1);
});
