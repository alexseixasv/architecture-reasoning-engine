import { describe, expect, it } from 'vitest';
import { nominalCapacityRps } from '../../../src/architecture/application/validate';
import type { ArchitectureNode } from '../../../src/architecture/domain/types';

describe('nominalCapacityRps', () => {
  it('sums replicas only when policy is sum_replicas', () => {
    const node: ArchitectureNode = {
      id: 'svc',
      kind: 'service',
      name: 'Svc',
      replicas: { state: 'known', value: 4, unit: 'count', provenance: 'declared' },
      capacityPerReplica: {
        state: 'known',
        value: 80,
        unit: 'rps',
        provenance: 'declared',
      },
      capacityAggregation: 'sum_replicas',
    };
    expect(nominalCapacityRps(node)).toEqual({ status: 'ok', value: 320 });
  });

  it('uses primary_only without multiplying replicas (e.g. DB writes)', () => {
    const node: ArchitectureNode = {
      id: 'pg',
      kind: 'datastore',
      name: 'Postgres',
      replicas: { state: 'known', value: 3, unit: 'count', provenance: 'declared' },
      capacityPerReplica: {
        state: 'known',
        value: 200,
        unit: 'rps',
        provenance: 'declared',
      },
      capacityAggregation: 'primary_only',
    };
    expect(nominalCapacityRps(node)).toEqual({ status: 'ok', value: 200 });
  });

  it('refuses when aggregation is unknown or missing', () => {
    const node: ArchitectureNode = {
      id: 'pg',
      kind: 'datastore',
      name: 'Postgres',
      replicas: { state: 'known', value: 3, unit: 'count', provenance: 'declared' },
      capacityPerReplica: {
        state: 'known',
        value: 200,
        unit: 'rps',
        provenance: 'declared',
      },
      capacityAggregation: 'unknown',
    };
    expect(nominalCapacityRps(node).status).toBe('not_answerable');
  });
});
