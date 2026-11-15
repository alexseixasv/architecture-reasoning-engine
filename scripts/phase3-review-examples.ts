import type { ArchitectureDocument } from '../src/architecture/domain/types';
import { simulate } from '../src/simulation/simulate';

const qty = <U extends 'rps' | 'ms' | 'count' | 'ratio'>(value: number, unit: U) => ({
  state: 'known' as const,
  value,
  unit,
  provenance: 'declared' as const,
});

const doc: ArchitectureDocument = {
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
    },
    {
      id: 'postgres',
      kind: 'datastore',
      name: 'Postgres',
      replicas: qty(1, 'count'),
      capacityPerReplica: qty(200, 'rps'),
      capacityAggregation: 'primary_only',
      declaredLatency: qty(50, 'ms'),
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
      requestsPerParent: qty(1, 'ratio'),
      retry: {
        additionalAttempts: qty(3, 'count'),
        backoff: { type: 'none' },
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

const A = simulate(doc, {
  type: 'component_unavailable',
  componentId: 'postgres',
});
const B = simulate(doc, {
  type: 'latency_degradation',
  componentId: 'pricing',
  latencyMs: 3000,
});
const C = simulate(doc, {
  type: 'load_multiplication',
  multiplier: 3,
});

function excerpt(label: string, r: ReturnType<typeof simulate>): void {
  process.stdout.write(
    `${JSON.stringify(
      {
        label,
        status: r.status,
        impacts: r.impacts
          .filter((i) => i.impact !== 'unaffected')
          .map((i) => ({
            id: i.componentId,
            impact: i.impact,
            path: i.path,
          })),
        propagationPaths: r.propagationPaths,
        metrics: r.metrics.map((m) => ({
          id: m.metricId,
          value: m.value,
          unit: m.unit,
          formulaId: m.formulaId,
          substitutions: m.substitutions,
          result: m.result,
          inputs: m.inputs,
        })),
        saturations: r.saturations,
        assumptions: r.assumptions,
        refusedHighlight: r.refused
          .filter((x) =>
            [
              'NO_AVAILABILITY_MODEL',
              'E2E_LATENCY_ORDER_UNSPECIFIED',
              'NO_THROUGHPUT_MODEL',
              'BACKOFF_PREVENTS_INSTANT_RATE',
            ].includes(x.reasonCode),
          )
          .map((x) => ({
            id: x.metricId,
            code: x.reasonCode,
            message: x.message,
          })),
      },
      null,
      2,
    )}\n---\n`,
  );
}

excerpt('A_unavailable', A);
excerpt('B_latency', B);
excerpt('C_load', C);
