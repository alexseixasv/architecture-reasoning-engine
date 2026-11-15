import { nominalCapacityRps } from '../../architecture/domain/capacity';
import type {
  ArchitectureDocument,
  ArchitectureDependency,
  Provenance,
} from '../../architecture/domain/types';
import { evidence } from '../evidence/build-evidence';
import type {
  MetricEvidence,
  RefusedMetric,
  SaturationClassification,
  SimulationAssumption,
} from '../domain/result';
import { hasSyncCycle } from './reachability';

export type LoadAccumulationResult = {
  systemOfferedRps?: number;
  nodeOfferedRps: Map<string, number>;
  edgeContribRps: Map<string, number>;
  metrics: MetricEvidence[];
  refused: RefusedMetric[];
  saturations: SaturationClassification[];
  assumptions: SimulationAssumption[];
  warnings: string[];
};

function knownRatio(
  dep: ArchitectureDependency,
): { value: number; provenance: Provenance } | undefined {
  const q = dep.requestsPerParent;
  if (q === undefined || q.state !== 'known') {
    return undefined;
  }
  return { value: q.value, provenance: q.provenance };
}

function resolveIngress(
  document: ArchitectureDocument,
): {
  ingressIds: string[];
  assumptions: SimulationAssumption[];
  refused?: RefusedMetric;
} {
  const explicit = document.system?.ingressNodeIds;
  if (explicit !== undefined && explicit.length > 0) {
    const missing = explicit.filter(
      (id) => !document.nodes.some((n) => n.id === id),
    );
    if (missing.length > 0) {
      return {
        ingressIds: [],
        assumptions: [],
        refused: {
          metricId: 'ingress_attribution',
          reasonCode: 'INVALID_INGRESS_NODE',
          message: `ingressNodeIds reference unknown nodes: ${missing.join(', ')}`,
          missingPaths: missing.map((id) => `nodes[id=${id}]`),
        },
      };
    }
    if (explicit.length > 1) {
      return {
        ingressIds: [],
        assumptions: [],
        refused: {
          metricId: 'ingress_attribution',
          reasonCode: 'MULTIPLE_INGRESS_REQUIRES_SPLIT',
          message:
            'Multiple ingressNodeIds declared but per-ingress traffic split is not modeled; declare a single ingress or a gateway fan-out',
          missingPaths: ['system.ingressNodeIds'],
        },
      };
    }
    return { ingressIds: [...explicit].sort(), assumptions: [] };
  }

  const inbound = new Set(
    document.dependencies
      .filter((d) => d.communication === 'sync')
      .map((d) => d.to),
  );
  const candidates = document.nodes
    .map((n) => n.id)
    .filter((id) => !inbound.has(id))
    .sort();

  if (candidates.length === 1) {
    return {
      ingressIds: candidates,
      assumptions: [
        {
          id: 'ASSUME_SINGLE_INGRESS',
          text: `No system.ingressNodeIds declared; using sole node without sync inbound edges as ingress (${candidates[0]})`,
        },
      ],
    };
  }

  return {
    ingressIds: [],
    assumptions: [],
    refused: {
      metricId: 'ingress_attribution',
      reasonCode: 'INGRESS_AMBIGUOUS',
      message:
        candidates.length === 0
          ? 'No ingress candidate (every node has sync inbound) and ingressNodeIds not declared'
          : `Multiple ingress candidates without system.ingressNodeIds: ${candidates.join(', ')}`,
      missingPaths: ['system.ingressNodeIds'],
    },
  };
}

