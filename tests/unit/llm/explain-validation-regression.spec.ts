import { describe, expect, it } from 'vitest';
import { validateExplanationDto } from '../../../src/llm/explanation/validate-explanation';
import type { EvidencePacket } from '../../../src/llm/explanation/render-evidence';
import type { ExplanationDto } from '../../../src/llm/dto/explanation.dto';

const packet: EvidencePacket = {
  status: 'ANSWERED',
  metricIds: [
    'scenario_offered_traffic',
    'node_offered_load:api',
    'utilization:api',
  ],
  refusedMetricIds: [
    'availability_percent',
    'latency_p95_p99',
    'throughput',
  ],
  componentIds: ['api'],
  refusalCodes: [
    'NO_AVAILABILITY_MODEL',
    'NO_THROUGHPUT_MODEL',
    'NO_LATENCY_DISTRIBUTION',
  ],
  metrics: [],
  refused: [],
  impacts: [],
  saturations: [],
  assumptions: [],
  warnings: [],
  propagationPaths: [],
};

describe('explanation validation regressions (live smoke)', () => {
  it('allows discussing refused p95/p99 without inventing numeric percentiles', () => {
    const dto: ExplanationDto = {
      summary:
        'Engine answered the load scenario. Percentile latency remains refused.',
      acknowledgedStatus: 'ANSWERED',
      statements: [
        {
          text: 'p95 and p99 distributions are refused by the engine.',
          metricIds: [],
          refusedMetricIds: ['latency_p95_p99'],
          componentIds: [],
          refusalCodes: ['NO_LATENCY_DISTRIBUTION'],
          claimKind: 'refusal_preserved',
        },
        {
          text: 'Saturation classification is available via utilization:api.',
          metricIds: ['utilization:api'],
          refusedMetricIds: [],
          componentIds: ['api'],
          refusalCodes: [],
          claimKind: 'saturation_classification',
        },
      ],
    };
    // Sanitized representation of a previously over-rejected live-style output
    expect(validateExplanationDto(dto, packet)).toEqual({ ok: true });
  });

  it('still rejects invented numeric p95 claims', () => {
    const dto: ExplanationDto = {
      summary: 'Latency looks fine.',
      acknowledgedStatus: 'ANSWERED',
      statements: [
        {
          text: 'p95 is 42',
          metricIds: [],
          refusedMetricIds: [],
          componentIds: ['api'],
          refusalCodes: [],
          claimKind: 'general',
        },
      ],
    };
    const result = validateExplanationDto(dto, packet);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.reasons.some((r) => r.includes('invented_percentile')),
      ).toBe(true);
    }
  });

  it('rejects free-text digits outside metric-id tokens', () => {
    const dto: ExplanationDto = {
      summary: 'Utilization is about one quarter.',
      acknowledgedStatus: 'ANSWERED',
      statements: [
        {
          text: 'U equals 0.25 for api',
          metricIds: ['utilization:api'],
          refusedMetricIds: [],
          componentIds: ['api'],
          refusalCodes: [],
          claimKind: 'saturation_classification',
        },
      ],
    };
    const result = validateExplanationDto(dto, packet);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.reasons.some((r) => r.includes('invented_numeric_result')),
      ).toBe(true);
    }
  });
});
