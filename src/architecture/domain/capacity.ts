import type { ArchitectureNode } from './types';

/** Compute nominal capacity only when aggregation policy allows (D-008). */
export function nominalCapacityRps(
  node: ArchitectureNode,
): { status: 'ok'; value: number } | { status: 'not_answerable'; reason: string } {
  if (
    node.capacityPerReplica === undefined ||
    node.capacityPerReplica.state !== 'known'
  ) {
    return {
      status: 'not_answerable',
      reason: 'capacityPerReplica unknown',
    };
  }
  if (node.capacityAggregation === undefined) {
    return {
      status: 'not_answerable',
      reason: 'capacityAggregation unspecified',
    };
  }
  if (node.capacityAggregation === 'unknown') {
    return {
      status: 'not_answerable',
      reason: 'capacityAggregation is unknown',
    };
  }
  if (node.capacityAggregation === 'primary_only') {
    return { status: 'ok', value: node.capacityPerReplica.value };
  }
  if (node.replicas === undefined || node.replicas.state !== 'known') {
    return { status: 'not_answerable', reason: 'replicas unknown' };
  }
  return {
    status: 'ok',
    value: node.replicas.value * node.capacityPerReplica.value,
  };
}
