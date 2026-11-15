import type { LlmErrorClass } from '../errors';
import { estimateCostUsd } from './pricing';

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

const records: UsageRecord[] = [];

export function clearUsageRecords(): void {
  records.length = 0;
}

export function getUsageRecords(): readonly UsageRecord[] {
  return records;
}

export function recordUsage(
  input: Omit<UsageRecord, 'estimatedCostUsd' | 'pricingDate' | 'at' | 'totalTokens'> & {
    totalTokens?: number;
    errorClass?: LlmErrorClass;
  },
): UsageRecord {
  const totalTokens =
    input.totalTokens ?? input.inputTokens + input.outputTokens;
  const { estimatedCostUsd, pricingDate } = estimateCostUsd({
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
  });
  const record: UsageRecord = {
    operation: input.operation,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens,
    durationMs: input.durationMs,
    estimatedCostUsd,
    pricingDate,
    at: new Date().toISOString(),
  };
  if (input.providerRequestId !== undefined) {
    record.providerRequestId = input.providerRequestId;
  }
  if (input.errorClass !== undefined) {
    record.errorClass = input.errorClass;
  }
  records.push(record);
  return record;
}

/**
 * Groups consecutive triplets (extract_architecture, extract_scenario, explain)
 * when present; otherwise estimates from mean cost of each operation type.
 */
export function projectCostPer1000Analyses(
  sample: readonly UsageRecord[] = records,
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
