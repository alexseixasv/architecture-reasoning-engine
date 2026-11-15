import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';
import { simulate } from '../../../src/simulation/simulate';

function qty<U extends 'rps' | 'ms' | 'count' | 'ratio' | 'percent'>(
  value: number,
  unit: U,
): {
  state: 'known';
  value: number;
  unit: U;
  provenance: 'declared';
} {
  return {
    state: 'known',
    value,
    unit,
    provenance: 'declared',
  };
}

/** Gateway fans to A and B; both call shared DB — multi-path accumulation. */
function sharedDatastoreDoc(): ArchitectureDocument {
  return {
    schemaVersion: '1.0.0',
    nodes: [
      {
        id: 'gateway',
        kind: 'service',
        name: 'Gateway',
        replicas: qty(2, 'count'),
        capacityPerReplica: qty(100, 'rps'),
        capacityAggregation: 'sum_replicas',
      },
      {
        id: 'a',
        kind: 'service',
        name: 'A',
        replicas: qty(2, 'count'),
        capacityPerReplica: qty(100, 'rps'),
        capacityAggregation: 'sum_replicas',
      },
      {
        id: 'b',
        kind: 'service',
        name: 'B',
        replicas: qty(2, 'count'),
        capacityPerReplica: qty(100, 'rps'),
        capacityAggregation: 'sum_replicas',
      },
      {
        id: 'db',
        kind: 'datastore',
        name: 'DB',
        replicas: qty(3, 'count'),
        capacityPerReplica: qty(50, 'rps'),
        capacityAggregation: 'primary_only',
      },
    ],
    dependencies: [
      {
        id: 'gw-a',
        from: 'gateway',
        to: 'a',
        communication: 'sync',
        timeout: qty(200, 'ms'),
        requestsPerParent: qty(1, 'ratio'),
      },
      {
        id: 'gw-b',
        from: 'gateway',
        to: 'b',
        communication: 'sync',
        timeout: qty(200, 'ms'),
        requestsPerParent: qty(1, 'ratio'),
      },
      {
        id: 'a-db',
        from: 'a',
        to: 'db',
        communication: 'sync',
        timeout: qty(200, 'ms'),
        requestsPerParent: qty(1, 'ratio'),
      },
      {
        id: 'b-db',
        from: 'b',
        to: 'db',
        communication: 'sync',
        timeout: qty(200, 'ms'),
        requestsPerParent: qty(2, 'ratio'),
      },
    ],
    system: {
      incomingTraffic: qty(10, 'rps'),
      ingressNodeIds: ['gateway'],
    },
    assumptions: [],
    conflicts: [],
  };
}

function chainDoc(opts?: {
  missingFanout?: boolean;
  backoff?: 'none' | 'fixed';
  conflictReplicas?: boolean;
}): ArchitectureDocument {
  return {
    schemaVersion: '1.0.0',
    nodes: [
      {
        id: 'checkout',
        kind: 'service',
        name: 'Checkout',
        replicas: qty(6, 'count'),
        capacityPerReplica: qty(80, 'rps'),
        capacityAggregation: 'sum_replicas',
      },
      {
        id: 'pricing',
        kind: 'service',
        name: 'Pricing',
        replicas: qty(4, 'count'),
        capacityPerReplica: qty(80, 'rps'),
        capacityAggregation: 'sum_replicas',
        ...(opts?.conflictReplicas
          ? {
              fieldConflicts: [
                {
                  field: 'replicas',
                  candidates: [qty(4, 'count'), qty(6, 'count')],
                },
              ],
            }
          : {}),
      },
      {
        id: 'postgres',
        kind: 'datastore',
        name: 'Postgres',
        replicas: qty(1, 'count'),
        capacityPerReplica: qty(200, 'rps'),
        capacityAggregation: 'primary_only',
      },
      { id: 'queue', kind: 'queue', name: 'Q' },
      {
        id: 'invoicing',
        kind: 'service',
        name: 'Invoicing',
        replicas: qty(2, 'count'),
        capacityPerReplica: qty(40, 'rps'),
        capacityAggregation: 'sum_replicas',
      },
    ],
    dependencies: [
      {
        id: 'checkout-pricing',
        from: 'checkout',
        to: 'pricing',
        communication: 'sync',
        timeout: qty(2000, 'ms'),
        ...(opts?.missingFanout
          ? {}
          : { requestsPerParent: qty(1, 'ratio') }),
        retry: {
          additionalAttempts: qty(3, 'count'),
          backoff:
            opts?.backoff === 'fixed'
              ? { type: 'fixed', delayMs: qty(100, 'ms') }
              : { type: 'none' },
        },
      },
      {
        id: 'pricing-postgres',
        from: 'pricing',
        to: 'postgres',
        communication: 'sync',
        timeout: qty(2000, 'ms'),
        requestsPerParent: qty(1, 'ratio'),
      },
      {
        id: 'checkout-queue',
        from: 'checkout',
        to: 'queue',
        communication: 'async',
      },
      {
        id: 'queue-invoicing',
        from: 'queue',
        to: 'invoicing',
        communication: 'async',
      },
    ],
    system: {
      incomingTraffic: qty(200, 'rps'),
      ingressNodeIds: ['checkout'],
    },
    assumptions: [],
    conflicts: [],
  };
}

