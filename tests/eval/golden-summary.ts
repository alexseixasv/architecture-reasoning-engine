import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { architectureDocumentSchema } from '../../src/architecture/domain/schema';
import type { ArchitectureDocument } from '../../src/architecture/domain/types';
import { simulate } from '../../src/simulation/simulate';
import {
  assertGoldenResult,
  type GoldenExpected,
} from '../golden/assertGolden';

export type GoldenCaseSummary = {
  id: string;
  passed: boolean;
  status?: string;
  formulaIds: string[];
  requiredRefusalCodes: string[];
  deterministicRepeatable: boolean;
  error?: string;
};

export type GoldenSuiteSummary = {
  total: number;
  passed: number;
  failed: number;
  formulaIdsCovered: string[];
  cases: GoldenCaseSummary[];
};

/**
 * Re-runs G01–G12 offline and summarizes results.
 * Does not mutate engine behavior.
 */
export function summarizeGoldenSuite(
  goldenRoot = join(process.cwd(), 'tests', 'golden'),
): GoldenSuiteSummary {
  const dirs = readdirSync(goldenRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^G\d{2}_/.test(d.name))
    .map((d) => d.name)
    .sort();

  const cases: GoldenCaseSummary[] = [];
  const formulaSet = new Set<string>();

  for (const name of dirs) {
    const id = name.slice(0, 3);
    const dir = join(goldenRoot, name);
    try {
      const arch = architectureDocumentSchema.parse(
        JSON.parse(readFileSync(join(dir, 'architecture.json'), 'utf8')),
      ) as ArchitectureDocument;
      const scenario = JSON.parse(
        readFileSync(join(dir, 'scenario.json'), 'utf8'),
      ) as unknown;
      const expected = JSON.parse(
        readFileSync(join(dir, 'expected.json'), 'utf8'),
      ) as GoldenExpected;

      const before = JSON.stringify(arch);
      const a = simulate(arch, scenario);
      const b = simulate(arch, scenario);
      const deterministicRepeatable =
        JSON.stringify(a) === JSON.stringify(b) &&
        JSON.stringify(arch) === before;

      assertGoldenResult(a, expected);
      for (const m of a.metrics) {
        formulaSet.add(m.formulaId);
      }
      cases.push({
        id,
        passed: true,
        status: a.status,
        formulaIds: [...new Set(a.metrics.map((m) => m.formulaId))].sort(),
        requiredRefusalCodes: expected.requiredRefusedReasonCodes,
        deterministicRepeatable,
      });
    } catch (err) {
      cases.push({
        id,
        passed: false,
        formulaIds: [],
        requiredRefusalCodes: [],
        deterministicRepeatable: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const passed = cases.filter((c) => c.passed).length;
  return {
    total: cases.length,
    passed,
    failed: cases.length - passed,
    formulaIdsCovered: [...formulaSet].sort(),
    cases,
  };
}
