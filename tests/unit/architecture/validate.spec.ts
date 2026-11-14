import { describe, expect, it } from 'vitest';
import { validateArchitectureDocument } from '../../../src/architecture/application/validate';
import { FINDING_PERSISTENCE_POLICY } from '../../../src/architecture/domain/findings';
import { checkoutPricingDocument } from '../../fixtures/architectures/checkout-pricing';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';

function baseDoc(
  overrides: Partial<ArchitectureDocument> = {},
): ArchitectureDocument {
  return {
    schemaVersion: '1.0.0',
    nodes: [
      {
        id: 'a',
        kind: 'service',
        name: 'A',
        replicas: { state: 'known', value: 2, unit: 'count', provenance: 'declared' },
        capacityPerReplica: {
          state: 'known',
          value: 10,
          unit: 'rps',
          provenance: 'declared',
        },
        capacityAggregation: 'sum_replicas',
      },
      {
        id: 'b',
        kind: 'service',
        name: 'B',
        replicas: { state: 'known', value: 2, unit: 'count', provenance: 'declared' },
        capacityPerReplica: {
          state: 'known',
          value: 10,
          unit: 'rps',
          provenance: 'declared',
        },
        capacityAggregation: 'sum_replicas',
      },
    ],
    dependencies: [
      {
        id: 'a-b',
        from: 'a',
        to: 'b',
        communication: 'sync',
        timeout: { state: 'known', value: 1000, unit: 'ms', provenance: 'declared' },
      },
    ],
    system: {
      incomingTraffic: {
        state: 'known',
        value: 5,
        unit: 'rps',
        provenance: 'declared',
      },
    },
    assumptions: [],
    conflicts: [],
    ...overrides,
  };
}

