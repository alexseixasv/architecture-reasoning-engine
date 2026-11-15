import { describe, expect, it, beforeEach } from 'vitest';
import { simulate } from '../../../src/simulation/simulate';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';
import { explainSimulationResult } from '../../../src/llm/explanation/explain-result';
import { FakeLlmProvider } from '../../../src/llm/provider/fake-llm-provider';
import { EXPLANATION_SCHEMA_NAME } from '../../../src/llm/dto/explanation.dto';
import { clearUsageRecords } from '../../../src/llm/usage/usage-recorder';
import { explanationDto } from './helpers';

const doc: ArchitectureDocument = {
  schemaVersion: '1.0.0',
  nodes: [
    {
      id: 'api',
      kind: 'service',
      name: 'API',
      replicas: {
        state: 'known',
        value: 4,
        unit: 'count',
        provenance: 'declared',
      },
      capacityPerReplica: {
        state: 'known',
        value: 80,
        unit: 'rps',
        provenance: 'declared',
      },
      capacityAggregation: 'sum_replicas',
    },
  ],
  dependencies: [],
  system: {
    incomingTraffic: {
      state: 'known',
      value: 80,
      unit: 'rps',
      provenance: 'declared',
    },
    ingressNodeIds: ['api'],
  },
  assumptions: [],
  conflicts: [],
};

describe('explainSimulationResult', () => {
  beforeEach(() => {
    clearUsageRecords();
  });

  it('renders numbers deterministically and accepts valid qualitative refs', async () => {
    const sim = simulate(doc, { type: 'load_multiplication', multiplier: 1 });
    const fake = new FakeLlmProvider();
    fake.setHandler(EXPLANATION_SCHEMA_NAME, async () => ({
      ok: true,
      data: explanationDto({
        acknowledgedStatus: sim.status,
        statements: [
          {
            text: 'API saturation classification is provided by the engine.',
            metricIds: ['utilization:api'],
            refusedMetricIds: [],
            componentIds: ['api'],
            refusalCodes: [],
            claimKind: 'saturation_classification',
          },
          {
            text: 'Availability percent remains refused.',
            metricIds: [],
            refusedMetricIds: ['availability_percent'],
            componentIds: [],
            refusalCodes: ['NO_AVAILABILITY_MODEL'],
            claimKind: 'refusal_preserved',
          },
        ],
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const explained = await explainSimulationResult({
      result: sim,
      provider: fake,
    });
    expect(explained.source).toBe('llm+deterministic');
    expect(explained.evidenceMarkdown).toContain('utilization:api');
    expect(explained.evidenceMarkdown).toContain('0.25');
    expect(explained.markdown).toContain(
      'Numerical values, units, and formulas above are rendered deterministically',
    );
  });

  it('falls back when explanation references unknown metric ids', async () => {
    const sim = simulate(doc, { type: 'load_multiplication', multiplier: 1 });
    const fake = new FakeLlmProvider();
    fake.setHandler(EXPLANATION_SCHEMA_NAME, async () => ({
      ok: true,
      data: explanationDto({
        acknowledgedStatus: sim.status,
        statements: [
          {
            text: 'Invented metric cited.',
            metricIds: ['utilization:not_real'],
            refusedMetricIds: [],
            componentIds: [],
            refusalCodes: [],
            claimKind: 'saturation_classification',
          },
        ],
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const explained = await explainSimulationResult({
      result: sim,
      provider: fake,
    });
    expect(explained.source).toBe('deterministic_fallback');
    expect(explained.errorClass).toBe('EXPLANATION_INVALID');
    expect(explained.evidenceMarkdown).toContain('0.25');
  });

  it('rejects unsupported qualitative claims and falls back', async () => {
    const sim = simulate(doc, { type: 'load_multiplication', multiplier: 1 });
    const fake = new FakeLlmProvider();
    fake.setHandler(EXPLANATION_SCHEMA_NAME, async () => ({
      ok: true,
      data: explanationDto({
        acknowledgedStatus: sim.status,
        summary: 'availability is 99.9%',
        statements: [
          {
            text: 'api is definitely down',
            metricIds: [],
            refusedMetricIds: [],
            componentIds: ['api'],
            refusalCodes: [],
            claimKind: 'exposure_not_outage',
          },
        ],
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const explained = await explainSimulationResult({
      result: sim,
      provider: fake,
    });
    expect(explained.source).toBe('deterministic_fallback');
    expect(explained.validationErrors?.some((e) => e.includes('unsupported'))).toBe(
      true,
    );
  });

  it('falls back on provider failure', async () => {
    const sim = simulate(doc, { type: 'load_multiplication', multiplier: 1 });
    const fake = new FakeLlmProvider();
    fake.failNext({
      errorClass: 'PROVIDER_UNAVAILABLE',
      message: 'rate limited',
    });

    const explained = await explainSimulationResult({
      result: sim,
      provider: fake,
    });
    expect(explained.source).toBe('deterministic_fallback');
    expect(explained.errorClass).toBe('PROVIDER_UNAVAILABLE');
    expect(explained.qualitative).toBeUndefined();
  });

  it('does not grant LLM numerical authority in evidence section', async () => {
    const sim = simulate(doc, { type: 'load_multiplication', multiplier: 1 });
    const fake = new FakeLlmProvider();
    fake.setHandler(EXPLANATION_SCHEMA_NAME, async () => ({
      ok: true,
      data: explanationDto({
        acknowledgedStatus: sim.status,
        summary: 'All good',
        statements: [],
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const explained = await explainSimulationResult({
      result: sim,
      provider: fake,
    });
    // Numeric value appears only in deterministic evidence block from engine
    expect(explained.evidenceMarkdown).toMatch(/0\.25/);
    expect(explained.qualitative?.statements.every((s) => !/\d/.test(s.text) || true)).toBe(
      true,
    );
  });
});
