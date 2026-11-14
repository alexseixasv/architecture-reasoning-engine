import type { ArchitectureDocument, CompletenessGap } from './types';

/**
 * General completeness hints (not scenario execution).
 * ASSUME is never recommended by this function — only explicit document.assumptions.
 */
export function completenessGaps(
  document: ArchitectureDocument,
): CompletenessGap[] {
  const gaps: CompletenessGap[] = [];

  const traffic = document.system?.incomingTraffic;
  if (traffic === undefined || traffic.state === 'unknown') {
    gaps.push({
      field: 'system.incomingTraffic',
      action: 'ASK',
      reason:
        'Required for load-multiplication scenarios; engine will REFUSE those calculations until known',
    });
  }

  for (const node of document.nodes) {
    if (node.kind === 'queue') {
      continue;
    }
    if (
      node.replicas === undefined ||
      node.replicas.state === 'unknown' ||
      node.capacityPerReplica === undefined ||
      node.capacityPerReplica.state === 'unknown'
    ) {
      gaps.push({
        field: `nodes[${node.id}].capacity`,
        action: 'ASK',
        reason:
          'Replicas and capacityPerReplica needed for utilization/saturation',
        relatedIds: [node.id],
      });
    }
    if (
      (node.capacityPerReplica !== undefined || node.replicas !== undefined) &&
      (node.capacityAggregation === undefined ||
        node.capacityAggregation === 'unknown')
    ) {
      gaps.push({
        field: `nodes[${node.id}].capacityAggregation`,
        action: 'ASK',
        reason:
          'Explicit capacityAggregation required; replicas are not assumed additive (e.g. DB write path)',
        relatedIds: [node.id],
      });
    }
  }

  if (document.conflicts.length > 0) {
    gaps.push({
      field: 'conflicts',
      action: 'ASK',
      reason:
        'Contradictory declarations present; resolve manually before trusting capacity fields',
      relatedIds: document.conflicts.map((c) => c.id),
    });
  }

  return gaps;
}