describe('validateArchitectureDocument', () => {
  it('accepts a well-formed document', () => {
    const result = validateArchitectureDocument(baseDoc());
    expect(result.canPersist).toBe(true);
    expect(result.document).toBeDefined();
  });

  it('rejects unknown keys (schema)', () => {
    const result = validateArchitectureDocument({
      ...baseDoc(),
      extra: true,
    });
    expect(result.canPersist).toBe(false);
    expect(result.findings.some((f) => f.code === 'SCHEMA_INVALID')).toBe(true);
  });

  it('rejects duplicate ids', () => {
    const result = validateArchitectureDocument(
      baseDoc({
        nodes: [
          {
            id: 'a',
            kind: 'service',
            name: 'A',
          },
          {
            id: 'a',
            kind: 'service',
            name: 'A2',
          },
        ],
        dependencies: [],
      }),
    );
    expect(result.canPersist).toBe(false);
    expect(result.findings.some((f) => f.code === 'DUPLICATE_ID')).toBe(true);
  });

  it('rejects missing node references', () => {
    const result = validateArchitectureDocument(
      baseDoc({
        dependencies: [
          {
            id: 'bad',
            from: 'a',
            to: 'missing',
            communication: 'sync',
            timeout: {
              state: 'known',
              value: 100,
              unit: 'ms',
              provenance: 'declared',
            },
          },
        ],
      }),
    );
    expect(result.canPersist).toBe(false);
    expect(result.findings.some((f) => f.code === 'MISSING_NODE_REF')).toBe(
      true,
    );
  });

  it('rejects graphs larger than 15 nodes', () => {
    const nodes = Array.from({ length: 16 }, (_, i) => ({
      id: `n${i}`,
      kind: 'service' as const,
      name: `N${i}`,
    }));
    const result = validateArchitectureDocument(
      baseDoc({ nodes, dependencies: [] }),
    );
    expect(result.canPersist).toBe(false);
    expect(result.findings.some((f) => f.code === 'GRAPH_TOO_LARGE')).toBe(
      true,
    );
  });

  it('reports sync cycle as WARNING and still allows persist', () => {
    const result = validateArchitectureDocument(
      baseDoc({
        dependencies: [
          {
            id: 'a-b',
            from: 'a',
            to: 'b',
            communication: 'sync',
            timeout: {
              state: 'known',
              value: 100,
              unit: 'ms',
              provenance: 'declared',
            },
          },
          {
            id: 'b-a',
            from: 'b',
            to: 'a',
            communication: 'sync',
            timeout: {
              state: 'known',
              value: 100,
              unit: 'ms',
              provenance: 'declared',
            },
          },
        ],
      }),
    );
    const cycle = result.findings.find((f) => f.code === 'SYNC_CYCLE');
    expect(cycle?.severity).toBe('WARNING');
    expect(cycle?.persistenceEffect).toBe('allow');
    expect(result.canPersist).toBe(true);
  });

  it('reports missing sync timeout as WARNING without blocking persist', () => {
    const result = validateArchitectureDocument(
      baseDoc({
        dependencies: [
          {
            id: 'a-b',
            from: 'a',
            to: 'b',
            communication: 'sync',
          },
        ],
      }),
    );
    const finding = result.findings.find(
      (f) => f.code === 'SYNC_MISSING_TIMEOUT',
    );
    expect(finding?.severity).toBe('WARNING');
    expect(result.canPersist).toBe(true);
  });

  it('reports retry without backoff as WARNING without blocking persist', () => {
    const result = validateArchitectureDocument(
      baseDoc({
        dependencies: [
          {
            id: 'a-b',
            from: 'a',
            to: 'b',
            communication: 'sync',
            timeout: {
              state: 'known',
              value: 100,
              unit: 'ms',
              provenance: 'declared',
            },
            retry: {
              additionalAttempts: {
                state: 'known',
                value: 3,
                unit: 'count',
                provenance: 'declared',
              },
              backoff: { type: 'none' },
            },
          },
        ],
      }),
    );
    expect(
      result.findings.some((f) => f.code === 'RETRY_WITHOUT_BACKOFF'),
    ).toBe(true);
    expect(result.canPersist).toBe(true);
  });

  it('preserves contradictory evidence and allows persist', () => {
    const result = validateArchitectureDocument(checkoutPricingDocument);
    expect(result.canPersist).toBe(true);
    expect(result.document?.conflicts).toHaveLength(1);
    expect(result.document?.nodes.find((n) => n.id === 'pricing')?.fieldConflicts).toHaveLength(1);
    expect(
      result.findings.some((f) => f.code === 'CONTRADICTION_PRESENT'),
    ).toBe(true);
    expect(result.findings.some((f) => f.code === 'SPOF')).toBe(true);
  });

  it('documents persistence policy map for key codes', () => {
    expect(FINDING_PERSISTENCE_POLICY.SYNC_CYCLE).toBe('allow');
    expect(FINDING_PERSISTENCE_POLICY.DUPLICATE_ID).toBe('reject');
    expect(FINDING_PERSISTENCE_POLICY.MISSING_CAPACITY).toBe('allow');
  });

  it('does not silently default omitted numeric quantities', () => {
    const result = validateArchitectureDocument({
      schemaVersion: '1.0.0',
      nodes: [
        { id: 'svc', kind: 'service', name: 'Svc' },
        { id: 'db', kind: 'datastore', name: 'DB' },
      ],
      dependencies: [
        {
          id: 'svc-db',
          from: 'svc',
          to: 'db',
          communication: 'sync',
        },
      ],
    });

    expect(result.canPersist).toBe(true);
    const svc = result.document?.nodes.find((n) => n.id === 'svc');
    expect(svc?.replicas).toBeUndefined();
    expect(svc?.capacityPerReplica).toBeUndefined();
    expect(svc?.capacityAggregation).toBeUndefined();
    expect(svc?.declaredLatency).toBeUndefined();
    expect(result.document?.dependencies[0]?.timeout).toBeUndefined();
    expect(result.document?.system?.incomingTraffic).toBeUndefined();
    expect(
      result.findings.some((f) => f.code === 'MISSING_CAPACITY'),
    ).toBe(true);
    expect(
      result.findings.some((f) => f.code === 'MISSING_BASELINE_TRAFFIC'),
    ).toBe(true);
    expect(
      result.findings.some((f) => f.code === 'SYNC_MISSING_TIMEOUT'),
    ).toBe(true);
  });
});

