import type { LlmErrorClass } from '../errors';
import { estimateCostUsd } from './pricing';
import type { LlmOperation, UsageRecord } from './usage-recorder';

export type UsageRecordInput = Omit<
  UsageRecord,
  'estimatedCostUsd' | 'pricingDate' | 'at' | 'totalTokens'
> & {
  totalTokens?: number;
  errorClass?: LlmErrorClass;
};

/**
 * Explicit per-request usage buffer. HTTP orchestration creates one collector
 * per request so concurrent calls cannot mix tokens/costs/timings.
 */
export class UsageCollector {
  private readonly records: UsageRecord[] = [];

  clear(): void {
    this.records.length = 0;
  }

  record(input: UsageRecordInput): UsageRecord {
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
    this.records.push(record);
    return record;
  }

  snapshot(): readonly UsageRecord[] {
    return [...this.records];
  }

  summary(): UsageSummary {
    const operations = this.snapshot().map((r) => ({
      operation: r.operation,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      totalTokens: r.totalTokens,
      durationMs: r.durationMs,
      estimatedCostUsd: r.estimatedCostUsd,
      ...(r.errorClass !== undefined ? { errorClass: r.errorClass } : {}),
    }));
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let durationMs = 0;
    let estimatedCostUsd: number | null = 0;
    let pricingIncomplete = false;
    for (const r of operations) {
      inputTokens += r.inputTokens;
      outputTokens += r.outputTokens;
      totalTokens += r.totalTokens;
      durationMs += r.durationMs;
      if (r.estimatedCostUsd === null) {
        estimatedCostUsd = null;
        pricingIncomplete = true;
      } else if (estimatedCostUsd !== null) {
        estimatedCostUsd += r.estimatedCostUsd;
      }
    }
    return {
      operations,
      totals: {
        inputTokens,
        outputTokens,
        totalTokens,
        durationMs,
        estimatedCostUsd,
        pricingIncomplete,
      },
    };
  }
}

export type UsageSummary = {
  operations: Array<{
    operation: LlmOperation;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    durationMs: number;
    estimatedCostUsd: number | null;
    errorClass?: LlmErrorClass;
  }>;
  totals: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    durationMs: number;
    estimatedCostUsd: number | null;
    pricingIncomplete: boolean;
  };
};
