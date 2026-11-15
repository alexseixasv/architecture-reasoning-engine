import type { ArchitectureDocument } from '../../architecture/domain/types';
import { evidence } from '../evidence/build-evidence';
import type {
  MetricEvidence,
  RefusedMetric,
  SimulationAssumption,
} from '../domain/result';

export function analyzeLatencyDegradation(
  document: ArchitectureDocument,
  componentId: string,
  latencyMs: number,
): {
  metrics: MetricEvidence[];
  refused: RefusedMetric[];
  assumptions: SimulationAssumption[];
  warnings: string[];
  primarySatisfied: boolean;
  timedOutEdgeIds: string[];
} {
  const metrics: MetricEvidence[] = [];
  const refused: RefusedMetric[] = [];
  const assumptions: SimulationAssumption[] = [];
  const warnings: string[] = [];
  const timedOutEdgeIds: string[] = [];

  if (!document.nodes.some((n) => n.id === componentId)) {
    refused.push({
      metricId: 'latency_degradation',
      reasonCode: 'UNKNOWN_COMPONENT',
      message: `Unknown componentId "${componentId}"`,
    });
    return {
      metrics,
      refused,
      assumptions,
      warnings,
      primarySatisfied: false,
      timedOutEdgeIds,
    };
  }

  metrics.push(
    evidence({
      metricId: `scenario_component_latency:${componentId}`,
      value: latencyMs,
      unit: 'ms',
      formulaId: 'F-LAT-SCENARIO',
      inputs: [
        {
          path: 'scenario.latencyMs',
          value: latencyMs,
          unit: 'ms',
        },
      ],
      substitutions: [`L_${componentId} = ${latencyMs} ms (scenario absolute)`],
      result: `${latencyMs} ms`,
    }),
  );

  refused.push({
    metricId: 'end_to_end_latency',
    reasonCode: 'E2E_LATENCY_ORDER_UNSPECIFIED',
    message:
      'End-to-end latency is refused: execution order/concurrency is not explicitly specified; order is not inferred from group ids',
  });

  const inboundSync = document.dependencies
    .filter((d) => d.communication === 'sync' && d.to === componentId)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (inboundSync.length === 0) {
    refused.push({
      metricId: 'timeout_checks',
      reasonCode: 'NO_SYNC_INBOUND',
      message: `Component "${componentId}" has no synchronous inbound dependencies to check timeouts against`,
    });
    return {
      metrics,
      refused,
      assumptions,
      warnings,
      primarySatisfied: false,
      timedOutEdgeIds,
    };
  }

  let evaluated = 0;
  for (const dep of inboundSync) {
    const timeout = dep.timeout;
    if (timeout === undefined || timeout.state !== 'known') {
      refused.push({
        metricId: `timeout_violated:${dep.id}`,
        reasonCode: 'MISSING_TIMEOUT',
        message: `Sync dependency "${dep.id}" has no known timeout`,
        missingPaths: [`dependencies[id=${dep.id}].timeout`],
      });
      continue;
    }
    const violated = latencyMs > timeout.value;
    evaluated += 1;
    metrics.push(
      evidence({
        metricId: `timeout_violated:${dep.id}`,
        value: violated ? 1 : 0,
        unit: 'count',
        formulaId: 'F-LAT-001',
        inputs: [
          {
            path: `scenario_component_latency:${componentId}`,
            value: latencyMs,
            unit: 'ms',
          },
          {
            path: `dependencies[id=${dep.id}].timeout`,
            value: timeout.value,
            unit: 'ms',
            provenance: timeout.provenance,
          },
        ],
        substitutions: [
          `violated = (${latencyMs} > ${timeout.value}) = ${violated}`,
        ],
        result: violated ? 'true (1)' : 'false (0)',
      }),
    );
    if (violated) {
      timedOutEdgeIds.push(dep.id);
    }
  }

  return {
    metrics,
    refused,
    assumptions,
    warnings,
    primarySatisfied: evaluated > 0,
    timedOutEdgeIds,
  };
}
