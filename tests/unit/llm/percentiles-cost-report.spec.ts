import { describe, expect, it } from 'vitest';
import { projectEvaluationCosts } from '../../../src/llm/eval/cost-projections';
import {
  percentile,
  summarizeLatencies,
} from '../../../src/llm/eval/percentiles';
import {
  aggregateCaseRecords,
  classifyPipelineFailure,
  emptyLatency,
} from '../../../src/llm/eval/score-report';
import type { UsageRecord } from '../../../src/llm/usage/usage-recorder';

function priced(
  operation: UsageRecord['operation'],
  usd: number,
): UsageRecord {
  return {
    operation,
    model: 'gpt-4.1',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    durationMs: 10,
    estimatedCostUsd: usd,
    pricingDate: '2026-11-15',
    at: new Date().toISOString(),
  };
}

describe('percentiles', () => {
  it('computes p50/p95 with linear interpolation', () => {
    const samples = [10, 20, 30, 40, 50];
    expect(percentile(samples, 50)).toBe(30);
    expect(percentile(samples, 95)).toBeCloseTo(48, 5);
    const summary = summarizeLatencies(samples);
    expect(summary.sampleSize).toBe(5);
    expect(summary.method).toBe('linear_interpolation_inclusive');
    expect(summary.p50Ms).toBe(30);
  });

  it('returns nulls for empty samples', () => {
    expect(percentile([], 50)).toBeNull();
    expect(summarizeLatencies([]).p95Ms).toBeNull();
  });
});

describe('cost projections A/B/C', () => {
  it('projects full, persisted, and early-terminal buckets', () => {
    const sample = [
      priced('extract_architecture', 0.01),
      priced('extract_scenario', 0.002),
      priced('explain', 0.005),
    ];
    const proj = projectEvaluationCosts(sample);
    expect(proj.fullAnalysis.projectedPer1000Usd).toBeCloseTo(17, 5);
    expect(proj.persistedArchitectureAnalysis.projectedPer1000Usd).toBeCloseTo(
      7,
      5,
    );
    expect(proj.earlyTerminal.projectedPer1000Usd).toBeCloseTo(2, 5);
    expect(proj.fullAnalysis.pricingIncomplete).toBe(false);
  });

  it('returns null when pricing incomplete', () => {
    const sample: UsageRecord[] = [
      {
        ...priced('extract_architecture', 0.01),
        estimatedCostUsd: null,
        pricingDate: null,
        model: 'unknown-model',
      },
    ];
    const proj = projectEvaluationCosts(sample);
    expect(proj.fullAnalysis.projectedPer1000Usd).toBeNull();
    expect(proj.fullAnalysis.pricingIncomplete).toBe(true);
  });
});

describe('score-report aggregation', () => {
  it('classifies scenario failure as extraction not engine', () => {
    expect(
      classifyPipelineFailure({
        architectureOk: true,
        scenarioOverallOk: false,
        simulationRan: false,
        simulationMatchedExpected: null,
      }),
    ).toBe('scenario_extraction');
  });

  it('aggregates explanation quality rates', () => {
    const report = aggregateCaseRecords(
      [
        {
          caseId: 'V01',
          pipelineFailureClass: 'none',
          explanationSource: 'llm+deterministic',
          explanationValidationOk: true,
          invalidReferenceCount: 0,
          unsupportedNumericClaimRejections: 0,
          scenarioCompare: {
            intentMatch: true,
            parameterMatch: true,
            overallMatch: true,
            expectedIntent: 'load_multiplication',
            actualIntent: 'load_multiplication',
            details: [],
          },
        },
        {
          caseId: 'V02',
          pipelineFailureClass: 'explanation',
          explanationSource: 'deterministic_fallback',
          explanationValidationOk: false,
          invalidReferenceCount: 2,
          unsupportedNumericClaimRejections: 1,
          scenarioCompare: {
            intentMatch: true,
            parameterMatch: true,
            overallMatch: true,
            expectedIntent: 'load_multiplication',
            actualIntent: 'load_multiplication',
            details: [],
          },
        },
      ],
      {
        fullAnalysis: {
          label: 'A',
          operations: [],
          sampleCount: 0,
          meanEstimatedUsd: null,
          projectedPer1000Usd: null,
          pricingIncomplete: true,
          assumptions: [],
        },
        persistedArchitectureAnalysis: {
          label: 'B',
          operations: [],
          sampleCount: 0,
          meanEstimatedUsd: null,
          projectedPer1000Usd: null,
          pricingIncomplete: true,
          assumptions: [],
        },
        earlyTerminal: {
          label: 'C',
          operations: [],
          sampleCount: 0,
          meanEstimatedUsd: null,
          projectedPer1000Usd: null,
          pricingIncomplete: true,
          assumptions: [],
        },
        note: 'test',
      },
      {
        extractArchitecture: emptyLatency(),
        extractScenario: emptyLatency(),
        simulate: emptyLatency(),
        explain: emptyLatency(),
        totalWall: emptyLatency(),
      },
      'NOT_RUN',
    );
    expect(report.explanation.evaluated).toBe(2);
    expect(report.explanation.fallbackRate).toBe(0.5);
    expect(report.explanation.invalidReferenceCount).toBe(2);
    expect(report.liveStatus).toBe('NOT_RUN');
  });
});
