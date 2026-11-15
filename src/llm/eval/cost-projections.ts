import type { UsageRecord } from '../usage/usage-recorder';

export type CostBucketProjection = {
  label: string;
  operations: string[];
  sampleCount: number;
  meanEstimatedUsd: number | null;
  projectedPer1000Usd: number | null;
  pricingIncomplete: boolean;
  assumptions: string[];
};

function meanCost(xs: UsageRecord[]): number | null {
  if (xs.length === 0) {
    return null;
  }
  let sum = 0;
  for (const x of xs) {
    if (x.estimatedCostUsd === null) {
      return null;
    }
    sum += x.estimatedCostUsd;
  }
  return sum / xs.length;
}

function projectFromMeans(
  label: string,
  operations: string[],
  means: Array<number | null>,
  sampleCount: number,
  assumptions: string[],
): CostBucketProjection {
  const pricingIncomplete = means.some((m) => m === null) || sampleCount === 0;
  if (pricingIncomplete) {
    return {
      label,
      operations,
      sampleCount,
      meanEstimatedUsd: null,
      projectedPer1000Usd: null,
      pricingIncomplete: true,
      assumptions,
    };
  }
  const meanEstimatedUsd = (means as number[]).reduce((a, b) => a + b, 0);
  return {
    label,
    operations,
    sampleCount,
    meanEstimatedUsd,
    projectedPer1000Usd: meanEstimatedUsd * 1000,
    pricingIncomplete: false,
    assumptions,
  };
}

/**
 * Cost projections for case reporting.
 * A — full analysis (arch + scenario + explain)
 * B — persisted architecture (scenario + explain)
 * C — early-terminal (scenario only; no explain when no simulation)
 *
 * estimated API charges from configured pricing — not actual invoices.
 */
export function projectEvaluationCosts(
  sample: readonly UsageRecord[],
): {
  fullAnalysis: CostBucketProjection;
  persistedArchitectureAnalysis: CostBucketProjection;
  earlyTerminal: CostBucketProjection;
  note: string;
} {
  const byOp = {
    extract_architecture: [] as UsageRecord[],
    extract_scenario: [] as UsageRecord[],
    explain: [] as UsageRecord[],
  };
  for (const r of sample) {
    byOp[r.operation].push(r);
  }

  const a = meanCost(byOp.extract_architecture);
  const s = meanCost(byOp.extract_scenario);
  const e = meanCost(byOp.explain);

  const fullSamples = Math.min(
    byOp.extract_architecture.length,
    byOp.extract_scenario.length,
    byOp.explain.length,
  );
  const persistedSamples = Math.min(
    byOp.extract_scenario.length,
    byOp.explain.length,
  );
  const earlySamples = byOp.extract_scenario.length;

  return {
    fullAnalysis: projectFromMeans(
      'A_full_analysis',
      ['extract_architecture', 'extract_scenario', 'explain'],
      [a, s, e],
      fullSamples,
      [
        'Mean cost per operation type across measured records, then summed.',
        'Requires priced samples for all three operations.',
        'Estimated API charges from pricing table — not actual billing.',
      ],
    ),
    persistedArchitectureAnalysis: projectFromMeans(
      'B_persisted_architecture',
      ['extract_scenario', 'explain'],
      [s, e],
      persistedSamples,
      [
        'Assumes architecture already persisted; excludes extract_architecture.',
        'Requires priced samples for scenario + explain.',
        'Estimated API charges from pricing table — not actual billing.',
      ],
    ),
    earlyTerminal: projectFromMeans(
      'C_early_terminal',
      ['extract_scenario'],
      [s],
      earlySamples,
      [
        'UNSUPPORTED/NEEDS_CLARIFICATION paths without simulation/explanation.',
        'Uses mean extract_scenario cost only; does not invent explain=$0.',
        'Estimated API charges from pricing table — not actual billing.',
      ],
    ),
    note:
      'Incomplete operation samples yield null projections (never fabricated $0).',
  };
}
