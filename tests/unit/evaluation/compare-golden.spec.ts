import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';
import { architectureDocumentSchema } from '../../../src/architecture/domain/schema';
import {
  compareGoldenResult,
  type GoldenExpected,
} from '../../../src/evaluation/compare-golden';
import { simulate } from '../../../src/simulation/simulate';

function loadG01(): {
  architecture: ArchitectureDocument;
  scenario: unknown;
  expected: GoldenExpected;
} {
  const dir = join(
    process.cwd(),
    'tests',
    'golden',
    'G01_capacity_sum_replicas',
  );
  return {
    architecture: architectureDocumentSchema.parse(
      JSON.parse(readFileSync(join(dir, 'architecture.json'), 'utf8')),
    ) as ArchitectureDocument,
    scenario: JSON.parse(
      readFileSync(join(dir, 'scenario.json'), 'utf8'),
    ) as unknown,
    expected: JSON.parse(
      readFileSync(join(dir, 'expected.json'), 'utf8'),
    ) as GoldenExpected,
  };
}

describe('compareGoldenResult', () => {
  it('passes G01 expected-versus-actual with formula and refusal checks', () => {
    const { architecture, scenario, expected } = loadG01();
    const actual = simulate(architecture, scenario);
    const comparison = compareGoldenResult(actual, expected);
    expect(comparison.ok).toBe(true);
    expect(comparison.mismatches).toEqual([]);
    const util = comparison.metricEvidence.find(
      (m) => m.metricId === 'utilization:api',
    );
    expect(util?.formulaId).toBe('F-UTIL-001');
    expect(util?.expectedFormulaId).toBe('F-UTIL-001');
    expect(util?.substitutions.length).toBeGreaterThan(0);
    for (const code of expected.requiredRefusedReasonCodes) {
      expect(comparison.refusedReasonCodes).toContain(code);
    }
  });

  it('fails on deliberately incorrect expected value', () => {
    const { architecture, scenario, expected } = loadG01();
    const actual = simulate(architecture, scenario);
    const wrong: GoldenExpected = {
      ...expected,
      metrics: expected.metrics.map((m) =>
        m.metricId === 'utilization:api' ? { ...m, value: 0.99 } : m,
      ),
    };
    const comparison = compareGoldenResult(actual, wrong);
    expect(comparison.ok).toBe(false);
    expect(
      comparison.mismatches.some((m) => m.path.includes('utilization:api')),
    ).toBe(true);
  });

  it('fails on formulaId mismatch', () => {
    const { architecture, scenario, expected } = loadG01();
    const actual = simulate(architecture, scenario);
    const wrong: GoldenExpected = {
      ...expected,
      metrics: expected.metrics.map((m) =>
        m.metricId === 'utilization:api'
          ? { ...m, formulaId: 'F-FAKE' }
          : m,
      ),
    };
    const comparison = compareGoldenResult(actual, wrong);
    expect(comparison.ok).toBe(false);
    expect(
      comparison.mismatches.some((m) => m.path.endsWith('.formulaId')),
    ).toBe(true);
  });
});
