import { describe, expect, it, beforeEach } from 'vitest';
import { ARCHITECTURE_EXTRACTION_SCHEMA_NAME } from '../../../src/llm/dto/architecture-extraction.dto';
import { extractArchitecture } from '../../../src/llm/extraction/extract-architecture';
import { FakeLlmProvider } from '../../../src/llm/provider/fake-llm-provider';
import { ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT } from '../../../src/llm/prompts/architecture';
import { clearUsageRecords } from '../../../src/llm/usage/usage-recorder';
import { declared, omitted } from './helpers';

describe('conflict preservation (field vs document)', () => {
  beforeEach(() => {
    clearUsageRecords();
  });

  it('prompt requires fieldConflicts for same-node contradictions and preserves documentConflicts', () => {
    expect(ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /node\.fieldConflicts/i,
    );
    expect(ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT).toMatch(/documentConflicts/);
    expect(ARCHITECTURE_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /Never silently discard a legitimate conflict/i,
    );
  });

  it('preserves conflicting replica counts at field level with verified excerpts', async () => {
    const text =
      'Fulfillment Worker is described as both 2 replicas and 5 instances, each at 40 rps. Baseline 60 rps.';
    const fake = new FakeLlmProvider();
    fake.setHandler(ARCHITECTURE_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: {
        name: 'fulfillment',
        description: '',
        nodes: [
          {
            id: 'fulfillment_worker',
            kind: 'service' as const,
            name: 'Fulfillment Worker',
            replicas: declared(2, 'count', '2 replicas'),
            capacityPerReplica: declared(40, 'rps', '40 rps'),
            capacityAggregation: 'sum_replicas' as const,
            declaredLatency: omitted(),
            fieldConflicts: [
              {
                field: 'replicas',
                note: 'contradictory replica declarations',
                candidates: [
                  {
                    value: 2,
                    unit: 'count' as const,
                    sourceExcerpt: '2 replicas',
                  },
                  {
                    value: 5,
                    unit: 'count' as const,
                    sourceExcerpt: '5 instances',
                  },
                ],
              },
            ],
          },
        ],
        dependencies: [],
        incomingTraffic: declared(60, 'rps', '60 rps'),
        availabilityTarget: omitted(),
        ingressNodeIds: ['fulfillment_worker'],
        ingressDeclared: true,
        documentConflicts: [],
        clarificationQuestions: [],
        notes: [],
      },
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const result = await extractArchitecture({
      architectureText: text,
      provider: fake,
    });
    expect(result.status).toBe('PROPOSED');
    if (result.status !== 'PROPOSED') {
      return;
    }
    const fc = result.document.nodes[0]?.fieldConflicts;
    expect(fc).toHaveLength(1);
    expect(fc?.[0]?.field).toBe('replicas');
    expect(fc?.[0]?.candidates).toHaveLength(2);
    expect(fc?.[0]?.candidates.every((c) => c.state === 'known')).toBe(true);
    expect(result.document.conflicts).toHaveLength(0);
  });

  it('preserves legitimate document-level conflicts when emitted', async () => {
    const text =
      'Region A says Cache Tier has 10 replicas. Region B says Cache Tier has 3 replicas.';
    const fake = new FakeLlmProvider();
    fake.setHandler(ARCHITECTURE_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: {
        name: 'cache',
        description: '',
        nodes: [
          {
            id: 'cache_tier',
            kind: 'service' as const,
            name: 'Cache Tier',
            replicas: omitted(),
            capacityPerReplica: omitted(),
            capacityAggregation: 'omitted' as const,
            declaredLatency: omitted(),
            fieldConflicts: [],
          },
        ],
        dependencies: [],
        incomingTraffic: omitted(),
        availabilityTarget: omitted(),
        ingressNodeIds: [],
        ingressDeclared: false,
        documentConflicts: [
          {
            id: 'cache_replicas_regions',
            description: 'Region A vs Region B replica counts',
            nodeIds: ['cache_tier'],
            field: 'replicas',
            candidates: [
              {
                value: 10,
                unit: 'count' as const,
                sourceExcerpt: '10 replicas',
              },
              {
                value: 3,
                unit: 'count' as const,
                sourceExcerpt: '3 replicas',
              },
            ],
          },
        ],
        clarificationQuestions: [],
        notes: [],
      },
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const result = await extractArchitecture({
      architectureText: text,
      provider: fake,
    });
    expect(result.status).toBe('PROPOSED');
    if (result.status !== 'PROPOSED') {
      return;
    }
    expect(result.document.conflicts).toHaveLength(1);
    expect(result.document.conflicts[0]?.candidates).toHaveLength(2);
    expect(
      result.document.conflicts[0]?.candidates.every((c) => c.state === 'known'),
    ).toBe(true);
  });
});