describe('simulate', () => {
  it('1. accumulates load from two services into a shared datastore', () => {
    const result = simulate(sharedDatastoreDoc(), {
      type: 'load_multiplication',
      multiplier: 1,
    });
    // gateway 10; a=10; b=10; a-db=10; b-db=20; db=30
    expect(
      result.metrics.find((m) => m.metricId === 'node_offered_load:a')?.value,
    ).toBe(10);
    expect(
      result.metrics.find((m) => m.metricId === 'node_offered_load:b')?.value,
    ).toBe(10);
    expect(
      result.metrics.find((m) => m.metricId === 'edge_offered_load:a-db')?.value,
    ).toBe(10);
    expect(
      result.metrics.find((m) => m.metricId === 'edge_offered_load:b-db')?.value,
    ).toBe(20);
    expect(
      result.metrics.find((m) => m.metricId === 'node_offered_load:db')?.value,
    ).toBe(30);
    const sat = result.saturations.find((s) => s.componentId === 'db');
    expect(sat?.capacityRps).toBe(50);
    expect(sat?.saturated).toBe(false);
  });

  it('2. refuses exact downstream load when requestsPerParent is missing (not zero)', () => {
    const result = simulate(chainDoc({ missingFanout: true }), {
      type: 'load_multiplication',
      multiplier: 1,
    });
    expect(result.status).toBe('PARTIALLY_ANSWERED');
    expect(
      result.refused.some((r) => r.reasonCode === 'MISSING_REQUESTS_PER_PARENT'),
    ).toBe(true);
    expect(
      result.metrics.find((m) => m.metricId === 'node_offered_load:pricing'),
    ).toBeUndefined();
  });

  it('2b. accumulates 100+50=150 into database; refuses total when one inbound is unknown', () => {
    // Gateway fan-out: λ'=100 → checkout=100, inventory=50 → database=150
    const withGateway: ArchitectureDocument = {
      schemaVersion: '1.0.0',
      nodes: [
        {
          id: 'gateway',
          kind: 'service',
          name: 'Gateway',
          replicas: qty(1, 'count'),
          capacityPerReplica: qty(500, 'rps'),
          capacityAggregation: 'sum_replicas',
        },
        {
          id: 'checkout',
          kind: 'service',
          name: 'Checkout',
          replicas: qty(1, 'count'),
          capacityPerReplica: qty(200, 'rps'),
          capacityAggregation: 'sum_replicas',
        },
        {
          id: 'inventory',
          kind: 'service',
          name: 'Inventory',
          replicas: qty(1, 'count'),
          capacityPerReplica: qty(200, 'rps'),
          capacityAggregation: 'sum_replicas',
        },
        {
          id: 'database',
          kind: 'datastore',
          name: 'Database',
          replicas: qty(1, 'count'),
          capacityPerReplica: qty(500, 'rps'),
          capacityAggregation: 'primary_only',
        },
      ],
      dependencies: [
        {
          id: 'gw-checkout',
          from: 'gateway',
          to: 'checkout',
          communication: 'sync',
          timeout: qty(1000, 'ms'),
          requestsPerParent: qty(1, 'ratio'),
        },
        {
          id: 'gw-inventory',
          from: 'gateway',
          to: 'inventory',
          communication: 'sync',
          timeout: qty(1000, 'ms'),
          requestsPerParent: qty(0.5, 'ratio'),
        },
        {
          id: 'checkout-db',
          from: 'checkout',
          to: 'database',
          communication: 'sync',
          timeout: qty(1000, 'ms'),
          requestsPerParent: qty(1, 'ratio'),
        },
        {
          id: 'inventory-db',
          from: 'inventory',
          to: 'database',
          communication: 'sync',
          timeout: qty(1000, 'ms'),
          requestsPerParent: qty(1, 'ratio'),
        },
      ],
      system: {
        incomingTraffic: qty(100, 'rps'),
        ingressNodeIds: ['gateway'],
      },
      assumptions: [],
      conflicts: [],
    };

    const ok = simulate(withGateway, {
      type: 'load_multiplication',
      multiplier: 1,
    });
    expect(
      ok.metrics.find((m) => m.metricId === 'edge_offered_load:checkout-db')
        ?.value,
    ).toBe(100);
    expect(
      ok.metrics.find((m) => m.metricId === 'edge_offered_load:inventory-db')
        ?.value,
    ).toBe(50);
    expect(
      ok.metrics.find((m) => m.metricId === 'node_offered_load:database')?.value,
    ).toBe(150);

    const partial: ArchitectureDocument = {
      ...withGateway,
      dependencies: withGateway.dependencies.map((d) => {
        if (d.id !== 'inventory-db') {
          return d;
        }
        const { requestsPerParent: _omit, ...rest } = d;
        return rest;
      }),
    };
    const refusedTotal = simulate(partial, {
      type: 'load_multiplication',
      multiplier: 1,
    });
    // Known edge contribution may still appear, but not as database total
    expect(
      refusedTotal.metrics.find(
        (m) => m.metricId === 'edge_offered_load:checkout-db',
      )?.value,
    ).toBe(100);
    expect(
      refusedTotal.metrics.find(
        (m) => m.metricId === 'node_offered_load:database',
      ),
    ).toBeUndefined();
    expect(
      refusedTotal.refused.some(
        (r) =>
          r.metricId === 'node_offered_load:database' &&
          r.reasonCode === 'INCOMPLETE_INBOUND_CONTRIBUTIONS',
      ),
    ).toBe(true);
    expect(
      refusedTotal.refused.some(
        (r) =>
          r.metricId === 'utilization:database' &&
          r.reasonCode === 'DEPENDS_ON_UNKNOWN_OFFERED_LOAD',
      ),
    ).toBe(true);
    expect(
      refusedTotal.saturations.find((s) => s.componentId === 'database'),
    ).toBeUndefined();
  });

  it('3. distinguishes direct vs transitive failure exposure', () => {
    const result = simulate(chainDoc(), {
      type: 'component_unavailable',
      componentId: 'postgres',
    });
    const byId = Object.fromEntries(
      result.impacts.map((i) => [i.componentId, i.impact]),
    );
    expect(byId['postgres']).toBe('unavailable');
    expect(byId['pricing']).toBe('sync_failure_exposed');
    expect(byId['checkout']).toBe('sync_transitively_exposed');
    expect(
      result.assumptions.some((a) => a.id === 'NO_IMPLIED_FALLBACK'),
    ).toBe(true);
  });

  it('4. isolates async dependents from sync unavailability labels', () => {
    const result = simulate(chainDoc(), {
      type: 'component_unavailable',
      componentId: 'invoicing',
    });
    expect(
      result.impacts.find((i) => i.componentId === 'checkout')?.impact,
    ).toBe('unaffected');
    expect(result.impacts.find((i) => i.componentId === 'queue')?.impact).toBe(
      'async_dependent',
    );
  });

  it('5. timeout boundary: L==T not violated; L>T violated', () => {
    const eq = simulate(chainDoc(), {
      type: 'latency_degradation',
      componentId: 'pricing',
      latencyMs: 2000,
    });
    expect(
      eq.metrics.find((m) => m.metricId === 'timeout_violated:checkout-pricing')
        ?.value,
    ).toBe(0);

    const gt = simulate(chainDoc(), {
      type: 'latency_degradation',
      componentId: 'pricing',
      latencyMs: 2001,
    });
    expect(
      gt.metrics.find((m) => m.metricId === 'timeout_violated:checkout-pricing')
        ?.value,
    ).toBe(1);
  });

  it('6. refuses end-to-end latency when order is unspecified', () => {
    const result = simulate(chainDoc(), {
      type: 'latency_degradation',
      componentId: 'pricing',
      latencyMs: 500,
    });
    expect(
      result.refused.some(
        (r) => r.reasonCode === 'E2E_LATENCY_ORDER_UNSPECIFIED',
      ),
    ).toBe(true);
  });

  it('7. reports max_attempts_per_logical_request', () => {
    const result = simulate(chainDoc({ backoff: 'none' }), {
      type: 'component_unavailable',
      componentId: 'pricing',
    });
    expect(
      result.metrics.find(
        (m) =>
          m.metricId ===
          'max_attempts_per_logical_request:checkout-pricing',
      )?.value,
    ).toBe(4);
  });

  it('8a. does not amplify healthy calls (latency at/under timeout)', () => {
    const healthy = simulate(chainDoc({ backoff: 'none' }), {
      type: 'latency_degradation',
      componentId: 'pricing',
      latencyMs: 500,
    });
    expect(
      healthy.metrics.find(
        (m) => m.metricId === 'timeout_violated:checkout-pricing',
      )?.value,
    ).toBe(0);
    expect(
      healthy.metrics.find(
        (m) =>
          m.metricId === 'max_attempts_for_declared_volume:checkout-pricing',
      ),
    ).toBeUndefined();
    expect(
      healthy.metrics.find(
        (m) =>
          m.metricId === 'max_attempts_per_logical_request:checkout-pricing',
      ),
    ).toBeUndefined();
  });

  it('8. refuses attempt-rate under backoff; allows labeled attempt-rate when backoff none', () => {
    const withBackoff = simulate(chainDoc({ backoff: 'fixed' }), {
      type: 'latency_degradation',
      componentId: 'pricing',
      latencyMs: 3000,
    });
    expect(
      withBackoff.refused.some(
        (r) => r.reasonCode === 'BACKOFF_PREVENTS_INSTANT_RATE',
      ),
    ).toBe(true);

    const noBackoff = simulate(chainDoc({ backoff: 'none' }), {
      type: 'latency_degradation',
      componentId: 'pricing',
      latencyMs: 3000,
    });
    const rate = noBackoff.metrics.find(
      (m) =>
        m.metricId === 'max_attempts_for_declared_volume:checkout-pricing',
    );
    expect(rate?.unit).toBe('attempts_per_s');
    expect(rate?.value).toBe(800);
    expect(rate?.substitutions.join(' ')).toContain('not successful RPS');
  });

  it('9. respects capacity aggregation policies', () => {
    const result = simulate(sharedDatastoreDoc(), {
      type: 'load_multiplication',
      multiplier: 1,
    });
    expect(
      result.saturations.find((s) => s.componentId === 'db')?.capacityRps,
    ).toBe(50);
    expect(
      result.saturations.find((s) => s.componentId === 'a')?.capacityRps,
    ).toBe(200);
  });

  it('10. classifies saturation as boolean bottleneck', () => {
    const result = simulate(sharedDatastoreDoc(), {
      type: 'load_multiplication',
      multiplier: 10,
    });
    // gateway 100; a=100; b=100; db=100+200=300; C_db=50 → saturated
    const db = result.saturations.find((s) => s.componentId === 'db');
    expect(db?.saturated).toBe(true);
    expect(typeof db?.saturated).toBe('boolean');
  });

  it('11. handles missing traffic and conflicting capacity fields', () => {
    const noTraffic: ArchitectureDocument = {
      ...chainDoc(),
      system: { ingressNodeIds: ['checkout'] },
    };
    const missing = simulate(noTraffic, {
      type: 'load_multiplication',
      multiplier: 3,
    });
    expect(missing.status).toBe('NOT_ANSWERABLE');
    expect(
      missing.refused.some((r) => r.reasonCode === 'MISSING_BASELINE_TRAFFIC'),
    ).toBe(true);

    const conflicted = simulate(chainDoc({ conflictReplicas: true }), {
      type: 'load_multiplication',
      multiplier: 1,
    });
    expect(
      conflicted.refused.some(
        (r) => r.reasonCode === 'CONFLICTING_CAPACITY_FIELDS',
      ),
    ).toBe(true);
  });

  it('12. is deterministic under repeated identical inputs', () => {
    const doc = chainDoc();
    const scenario = {
      type: 'load_multiplication' as const,
      multiplier: 2,
    };
    expect(simulate(doc, scenario)).toEqual(simulate(doc, scenario));
  });

  it('rejects invalid scenario consistently', () => {
    const result = simulate(chainDoc(), { type: 'nope' });
    expect(result.status).toBe('NOT_ANSWERABLE');
    expect(
      result.refused.some((r) => r.reasonCode === 'INVALID_SCENARIO'),
    ).toBe(true);
  });

  it('does not mutate the architecture document', () => {
    const doc = chainDoc();
    const before = JSON.stringify(doc);
    simulate(doc, { type: 'load_multiplication', multiplier: 2 });
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('refuses fabricated availability percentages', () => {
    const result = simulate(chainDoc(), {
      type: 'component_unavailable',
      componentId: 'pricing',
    });
    expect(
      result.refused.some((r) => r.reasonCode === 'NO_AVAILABILITY_MODEL'),
    ).toBe(true);
  });
});
