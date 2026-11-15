import type { ArchitectureDocument } from '../../architecture/domain/types';
import type {
  ComponentImpact,
  PropagationPath,
  SimulationAssumption,
} from '../domain/result';
import {
  asyncRelatedTo,
  shortestSyncPathToTarget,
  syncCallersOf,
} from '../graph/reachability';

export function analyzeUnavailability(
  document: ArchitectureDocument,
  componentId: string,
): {
  impacts: ComponentImpact[];
  propagationPaths: PropagationPath[];
  assumptions: SimulationAssumption[];
  warnings: string[];
  primarySatisfied: boolean;
  refusedReason?: string;
} {
  if (!document.nodes.some((n) => n.id === componentId)) {
    return {
      impacts: [],
      propagationPaths: [],
      assumptions: [],
      warnings: [],
      primarySatisfied: false,
      refusedReason: `Unknown componentId "${componentId}"`,
    };
  }

  const assumptions: SimulationAssumption[] = [
    {
      id: 'NO_IMPLIED_FALLBACK',
      text: 'Exposure does not prove outage; absence of modeled fallback is not treated as proof that none exists',
    },
  ];
  const warnings: string[] = [];
  const callers = syncCallersOf(document);
  const directCallers = new Set(callers.get(componentId) ?? []);

  // Transitive sync exposure: nodes that can reach the target via sync path of length >= 2
  const transitive = new Set<string>();
  for (const node of document.nodes) {
    if (node.id === componentId || directCallers.has(node.id)) {
      continue;
    }
    const path = shortestSyncPathToTarget(document, node.id, componentId);
    if (path !== undefined && path.length > 2) {
      transitive.add(node.id);
    }
  }

  const asyncRelated = asyncRelatedTo(document, componentId);

  const impacts: ComponentImpact[] = [];
  const propagationPaths: PropagationPath[] = [];

  for (const node of [...document.nodes].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (node.id === componentId) {
      impacts.push({
        componentId: node.id,
        impact: 'unavailable',
        via: 'direct',
        path: [node.id],
      });
      propagationPaths.push({ componentId: node.id, path: [node.id] });
      continue;
    }
    if (directCallers.has(node.id)) {
      const path = [node.id, componentId];
      impacts.push({
        componentId: node.id,
        impact: 'sync_failure_exposed',
        via: 'sync_direct',
        path,
      });
      propagationPaths.push({ componentId: node.id, path });
      continue;
    }
    if (transitive.has(node.id)) {
      const path =
        shortestSyncPathToTarget(document, node.id, componentId) ?? [
          node.id,
          componentId,
        ];
      impacts.push({
        componentId: node.id,
        impact: 'sync_transitively_exposed',
        via: 'sync_transitive',
        path,
      });
      propagationPaths.push({ componentId: node.id, path });
      continue;
    }
    if (asyncRelated.has(node.id)) {
      impacts.push({
        componentId: node.id,
        impact: 'async_dependent',
        via: 'async',
        path: [node.id, componentId],
      });
      propagationPaths.push({
        componentId: node.id,
        path: [node.id, componentId],
      });
      continue;
    }
    impacts.push({
      componentId: node.id,
      impact: 'unaffected',
      via: 'none',
      path: [],
    });
  }

  return {
    impacts,
    propagationPaths: propagationPaths.sort((a, b) =>
      a.componentId.localeCompare(b.componentId),
    ),
    assumptions,
    warnings,
    primarySatisfied: true,
  };
}
