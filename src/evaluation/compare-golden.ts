import type { SimulationResult } from '../simulation/domain/result';

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

export type ComparisonMismatch = {
  path: string;
  expected: unknown;
  actual: unknown;
  message: string;
};

export type MetricEvidenceSummary = {
  metricId: string;
  expectedValue: number;
  actualValue: number | null;
  unit: string | null;
  formulaId: string | null;
  expectedFormulaId: string;
  substitutions: string[];
  inputPaths: string[];
  result: string;
};

export type GoldenComparison = {
  ok: boolean;
  mismatches: ComparisonMismatch[];
  metricEvidence: MetricEvidenceSummary[];
  refusedReasonCodes: string[];
};

function nearlyEqual(a: number, b: number, absTolerance = 0): boolean {
  return Math.abs(a - b) <= absTolerance;
}

function mismatch(
  path: string,
  expected: unknown,
  actual: unknown,
  message: string,
): ComparisonMismatch {
  return { path, expected, actual, message };
}

/**
 * Pure expected-versus-actual comparison for golden/validation simulation fixtures.
 * No Vitest dependency — used by the Evaluation Lab runner and by test helpers.
 */
export function compareGoldenResult(
  actual: SimulationResult,
  expected: GoldenExpected,
): GoldenComparison {
  const mismatches: ComparisonMismatch[] = [];
  const metricEvidence: MetricEvidenceSummary[] = [];

  if (actual.status !== expected.status) {
    mismatches.push(
      mismatch(
        'status',
        expected.status,
        actual.status,
        `status: expected ${expected.status}, got ${actual.status}`,
      ),
    );
  }

  const actualIds = actual.metrics.map((m) => m.metricId).sort();
  const expectedIds = expected.metrics.map((m) => m.metricId).sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    mismatches.push(
      mismatch(
        'metrics.ids',
        expectedIds,
        actualIds,
        'metric ID sets differ',
      ),
    );
  }

  for (const exp of expected.metrics) {
    const got = actual.metrics.find((m) => m.metricId === exp.metricId);
    metricEvidence.push({
      metricId: exp.metricId,
      expectedValue: exp.value,
      actualValue: got?.value ?? null,
      unit: got?.unit ?? null,
      formulaId: got?.formulaId ?? null,
      expectedFormulaId: exp.formulaId,
      substitutions: got?.substitutions ?? [],
      inputPaths: got?.inputs.map((i) => i.path) ?? [],
      result: got?.result ?? '',
    });

    if (!got) {
      mismatches.push(
        mismatch(
          `metrics.${exp.metricId}`,
          exp,
          null,
          `missing metric ${exp.metricId}`,
        ),
      );
      continue;
    }

    if (got.unit !== exp.unit) {
      mismatches.push(
        mismatch(
          `metrics.${exp.metricId}.unit`,
          exp.unit,
          got.unit,
          `${exp.metricId} unit mismatch`,
        ),
      );
    }
    if (got.formulaId !== exp.formulaId) {
      mismatches.push(
        mismatch(
          `metrics.${exp.metricId}.formulaId`,
          exp.formulaId,
          got.formulaId,
          `${exp.metricId} formulaId mismatch`,
        ),
      );
    }
    if (!nearlyEqual(got.value, exp.value, exp.absTolerance ?? 0)) {
      mismatches.push(
        mismatch(
          `metrics.${exp.metricId}.value`,
          exp.value,
          got.value,
          `${exp.metricId}: ${got.value} vs ${exp.value}`,
        ),
      );
    }

    if (exp.requireEvidence !== false) {
      if (got.substitutions.length === 0) {
        mismatches.push(
          mismatch(
            `metrics.${exp.metricId}.substitutions`,
            'non-empty',
            got.substitutions,
            `${exp.metricId} missing substitutions evidence`,
          ),
        );
      }
      if (got.inputs.length === 0) {
        mismatches.push(
          mismatch(
            `metrics.${exp.metricId}.inputs`,
            'non-empty',
            got.inputs,
            `${exp.metricId} missing inputs evidence`,
          ),
        );
      }
      if (got.result.length === 0) {
        mismatches.push(
          mismatch(
            `metrics.${exp.metricId}.result`,
            'non-empty string',
            got.result,
            `${exp.metricId} missing result evidence`,
          ),
        );
      }
    }

    if (exp.requireInputPaths) {
      for (const path of exp.requireInputPaths) {
        if (!got.inputs.some((i) => i.path === path)) {
          mismatches.push(
            mismatch(
              `metrics.${exp.metricId}.inputs`,
              path,
              got.inputs.map((i) => i.path),
              `${exp.metricId} missing input path ${path}`,
            ),
          );
        }
      }
    }
  }

  for (const id of expected.forbiddenMetricIds ?? []) {
    if (actual.metrics.some((m) => m.metricId === id)) {
      mismatches.push(
        mismatch(
          `metrics.forbidden.${id}`,
          'absent',
          id,
          `forbidden metric present: ${id}`,
        ),
      );
    }
  }

  const refusedCodes = actual.refused.map((r) => r.reasonCode);
  const refusedSet = new Set(refusedCodes);
  for (const code of expected.requiredRefusedReasonCodes) {
    if (!refusedSet.has(code)) {
      mismatches.push(
        mismatch(
          'refused',
          code,
          [...refusedSet],
          `missing refused reason ${code}`,
        ),
      );
    }
  }

  if (expected.saturations) {
    const actualSats = [...actual.saturations].sort((a, b) =>
      a.componentId.localeCompare(b.componentId),
    );
    const expectedSats = [...expected.saturations].sort((a, b) =>
      a.componentId.localeCompare(b.componentId),
    );
    const actualSatIds = actualSats.map((s) => s.componentId);
    const expectedSatIds = expectedSats.map((s) => s.componentId);
    if (JSON.stringify(actualSatIds) !== JSON.stringify(expectedSatIds)) {
      mismatches.push(
        mismatch(
          'saturations.ids',
          expectedSatIds,
          actualSatIds,
          'saturation component ID sets differ',
        ),
      );
    }
    for (const exp of expectedSats) {
      const got = actualSats.find((s) => s.componentId === exp.componentId);
      if (!got) {
        mismatches.push(
          mismatch(
            `saturations.${exp.componentId}`,
            exp,
            null,
            `missing saturation ${exp.componentId}`,
          ),
        );
        continue;
      }
      if (got.saturated !== exp.saturated) {
        mismatches.push(
          mismatch(
            `saturations.${exp.componentId}.saturated`,
            exp.saturated,
            got.saturated,
            `${exp.componentId} saturated mismatch`,
          ),
        );
      }
      const tol = exp.absTolerance ?? 0;
      if (
        exp.utilization !== undefined &&
        !nearlyEqual(got.utilization ?? NaN, exp.utilization, tol)
      ) {
        mismatches.push(
          mismatch(
            `saturations.${exp.componentId}.utilization`,
            exp.utilization,
            got.utilization,
            `${exp.componentId} utilization mismatch`,
          ),
        );
      }
      if (
        exp.offeredLoadRps !== undefined &&
        !nearlyEqual(got.offeredLoadRps ?? NaN, exp.offeredLoadRps, tol)
      ) {
        mismatches.push(
          mismatch(
            `saturations.${exp.componentId}.offeredLoadRps`,
            exp.offeredLoadRps,
            got.offeredLoadRps,
            `${exp.componentId} offeredLoadRps mismatch`,
          ),
        );
      }
      if (
        exp.capacityRps !== undefined &&
        !nearlyEqual(got.capacityRps ?? NaN, exp.capacityRps, tol)
      ) {
        mismatches.push(
          mismatch(
            `saturations.${exp.componentId}.capacityRps`,
            exp.capacityRps,
            got.capacityRps,
            `${exp.componentId} capacityRps mismatch`,
          ),
        );
      }
    }
  }

  if (expected.impacts) {
    for (const exp of expected.impacts) {
      const got = actual.impacts.find((i) => i.componentId === exp.componentId);
      if (!got) {
        mismatches.push(
          mismatch(
            `impacts.${exp.componentId}`,
            exp,
            null,
            `missing impact ${exp.componentId}`,
          ),
        );
        continue;
      }
      if (got.impact !== exp.impact) {
        mismatches.push(
          mismatch(
            `impacts.${exp.componentId}.impact`,
            exp.impact,
            got.impact,
            `impact mismatch for ${exp.componentId}`,
          ),
        );
      }
      if (
        exp.path &&
        JSON.stringify(got.path) !== JSON.stringify(exp.path)
      ) {
        mismatches.push(
          mismatch(
            `impacts.${exp.componentId}.path`,
            exp.path,
            got.path,
            `impact path mismatch for ${exp.componentId}`,
          ),
        );
      }
    }
  }

  if (expected.propagationPaths) {
    for (const exp of expected.propagationPaths) {
      const got = actual.propagationPaths.find(
        (p) => p.componentId === exp.componentId,
      );
      if (!got) {
        mismatches.push(
          mismatch(
            `propagationPaths.${exp.componentId}`,
            exp,
            null,
            `missing propagation ${exp.componentId}`,
          ),
        );
        continue;
      }
      if (JSON.stringify(got.path) !== JSON.stringify(exp.path)) {
        mismatches.push(
          mismatch(
            `propagationPaths.${exp.componentId}.path`,
            exp.path,
            got.path,
            `propagation path mismatch for ${exp.componentId}`,
          ),
        );
      }
    }
  }

  if (expected.requiredAssumptionIds) {
    const ids = new Set(actual.assumptions.map((a) => a.id));
    for (const id of expected.requiredAssumptionIds) {
      if (!ids.has(id)) {
        mismatches.push(
          mismatch(
            'assumptions',
            id,
            [...ids],
            `missing assumption ${id}`,
          ),
        );
      }
    }
  }

  return {
    ok: mismatches.length === 0,
    mismatches,
    metricEvidence,
    refusedReasonCodes: refusedCodes,
  };
}

/** Standing fabrication refusals present on every successful simulate path. */
export const STANDING_REFUSALS = [
  'NO_AVAILABILITY_MODEL',
  'NO_THROUGHPUT_MODEL',
  'NO_LATENCY_DISTRIBUTION',
] as const;
