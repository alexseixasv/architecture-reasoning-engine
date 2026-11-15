/**
 * Opt-in live OpenAI evaluation against V01–V12.
 *
 * WARNING: Performs up to ~24 provider calls (12 architecture + 12 scenario).
 * Prefer `npm run llm:live-smoke` (3 calls) for a controlled first spend.
 *
 * Requires:
 *   RUN_LIVE_OPENAI=1
 *   OPENAI_API_KEY=...
 *   LLM_PROVIDER=openai
 *
 * Never invoked by `npm test` / CI.
 *
 * Usage:
 *   RUN_LIVE_OPENAI=1 LLM_PROVIDER=openai npx tsx scripts/live-validation-eval.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { architectureDocumentSchema } from '../src/architecture/domain/schema';
import { compareArchitectures } from '../src/llm/eval/compare-architecture';
import { extractArchitecture } from '../src/llm/extraction/extract-architecture';
import { extractScenario } from '../src/llm/extraction/extract-scenario';
import { createLlmProvider } from '../src/llm/provider/create-provider';
import { loadLlmConfig } from '../src/llm/config';
import {
  getUsageRecords,
  projectCostPer1000Analyses,
  clearUsageRecords,
} from '../src/llm/usage/usage-recorder';

function assertLiveEnabled(): void {
  if (process.env['RUN_LIVE_OPENAI'] !== '1') {
    process.stderr.write(
      'Refusing to run: set RUN_LIVE_OPENAI=1 to opt in to live OpenAI calls.\n',
    );
    process.exit(2);
  }
  if (!process.env['OPENAI_API_KEY']) {
    process.stderr.write('OPENAI_API_KEY is required for live evaluation.\n');
    process.exit(2);
  }
}

async function main(): Promise<void> {
  assertLiveEnabled();
  clearUsageRecords();
  const config = loadLlmConfig({
    ...process.env,
    LLM_PROVIDER: 'openai',
  });
  const provider = createLlmProvider(config);
  const root = join(process.cwd(), 'tests', 'validation');
  const cases = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^V\d{2}_/.test(d.name))
    .map((d) => d.name)
    .sort();

  let archFieldMatches = 0;
  let archFieldTotal = 0;
  let scenarioOk = 0;
  let scenarioTotal = 0;
  let unsupportedOk = 0;
  let unsupportedTotal = 0;

  for (const name of cases) {
    const dir = join(root, name);
    const nl = readFileSync(join(dir, 'architecture_nl.md'), 'utf8');
    const q = readFileSync(join(dir, 'scenario_nl.md'), 'utf8');
    const formal = architectureDocumentSchema.parse(
      JSON.parse(readFileSync(join(dir, 'formal_model.json'), 'utf8')),
    );
    const expectedScenario = JSON.parse(
      readFileSync(join(dir, 'expected_scenario.json'), 'utf8'),
    ) as unknown;

    const extracted = await extractArchitecture({
      architectureText: nl,
      provider,
      config,
    });
    process.stdout.write(`\n=== ${name} architecture: ${extracted.status} ===\n`);
    if (extracted.status === 'PROPOSED') {
      const cmp = compareArchitectures(formal, extracted.document);
      archFieldMatches += cmp.fieldAccuracy.matches;
      archFieldTotal += cmp.fieldAccuracy.total;
      process.stdout.write(
        `field accuracy: ${cmp.fieldAccuracy.matches}/${cmp.fieldAccuracy.total}\n`,
      );
    }

    if (expectedScenario === null) {
      unsupportedTotal += 1;
      const scen = await extractScenario({
        question: q,
        architecture: formal,
        provider,
        config,
      });
      if (scen.status === 'UNSUPPORTED' || scen.status === 'NEEDS_CLARIFICATION') {
        unsupportedOk += 1;
      }
      process.stdout.write(`unsupported/clarify path: ${scen.status}\n`);
    } else {
      scenarioTotal += 1;
      const scen = await extractScenario({
        question: q,
        architecture: formal,
        provider,
        config,
      });
      if (
        scen.status === 'OK' &&
        JSON.stringify(scen.scenario) === JSON.stringify(expectedScenario)
      ) {
        scenarioOk += 1;
      }
      process.stdout.write(
        `scenario: ${scen.status} (expected ${JSON.stringify(expectedScenario)})\n`,
      );
    }
  }

  const usage = getUsageRecords();
  const proj = projectCostPer1000Analyses(usage);
  process.stdout.write('\n=== SUMMARY (measured this run only) ===\n');
  process.stdout.write(
    `Architecture field accuracy: ${archFieldMatches}/${archFieldTotal}\n`,
  );
  process.stdout.write(
    `Scenario intent accuracy: ${scenarioOk}/${scenarioTotal}\n`,
  );
  process.stdout.write(
    `Unsupported/clarification behavior: ${unsupportedOk}/${unsupportedTotal}\n`,
  );
  process.stdout.write(`Usage records: ${usage.length}\n`);
  process.stdout.write(
    `Projected USD / 1000 complete analyses: ${proj.projectedCostPer1000AnalysesUsd ?? 'null (pricing incomplete)'}\n`,
  );
  process.stdout.write(
    `Pricing date note: see src/llm/usage/pricing.ts (2026-11-15)\n`,
  );
}

main().catch((err) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
