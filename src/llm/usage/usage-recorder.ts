import type { LlmErrorClass } from '../errors';
import {
  UsageCollector,
  type UsageRecordInput,
} from './usage-collector';

export type LlmOperation =
  | 'extract_architecture'
  | 'extract_scenario'
  | 'explain';

export type UsageRecord = {
  operation: LlmOperation;
  model: string;
  providerRequestId?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  /** null when model pricing is unknown — never treated as $0. */
  estimatedCostUsd: number | null;
  pricingDate: string | null;
  errorClass?: LlmErrorClass;
  at: string;
};

/**
 * A complete analysis = architecture extraction + scenario extraction + explanation.
 * Do not treat a single call as a complete analysis.
 */
export type AnalysisCostProjection = {
  sampleCompleteAnalyses: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedCostUsd: number | null;
  projectedCostPer1000AnalysesUsd: number | null;
  pricingIncomplete: boolean;
};

/** Process-global buffer for offline scripts/tests only — not for HTTP concurrency. */
const globalCollector = new UsageCollector();

export function clearUsageRecords(): void {
  globalCollector.clear();
}

export function getUsageRecords(): readonly UsageRecord[] {
  return globalCollector.snapshot();
}

/**
 * Record usage into an explicit collector when provided (HTTP path).
 * Falls back to the process-global collector for scripts/unit tests.
 */
export function recordUsage(
  input: UsageRecordInput,
  collector?: UsageCollector,
): UsageRecord {
  return (collector ?? globalCollector).record(input);
}

/**
 * Groups consecutive triplets (extract_architecture, extract_scenario, explain)
 * when present; otherwise estimates from mean cost of each operation type.
 */
export function projectCostPer1000Analyses(
  sample: readonly UsageRecord[] = getUsageRecords(),
): AnalysisCostProjection {
  const byOp = {
    extract_architecture: [] as UsageRecord[],
    extract_scenario: [] as UsageRecord[],
    explain: [] as UsageRecord[],
  };
  for (const r of sample) {
    byOp[r.operation].push(r);
  }

  const meanCost = (xs: UsageRecord[]): number | null => {
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
  };

  const a = meanCost(byOp.extract_architecture);
  const s = meanCost(byOp.extract_scenario);
  const e = meanCost(byOp.explain);
  const pricingIncomplete = a === null || s === null || e === null;
  const perAnalysis =
    a !== null && s !== null && e !== null ? a + s + e : null;

  const totalInput = sample.reduce((n, r) => n + r.inputTokens, 0);
  const totalOutput = sample.reduce((n, r) => n + r.outputTokens, 0);
  let totalCost: number | null = 0;
  for (const r of sample) {
    if (r.estimatedCostUsd === null) {
      totalCost = null;
      break;
    }
    totalCost += r.estimatedCostUsd;
  }

  const completeSamples = Math.min(
    byOp.extract_architecture.length,
    byOp.extract_scenario.length,
    byOp.explain.length,
  );

  return {
    sampleCompleteAnalyses: completeSamples,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalEstimatedCostUsd: totalCost,
    projectedCostPer1000AnalysesUsd:
      perAnalysis === null ? null : perAnalysis * 1000,
    pricingIncomplete,
  };
}
