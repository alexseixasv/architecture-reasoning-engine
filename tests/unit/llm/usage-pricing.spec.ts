import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearUsageRecords,
  projectCostPer1000Analyses,
  recordUsage,
} from '../../../src/llm/usage/usage-recorder';
import { estimateCostUsd, lookupPricing } from '../../../src/llm/usage/pricing';

describe('usage and pricing', () => {
  beforeEach(() => {
    clearUsageRecords();
  });

  it('estimates gpt-4.1 cost from documented rates', () => {
    const pricing = lookupPricing('gpt-4.1');
    expect(pricing?.pricingDate).toBe('2026-11-15');
    const est = estimateCostUsd({
      model: 'gpt-4.1',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(est.estimatedCostUsd).toBe(10); // 2 + 8
  });

  it('returns null cost for unknown models (never assume zero)', () => {
    const est = estimateCostUsd({
      model: 'totally-unknown-model',
      inputTokens: 100,
      outputTokens: 100,
    });
    expect(est.estimatedCostUsd).toBeNull();
    expect(est.pricingDate).toBeNull();
  });

  it('projects cost per 1000 complete analyses as sum of three operations', () => {
    recordUsage({
      operation: 'extract_architecture',
      model: 'gpt-4.1',
      inputTokens: 1000,
      outputTokens: 500,
      durationMs: 10,
    });
    recordUsage({
      operation: 'extract_scenario',
      model: 'gpt-4.1',
      inputTokens: 200,
      outputTokens: 100,
      durationMs: 5,
    });
    recordUsage({
      operation: 'explain',
      model: 'gpt-4.1',
      inputTokens: 300,
      outputTokens: 200,
      durationMs: 5,
    });

    const proj = projectCostPer1000Analyses();
    expect(proj.sampleCompleteAnalyses).toBe(1);
    expect(proj.pricingIncomplete).toBe(false);
    expect(proj.projectedCostPer1000AnalysesUsd).not.toBeNull();
    // Single call ≠ complete analysis: projection uses all three ops
    expect(proj.projectedCostPer1000AnalysesUsd!).toBeGreaterThan(0);
  });
});
