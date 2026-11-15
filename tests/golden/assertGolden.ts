import { expect } from 'vitest';
import type { ArchitectureDocument } from '../../src/architecture/domain/types';
import { architectureDocumentSchema } from '../../src/architecture/domain/schema';
import { simulate } from '../../src/simulation/simulate';
import type { SimulationResult } from '../../src/simulation/domain/result';

export type ExpectedMetric = {
  metricId: string;
  value: number;
  unit: string;
  formulaId: string;
  requireEvidence?: boolean;
  requireInputPaths?: string[];
  /** Absolute tolerance; default 0 (exact). */
  absTolerance?: number;
};

export type ExpectedSaturation = {
  componentId: string;
  saturated: boolean;
  utilization?: number;
  offeredLoadRps?: number;
  capacityRps?: number;
  absTolerance?: number;
};

export type ExpectedImpact = {
  componentId: string;
  impact: string;
  path?: string[];
};

export type ExpectedPropagationPath = {
  componentId: string;
  path: string[];
};

export type GoldenExpected = {
  status: SimulationResult['status'];
  /** Complete set of numerical metrics — unexpected IDs fail. */
  metrics: ExpectedMetric[];
  saturations?: ExpectedSaturation[];
  /** If set, only these non-unaffected impacts are asserted; unaffected may exist. */
  impacts?: ExpectedImpact[];
  propagationPaths?: ExpectedPropagationPath[];
  requiredAssumptionIds?: string[];
  /** Every listed reasonCode must appear in refused. */
  requiredRefusedReasonCodes: string[];
  /** Metric IDs that must not appear as computed numbers. */
  forbiddenMetricIds?: string[];
};

function nearlyEqual(a: number, b: number, absTolerance = 0): boolean {
  return Math.abs(a - b) <= absTolerance;
}

export function assertGoldenResult(
  actual: SimulationResult,
  expected: GoldenExpected,
): void {
  expect(actual.status).toBe(expected.status);

  const actualIds = actual.metrics.map((m) => m.metricId).sort();
  const expectedIds = expected.metrics.map((m) => m.metricId).sort();
  expect(actualIds).toEqual(expectedIds);

  for (const exp of expected.metrics) {
    const got = actual.metrics.find((m) => m.metricId === exp.metricId);
    expect(got, `missing metric ${exp.metricId}`).toBeDefined();
    if (!got) {
      continue;
    }
    expect(got.unit).toBe(exp.unit);
    expect(got.formulaId).toBe(exp.formulaId);
    expect(
      nearlyEqual(got.value, exp.value, exp.absTolerance ?? 0),
      `${exp.metricId}: ${got.value} vs ${exp.value}`,
    ).toBe(true);

    if (exp.requireEvidence !== false) {
      expect(got.substitutions.length).toBeGreaterThan(0);
      expect(got.inputs.length).toBeGreaterThan(0);
      expect(got.result.length).toBeGreaterThan(0);
    }
    if (exp.requireInputPaths) {
      for (const path of exp.requireInputPaths) {
        expect(
          got.inputs.some((i) => i.path === path),
          `${exp.metricId} missing input path ${path}`,
        ).toBe(true);
      }
    }
  }

  for (const id of expected.forbiddenMetricIds ?? []) {
    expect(
      actual.metrics.some((m) => m.metricId === id),
      `forbidden metric present: ${id}`,
    ).toBe(false);
  }

  const refusedCodes = new Set(actual.refused.map((r) => r.reasonCode));
  for (const code of expected.requiredRefusedReasonCodes) {
    expect(refusedCodes.has(code), `missing refused reason ${code}`).toBe(
      true,
    );
  }

  if (expected.saturations) {
    const actualSats = [...actual.saturations].sort((a, b) =>
      a.componentId.localeCompare(b.componentId),
    );
    const expectedSats = [...expected.saturations].sort((a, b) =>
      a.componentId.localeCompare(b.componentId),
    );
    expect(actualSats.map((s) => s.componentId)).toEqual(
      expectedSats.map((s) => s.componentId),
    );
    for (const exp of expectedSats) {
      const got = actualSats.find((s) => s.componentId === exp.componentId);
      expect(got).toBeDefined();
      if (!got) {
        continue;
      }
      expect(got.saturated).toBe(exp.saturated);
      const tol = exp.absTolerance ?? 0;
      if (exp.utilization !== undefined) {
        expect(nearlyEqual(got.utilization ?? NaN, exp.utilization, tol)).toBe(
          true,
        );
      }
      if (exp.offeredLoadRps !== undefined) {
        expect(
          nearlyEqual(got.offeredLoadRps ?? NaN, exp.offeredLoadRps, tol),
        ).toBe(true);
      }
      if (exp.capacityRps !== undefined) {
        expect(nearlyEqual(got.capacityRps ?? NaN, exp.capacityRps, tol)).toBe(
          true,
        );
      }
    }
  }

  if (expected.impacts) {
    for (const exp of expected.impacts) {
      const got = actual.impacts.find((i) => i.componentId === exp.componentId);
      expect(got, `missing impact ${exp.componentId}`).toBeDefined();
      expect(got?.impact).toBe(exp.impact);
      if (exp.path) {
        expect(got?.path).toEqual(exp.path);
      }
    }
  }

  if (expected.propagationPaths) {
    for (const exp of expected.propagationPaths) {
      const got = actual.propagationPaths.find(
        (p) => p.componentId === exp.componentId,
      );
      expect(got, `missing propagation ${exp.componentId}`).toBeDefined();
      expect(got?.path).toEqual(exp.path);
    }
  }

  if (expected.requiredAssumptionIds) {
    const ids = new Set(actual.assumptions.map((a) => a.id));
    for (const id of expected.requiredAssumptionIds) {
      expect(ids.has(id), `missing assumption ${id}`).toBe(true);
    }
  }
}

export function runGoldenCase(input: {
  architecture: unknown;
  scenario: unknown;
  expected: GoldenExpected;
}): SimulationResult {
  const parsed = architectureDocumentSchema.parse(input.architecture);
  const before = JSON.stringify(parsed);
  const once = simulate(parsed as ArchitectureDocument, input.scenario);
  const twice = simulate(parsed as ArchitectureDocument, input.scenario);
  expect(once).toEqual(twice);
  expect(JSON.stringify(parsed)).toBe(before);
  assertGoldenResult(once, input.expected);
  return once;
}

/** Standing fabrication refusals present on every successful simulate path. */
export const STANDING_REFUSALS = [
  'NO_AVAILABILITY_MODEL',
  'NO_THROUGHPUT_MODEL',
  'NO_LATENCY_DISTRIBUTION',
] as const;
