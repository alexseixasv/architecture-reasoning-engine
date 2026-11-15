import type { ArchitectureDocument } from '../../architecture/domain/types';

export function hasSyncCycle(document: ArchitectureDocument): boolean {
  const adj = new Map<string, string[]>();
  for (const node of document.nodes) {
    adj.set(node.id, []);
  }
  for (const dep of document.dependencies) {
    if (dep.communication !== 'sync') {
      continue;
    }
    adj.get(dep.from)?.push(dep.to);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(id: string): boolean {
    visiting.add(id);
    for (const next of adj.get(id) ?? []) {
      if (visiting.has(next)) {
        return true;
      }
      if (!visited.has(next) && dfs(next)) {
        return true;
      }
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  for (const node of document.nodes) {
    if (!visited.has(node.id) && dfs(node.id)) {
      return true;
    }
  }
  return false;
}

/** Reverse sync adjacency: callee -> callers */
export function syncCallersOf(
  document: ArchitectureDocument,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const node of document.nodes) {
    map.set(node.id, []);
  }
  for (const dep of document.dependencies) {
    if (dep.communication !== 'sync') {
      continue;
    }
    map.get(dep.to)?.push(dep.from);
  }
  for (const [id, callers] of map) {
    map.set(id, [...callers].sort());
  }
  return map;
}

export function asyncRelatedTo(
  document: ArchitectureDocument,
  targetId: string,
): Set<string> {
  const related = new Set<string>();
  for (const dep of document.dependencies) {
    if (dep.communication !== 'async') {
      continue;
    }
    if (dep.to === targetId) {
      related.add(dep.from);
    }
    if (dep.from === targetId) {
      related.add(dep.to);
    }
  }
  return related;
}

export function shortestSyncPathToTarget(
  document: ArchitectureDocument,
  fromId: string,
  targetId: string,
): string[] | undefined {
  if (fromId === targetId) {
    return [fromId];
  }
  const adj = new Map<string, string[]>();
  for (const node of document.nodes) {
    adj.set(node.id, []);
  }
  for (const dep of document.dependencies) {
    if (dep.communication !== 'sync') {
      continue;
    }
    adj.get(dep.from)?.push(dep.to);
  }

  const queue: string[] = [fromId];
  const prev = new Map<string, string | undefined>([[fromId, undefined]]);
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === undefined) {
      break;
    }
    for (const next of adj.get(cur) ?? []) {
      if (prev.has(next)) {
        continue;
      }
      prev.set(next, cur);
      if (next === targetId) {
        const path: string[] = [];
        let walk: string | undefined = targetId;
        while (walk !== undefined) {
          path.push(walk);
          walk = prev.get(walk);
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return undefined;
}
