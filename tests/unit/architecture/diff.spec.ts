import { describe, expect, it } from 'vitest';
import { diffDocuments } from '../../../src/architecture/application/diff';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';

const docA: ArchitectureDocument = {
  schemaVersion: '1.0.0',
  nodes: [
    {
      id: 'svc',
      kind: 'service',
      name: 'Service',
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
      id: 'db',
      kind: 'datastore',
      name: 'DB',
      capacityAggregation: 'primary_only',
      capacityPerReplica: {
        state: 'known',
        value: 50,
        unit: 'rps',
        provenance: 'declared',
      },
      replicas: { state: 'known', value: 1, unit: 'count', provenance: 'declared' },
    },
  ],
  dependencies: [
    {
      id: 'svc-db',
      from: 'svc',
      to: 'db',
      communication: 'sync',
      timeout: { state: 'known', value: 200, unit: 'ms', provenance: 'declared' },
    },
  ],
  assumptions: [
    {
      id: 'a1',
      text: 'steady state',
      provenance: 'assumed',
      fieldsAffected: ['system'],
    },
  ],
  conflicts: [],
  system: {
    incomingTraffic: {
      state: 'known',
      value: 5,
      unit: 'rps',
      provenance: 'declared',
    },
  },
};

describe('diffDocuments', () => {
  it('ignores array reordering with identical identities', () => {
    const reordered: ArchitectureDocument = {
      ...docA,
      nodes: [docA.nodes[1]!, docA.nodes[0]!],
      dependencies: [...docA.dependencies],
      assumptions: [...docA.assumptions],
    };

    const diff = diffDocuments(docA, reordered);
    expect(diff.changes).toEqual([]);
  });

  it('detects field-level quantity and provenance changes', () => {
    const changed: ArchitectureDocument = {
      ...docA,
      nodes: [
        {
          ...docA.nodes[0]!,
          replicas: {
            state: 'known',
            value: 4,
            unit: 'count',
            provenance: 'user_confirmed',
          },
        },
        docA.nodes[1]!,
      ],
    };

    const diff = diffDocuments(docA, changed);
    expect(diff.changes.length).toBeGreaterThan(0);
    expect(
      diff.changes.some(
        (c) => c.id === 'svc' && c.path === 'svc.replicas' && c.kind === 'changed',
      ),
    ).toBe(true);
  });

  it('orders changes deterministically', () => {
    const changed: ArchitectureDocument = {
      ...docA,
      name: 'renamed',
      nodes: [
        docA.nodes[0]!,
        {
          ...docA.nodes[1]!,
          name: 'DB-primary',
        },
      ],
      dependencies: [
        {
          ...docA.dependencies[0]!,
          timeout: {
            state: 'known',
            value: 500,
            unit: 'ms',
            provenance: 'declared',
          },
        },
      ],
    };

    const first = diffDocuments(docA, changed).changes;
    const second = diffDocuments(docA, changed).changes;
    expect(first).toEqual(second);

    const keys = first.map((c) => `${c.entityType}|${c.id}|${c.path}|${c.kind}`);
    expect(keys).toEqual([...keys].sort());
  });
});