export function accumulateLoad(
  document: ArchitectureDocument,
  multiplier: number,
): LoadAccumulationResult {
  const metrics: MetricEvidence[] = [];
  const refused: RefusedMetric[] = [];
  const saturations: SaturationClassification[] = [];
  const assumptions: SimulationAssumption[] = [];
  const warnings: string[] = [];
  const nodeOfferedRps = new Map<string, number>();
  const edgeContribRps = new Map<string, number>();

  if (hasSyncCycle(document)) {
    refused.push({
      metricId: 'node_offered_load',
      reasonCode: 'SYNC_CYCLE_LOAD',
      message:
        'Synchronous dependency cycle prevents deterministic load fixed-point accumulation',
    });
    warnings.push('SYNC_CYCLE_LOAD');
    return {
      nodeOfferedRps,
      edgeContribRps,
      metrics,
      refused,
      saturations,
      assumptions,
      warnings,
    };
  }

  const traffic = document.system?.incomingTraffic;
  if (traffic === undefined || traffic.state !== 'known') {
    refused.push({
      metricId: 'scenario_offered_traffic',
      reasonCode: 'MISSING_BASELINE_TRAFFIC',
      message: 'system.incomingTraffic is missing or unknown',
      missingPaths: ['system.incomingTraffic'],
    });
    return {
      nodeOfferedRps,
      edgeContribRps,
      metrics,
      refused,
      saturations,
      assumptions,
      warnings,
    };
  }

  const systemOffered = traffic.value * multiplier;
  metrics.push(
    evidence({
      metricId: 'scenario_offered_traffic',
      value: systemOffered,
      unit: 'rps',
      formulaId: 'F-LOAD-001',
      inputs: [
        {
          path: 'system.incomingTraffic',
          value: traffic.value,
          unit: 'rps',
          provenance: traffic.provenance,
        },
        {
          path: 'scenario.multiplier',
          value: multiplier,
          unit: 'ratio',
        },
      ],
      substitutions: [
        `λ' = ${traffic.value} * ${multiplier} = ${systemOffered}`,
      ],
      result: `${systemOffered} rps`,
    }),
  );

  const ingress = resolveIngress(document);
  assumptions.push(...ingress.assumptions);
  if (ingress.refused) {
    refused.push(ingress.refused);
    return {
      systemOfferedRps: systemOffered,
      nodeOfferedRps,
      edgeContribRps,
      metrics,
      refused,
      saturations,
      assumptions,
      warnings,
    };
  }

  for (const id of ingress.ingressIds) {
    nodeOfferedRps.set(id, systemOffered);
    metrics.push(
      evidence({
        metricId: `node_offered_load:${id}`,
        value: systemOffered,
        unit: 'rps',
        formulaId: 'F-LOAD-INGRESS',
        inputs: [
          {
            path: 'scenario_offered_traffic',
            value: systemOffered,
            unit: 'rps',
          },
        ],
        substitutions: [`λ_${id} = λ' = ${systemOffered} (ingress)`],
        result: `${systemOffered} rps`,
      }),
    );
  }

  const syncDeps = document.dependencies
    .filter((d) => d.communication === 'sync')
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const indegree = new Map<string, number>();
  for (const n of document.nodes) {
    indegree.set(n.id, 0);
  }
  for (const d of syncDeps) {
    indegree.set(d.to, (indegree.get(d.to) ?? 0) + 1);
  }

  const queue = [...document.nodes.map((n) => n.id)]
    .filter((id) => (indegree.get(id) ?? 0) === 0)
    .sort();

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) {
      break;
    }

    if (!ingress.ingressIds.includes(id)) {
      const inbound = syncDeps.filter((d) => d.to === id);
      const missing: ArchitectureDependency[] = [];
      const known: ArchitectureDependency[] = [];
      for (const dep of inbound) {
        if (edgeContribRps.has(dep.id)) {
          known.push(dep);
        } else {
          missing.push(dep);
        }
      }
      if (inbound.length > 0 && missing.length > 0) {
        refused.push({
          metricId: `node_offered_load:${id}`,
          reasonCode: 'INCOMPLETE_INBOUND_CONTRIBUTIONS',
          message: `Exact offered load for "${id}" unknown; missing contributions from: ${missing.map((d) => d.id).join(', ')}; known partial contributions are not reported as the total`,
          missingPaths: missing.map(
            (d) => `dependencies[id=${d.id}].requestsPerParent`,
          ),
        });
        refused.push({
          metricId: `utilization:${id}`,
          reasonCode: 'DEPENDS_ON_UNKNOWN_OFFERED_LOAD',
          message: `Utilization for "${id}" refused because exact offered load is unknown`,
          missingPaths: [`node_offered_load:${id}`],
        });
      } else if (inbound.length > 0) {
        let sum = 0;
        const parts: string[] = [];
        for (const dep of known) {
          const c = edgeContribRps.get(dep.id) ?? 0;
          sum += c;
          parts.push(`${dep.id}:${c}`);
        }
        nodeOfferedRps.set(id, sum);
        metrics.push(
          evidence({
            metricId: `node_offered_load:${id}`,
            value: sum,
            unit: 'rps',
            formulaId: 'F-LOAD-003',
            inputs: known.map((dep) => ({
              path: `edge_offered_load:${dep.id}`,
              value: edgeContribRps.get(dep.id) ?? 0,
              unit: 'rps' as const,
            })),
            substitutions: [
              `λ_${id} = sum(${parts.join(' + ')}) = ${sum}`,
            ],
            result: `${sum} rps`,
          }),
        );
      }
    }

    const parentLoad = nodeOfferedRps.get(id);
    for (const dep of syncDeps.filter((d) => d.from === id)) {
      const fanout = knownRatio(dep);
      if (fanout === undefined) {
        refused.push({
          metricId: `edge_offered_load:${dep.id}`,
          reasonCode: 'MISSING_REQUESTS_PER_PARENT',
          message: `Dependency "${dep.id}" lacks known requestsPerParent; contribution omitted (not treated as zero)`,
          missingPaths: [`dependencies[id=${dep.id}].requestsPerParent`],
        });
      } else if (parentLoad === undefined) {
        refused.push({
          metricId: `edge_offered_load:${dep.id}`,
          reasonCode: 'PARENT_LOAD_UNKNOWN',
          message: `Cannot compute edge load for "${dep.id}" because parent "${id}" offered load is unknown`,
          missingPaths: [`nodes[id=${id}].offeredLoad`],
        });
      } else {
        const contrib = parentLoad * fanout.value;
        edgeContribRps.set(dep.id, contrib);
        metrics.push(
          evidence({
            metricId: `edge_offered_load:${dep.id}`,
            value: contrib,
            unit: 'rps',
            formulaId: 'F-LOAD-002',
            inputs: [
              {
                path: `nodes[id=${id}].offeredLoad`,
                value: parentLoad,
                unit: 'rps',
              },
              {
                path: `dependencies[id=${dep.id}].requestsPerParent`,
                value: fanout.value,
                unit: 'ratio',
                provenance: fanout.provenance,
              },
            ],
            substitutions: [
              `λ_e(${dep.id}) = ${parentLoad} * ${fanout.value} = ${contrib}`,
            ],
            result: `${contrib} rps`,
          }),
        );
      }

      const remaining = (indegree.get(dep.to) ?? 0) - 1;
      indegree.set(dep.to, remaining);
      if (remaining === 0) {
        queue.push(dep.to);
        queue.sort();
      }
    }
  }

  for (const node of [...document.nodes].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const offered = nodeOfferedRps.get(node.id);
    if (offered === undefined) {
      continue;
    }
    if (
      (node.fieldConflicts ?? []).some(
        (fc) =>
          fc.field === 'replicas' ||
          fc.field === 'capacityPerReplica' ||
          fc.field === 'capacityAggregation',
      )
    ) {
      refused.push({
        metricId: `utilization:${node.id}`,
        reasonCode: 'CONFLICTING_CAPACITY_FIELDS',
        message: `Capacity fields for "${node.id}" have unresolved conflicts`,
      });
      continue;
    }
    const cap = nominalCapacityRps(node);
    if (cap.status !== 'ok') {
      refused.push({
        metricId: `utilization:${node.id}`,
        reasonCode: 'CAPACITY_NOT_ANSWERABLE',
        message: `Cannot compute utilization for "${node.id}": ${cap.reason}`,
      });
      continue;
    }
    const u = offered / cap.value;
    metrics.push(
      evidence({
        metricId: `utilization:${node.id}`,
        value: u,
        unit: 'ratio',
        formulaId: 'F-UTIL-001',
        inputs: [
          {
            path: `node_offered_load:${node.id}`,
            value: offered,
            unit: 'rps',
          },
          {
            path: `nodes[id=${node.id}].capacity`,
            value: cap.value,
            unit: 'rps',
          },
        ],
        substitutions: [`U = ${offered} / ${cap.value} = ${u}`],
        result: `${u} ratio`,
      }),
    );
    saturations.push({
      componentId: node.id,
      saturated: u >= 1,
      utilization: u,
      offeredLoadRps: offered,
      capacityRps: cap.value,
    });
  }

  saturations.sort((a, b) => a.componentId.localeCompare(b.componentId));

  return {
    systemOfferedRps: systemOffered,
    nodeOfferedRps,
    edgeContribRps,
    metrics,
    refused,
    saturations,
    assumptions,
    warnings,
  };
}
