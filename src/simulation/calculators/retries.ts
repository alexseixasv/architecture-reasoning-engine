import type {
  ArchitectureDependency,
  ArchitectureDocument,
} from '../../architecture/domain/types';
import { evidence } from '../evidence/build-evidence';
import type {
  MetricEvidence,
  RefusedMetric,
  SimulationAssumption,
} from '../domain/result';

function maxAttempts(dep: ArchitectureDependency): number | undefined {
  const a = dep.retry?.additionalAttempts;
  if (a === undefined || a.state !== 'known') {
    return undefined;
  }
  return 1 + a.value;
}

/**
 * Retry metrics for edges that call a failed or timing-out component.
 * Never labels attempt rates as successful RPS / throughput.
 */
export function analyzeRetriesOnEdges(input: {
  document: ArchitectureDocument;
  edgeIds: string[];
  edgeLogicalLoadRps?: Map<string, number>;
  reason: 'unavailable' | 'timeout';
}): {
  metrics: MetricEvidence[];
  refused: RefusedMetric[];
  assumptions: SimulationAssumption[];
} {
  const metrics: MetricEvidence[] = [];
  const refused: RefusedMetric[] = [];
  const assumptions: SimulationAssumption[] = [];

  refused.push({
    metricId: 'expected_attempts',
    reasonCode: 'NEEDS_FAILURE_PROBABILITY',
    message: 'Expected attempts require a failure-probability model (not available)',
  });
  refused.push({
    metricId: 'observed_attempts',
    reasonCode: 'NEEDS_RUNTIME_DATA',
    message: 'Observed attempts require runtime measurements (not available)',
  });

  const edges = input.document.dependencies
    .filter((d) => input.edgeIds.includes(d.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const dep of edges) {
    const aMax = maxAttempts(dep);
    if (aMax === undefined) {
      refused.push({
        metricId: `max_attempts_per_logical_request:${dep.id}`,
        reasonCode: 'MISSING_RETRY_POLICY',
        message: `Dependency "${dep.id}" has no known additionalAttempts`,
        missingPaths: [`dependencies[id=${dep.id}].retry.additionalAttempts`],
      });
      continue;
    }

    const additional =
      dep.retry!.additionalAttempts.state === 'known'
        ? dep.retry!.additionalAttempts.value
        : 0;

    const additionalKnown = dep.retry!.additionalAttempts;
    metrics.push(
      evidence({
        metricId: `max_attempts_per_logical_request:${dep.id}`,
        value: aMax,
        unit: 'count',
        formulaId: 'F-RETRY-001',
        inputs: [
          additionalKnown.state === 'known'
            ? {
                path: `dependencies[id=${dep.id}].retry.additionalAttempts`,
                value: additionalKnown.value,
                unit: 'count' as const,
                provenance: additionalKnown.provenance,
              }
            : {
                path: `dependencies[id=${dep.id}].retry.additionalAttempts`,
                value: additional,
                unit: 'count' as const,
              },
        ],
        substitutions: [`A_max = 1 + ${additional} = ${aMax}`],
        result: `${aMax} attempts per logical request (maximum)`,
      }),
    );

    const backoff = dep.retry?.backoff;
    const logicalLoad = input.edgeLogicalLoadRps?.get(dep.id);

    if (backoff === undefined || backoff.type !== 'none') {
      refused.push({
        metricId: `max_attempts_for_declared_volume:${dep.id}`,
        reasonCode: 'BACKOFF_PREVENTS_INSTANT_RATE',
        message: `Steady-state attempt-rate upper bound refused for "${dep.id}" because backoff is not none; timing is unspecified`,
      });
      continue;
    }

    if (logicalLoad === undefined) {
      refused.push({
        metricId: `max_attempts_for_declared_volume:${dep.id}`,
        reasonCode: 'EDGE_LOAD_UNKNOWN',
        message: `Cannot bound attempt rate for "${dep.id}" without known edge logical request load`,
      });
      continue;
    }

    assumptions.push({
      id: `ASSUME_IMMEDIATE_RETRIES_NO_BACKOFF:${dep.id}`,
      text: `Edge "${dep.id}" backoff is none; attempt-rate upper bound assumes every logical request exhausts A_max immediately under ${input.reason} (not successful throughput)`,
    });

    const attemptRate = logicalLoad * aMax;
    metrics.push(
      evidence({
        metricId: `max_attempts_for_declared_volume:${dep.id}`,
        value: attemptRate,
        unit: 'attempts_per_s',
        formulaId: 'F-RETRY-002',
        inputs: [
          {
            path: `edge_logical_load:${dep.id}`,
            value: logicalLoad,
            unit: 'rps',
          },
          {
            path: `max_attempts_per_logical_request:${dep.id}`,
            value: aMax,
            unit: 'count',
          },
        ],
        substitutions: [
          `α_max = ${logicalLoad} request/s * ${aMax} attempts/request = ${attemptRate} attempts/s (upper bound; not successful RPS)`,
        ],
        result: `${attemptRate} attempts/s (maximum upper bound)`,
      }),
    );
  }

  return { metrics, refused, assumptions };
}
