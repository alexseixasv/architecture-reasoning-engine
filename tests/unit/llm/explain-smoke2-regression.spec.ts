import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { architectureDocumentSchema } from '../../../src/architecture/domain/schema';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';
import { EXPLANATION_SCHEMA_NAME } from '../../../src/llm/dto/explanation.dto';
import type { ExplanationDto } from '../../../src/llm/dto/explanation.dto';
import { explainSimulationResult } from '../../../src/llm/explanation/explain-result';
import { buildEvidencePacket } from '../../../src/llm/explanation/render-evidence';
import { validateExplanationDto } from '../../../src/llm/explanation/validate-explanation';
import { FakeLlmProvider } from '../../../src/llm/provider/fake-llm-provider';
import { clearUsageRecords } from '../../../src/llm/usage/usage-recorder';
import { simulate } from '../../../src/simulation/simulate';

/**
 * Reproduces live smoke #2 simulation evidence and explanation failure mode.
 * Smoke #2: load_multiplication ×1 on V01 formal model → ANSWERED with standing refusals.
 */
function v01Smoke2Result() {
  const formal = architectureDocumentSchema.parse(
    JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'tests',
          'validation',
          'V01_capacity_sum',
          'formal_model.json',
        ),
        'utf8',
      ),
    ),
  ) as ArchitectureDocument;
  return simulate(formal, { type: 'load_multiplication', multiplier: 1 });
}

describe('explanation contract — smoke #2 refused-metric misclassification', () => {
  beforeEach(() => {
    clearUsageRecords();
  });

  it('exposes calculated vs refused ids distinctly for the smoke #2 simulation', () => {
    const result = v01Smoke2Result();
    expect(result.status).toBe('ANSWERED');
    const packet = buildEvidencePacket(result);

    expect(packet.metricIds).toEqual(
      expect.arrayContaining([
        'scenario_offered_traffic',
        'node_offered_load:api',
        'utilization:api',
      ]),
    );
    expect(packet.refusedMetricIds).toEqual(
      expect.arrayContaining([
        'availability_percent',
        'latency_p95_p99',
        'throughput',
      ]),
    );
    expect(packet.refusalCodes).toEqual(
      expect.arrayContaining([
        'NO_AVAILABILITY_MODEL',
        'NO_LATENCY_DISTRIBUTION',
        'NO_THROUGHPUT_MODEL',
      ]),
    );
    // Disjoint roles
    for (const id of packet.refusedMetricIds) {
      expect(packet.metricIds).not.toContain(id);
    }
  });

  it('A rejects refused metric IDs placed in metricIds (exact smoke #2 failure)', () => {
    const packet = buildEvidencePacket(v01Smoke2Result());
    const bad: ExplanationDto = {
      summary: 'Engine answered; some outputs unavailable.',
      acknowledgedStatus: 'ANSWERED',
      statements: [
        {
          text: 'Utilization is calculated.',
          metricIds: ['utilization:api'],
          refusedMetricIds: [],
          componentIds: ['api'],
          refusalCodes: [],
          claimKind: 'saturation_classification',
        },
        {
          text: 'Availability percent was discussed.',
          metricIds: ['availability_percent'],
          refusedMetricIds: [],
          componentIds: [],
          refusalCodes: [],
          claimKind: 'refusal_preserved',
        },
        {
          text: 'Latency percentiles were discussed.',
          metricIds: ['latency_p95_p99'],
          refusedMetricIds: [],
          componentIds: [],
          refusalCodes: [],
          claimKind: 'refusal_preserved',
        },
        {
          text: 'Throughput was discussed.',
          metricIds: ['throughput'],
          refusedMetricIds: [],
          componentIds: [],
          refusalCodes: [],
          claimKind: 'refusal_preserved',
        },
      ],
    };
    const validation = validateExplanationDto(bad, packet);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(
        validation.reasons.some((r) =>
          r.includes(
            'refused metric "availability_percent" presented as calculated metricId',
          ),
        ),
      ).toBe(true);
      expect(
        validation.reasons.some((r) =>
          r.includes(
            'refused metric "latency_p95_p99" presented as calculated metricId',
          ),
        ),
      ).toBe(true);
      expect(
        validation.reasons.some((r) =>
          r.includes(
            'refused metric "throughput" presented as calculated metricId',
          ),
        ),
      ).toBe(true);
    }
  });

  it('B accepts the same refused outputs via refusedMetricIds + C validates reason codes', () => {
    const packet = buildEvidencePacket(v01Smoke2Result());
    const good: ExplanationDto = {
      summary: 'Engine answered the baseline load scenario.',
      acknowledgedStatus: 'ANSWERED',
      statements: [
        {
          text: 'Utilization for api is provided by a calculated engine metric.',
          metricIds: ['utilization:api'],
          refusedMetricIds: [],
          componentIds: ['api'],
          refusalCodes: [],
          claimKind: 'saturation_classification',
        },
        {
          text: 'Availability percent was not calculated.',
          metricIds: [],
          refusedMetricIds: ['availability_percent'],
          componentIds: [],
          refusalCodes: ['NO_AVAILABILITY_MODEL'],
          claimKind: 'refusal_preserved',
        },
        {
          text: 'Latency percentiles were not calculated.',
          metricIds: [],
          refusedMetricIds: ['latency_p95_p99'],
          componentIds: [],
          refusalCodes: ['NO_LATENCY_DISTRIBUTION'],
          claimKind: 'refusal_preserved',
        },
        {
          text: 'Throughput was not calculated.',
          metricIds: [],
          refusedMetricIds: ['throughput'],
          componentIds: [],
          refusalCodes: ['NO_THROUGHPUT_MODEL'],
          claimKind: 'refusal_preserved',
        },
      ],
    };
    expect(validateExplanationDto(good, packet)).toEqual({ ok: true });
  });

  it('D valid qualitative explanation passes explainSimulationResult without fallback', async () => {
    const result = v01Smoke2Result();
    const fake = new FakeLlmProvider();
    fake.setHandler(EXPLANATION_SCHEMA_NAME, async () => ({
      ok: true,
      data: {
        summary: 'Engine answered the baseline load scenario.',
        acknowledgedStatus: result.status,
        statements: [
          {
            text: 'Utilization for api is provided by a calculated engine metric.',
            metricIds: ['utilization:api'],
            refusedMetricIds: [],
            componentIds: ['api'],
            refusalCodes: [],
            claimKind: 'saturation_classification' as const,
          },
          {
            text: 'Availability percent was not calculated.',
            metricIds: [],
            refusedMetricIds: ['availability_percent'],
            componentIds: [],
            refusalCodes: ['NO_AVAILABILITY_MODEL'],
            claimKind: 'refusal_preserved' as const,
          },
        ],
      },
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const explained = await explainSimulationResult({
      result,
      provider: fake,
    });
    expect(explained.source).toBe('llm+deterministic');
    expect(explained.errorClass).toBeUndefined();
    expect(explained.evidenceMarkdown).toContain('utilization:api');
  });

  it('E unknown references remain rejected', () => {
    const packet = buildEvidencePacket(v01Smoke2Result());
    const bad: ExplanationDto = {
      summary: 'Engine answered.',
      acknowledgedStatus: 'ANSWERED',
      statements: [
        {
          text: 'Unknown refs.',
          metricIds: ['not_a_real_metric'],
          refusedMetricIds: ['not_a_refused_metric'],
          componentIds: ['ghost'],
          refusalCodes: ['NOT_A_CODE'],
          claimKind: 'general',
        },
      ],
    };
    const validation = validateExplanationDto(bad, packet);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.reasons.some((r) => r.includes('unknown metricId'))).toBe(
        true,
      );
      expect(
        validation.reasons.some((r) => r.includes('unknown refusedMetricId')),
      ).toBe(true);
      expect(
        validation.reasons.some((r) => r.includes('unknown componentId')),
      ).toBe(true);
      expect(
        validation.reasons.some((r) => r.includes('unknown refusalCode')),
      ).toBe(true);
    }
  });
});
