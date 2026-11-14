import type {
  ArchitectureDocument,
  ArchitectureDependency,
  ArchitectureNode,
  Assumption,
  DiffChange,
  DocumentConflict,
  DocumentDiff,
} from '../domain/types';

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const v = record[key];
      if (v !== undefined) {
        sorted[key] = sortKeys(v);
      }
    }
    return sorted;
  }
  return value;
}

function equal(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function compareChanges(a: DiffChange, b: DiffChange): number {
  return (
    a.entityType.localeCompare(b.entityType) ||
    a.id.localeCompare(b.id) ||
    a.path.localeCompare(b.path) ||
    a.kind.localeCompare(b.kind)
  );
}

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function diffMaps<T>(
  before: Map<string, T>,
  after: Map<string, T>,
  entityType: DiffChange['entityType'],
  fieldDiff: (id: string, a: T, b: T) => DiffChange[],
): DiffChange[] {
  const changes: DiffChange[] = [];
  const ids = new Set([...before.keys(), ...after.keys()]);

  for (const id of [...ids].sort()) {
    const a = before.get(id);
    const b = after.get(id);
    if (a === undefined && b !== undefined) {
      changes.push({
        entityType,
        id,
        path: id,
        kind: 'added',
        after: b,
      });
      continue;
    }
    if (a !== undefined && b === undefined) {
      changes.push({
        entityType,
        id,
        path: id,
        kind: 'removed',
        before: a,
      });
      continue;
    }
    if (a !== undefined && b !== undefined) {
      changes.push(...fieldDiff(id, a, b));
    }
  }

  return changes;
}

function diffRecordFields(
  entityType: DiffChange['entityType'],
  id: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): DiffChange[] {
  const changes: DiffChange[] = [];
  for (const field of fields) {
    const b = before[field];
    const a = after[field];
    if (equal(b, a)) {
      continue;
    }
    const change: DiffChange = {
      entityType,
      id,
      path: `${id}.${field}`,
      kind: 'changed',
    };
    if (b !== undefined) {
      change.before = b;
    }
    if (a !== undefined) {
      change.after = a;
    }
    // Treat undefined ↔ missing as change when one side has value
    if (b === undefined && a === undefined) {
      continue;
    }
    changes.push(change);
  }
  return changes;
}

function nodeFields(node: ArchitectureNode): Record<string, unknown> {
  return {
    kind: node.kind,
    name: node.name,
    replicas: node.replicas,
    capacityPerReplica: node.capacityPerReplica,
    capacityAggregation: node.capacityAggregation,
    declaredLatency: node.declaredLatency,
    fieldConflicts: node.fieldConflicts,
  };
}

function depFields(dep: ArchitectureDependency): Record<string, unknown> {
  return {
    from: dep.from,
    to: dep.to,
    communication: dep.communication,
    timeout: dep.timeout,
    retry: dep.retry,
  };
}

function assumptionFields(a: Assumption): Record<string, unknown> {
  return {
    text: a.text,
    provenance: a.provenance,
    fieldsAffected: [...a.fieldsAffected].sort(),
  };
}

function conflictFields(c: DocumentConflict): Record<string, unknown> {
  return {
    description: c.description,
    nodeIds: [...c.nodeIds].sort(),
    field: c.field,
    candidates: c.candidates,
  };
}

export function diffDocuments(
  before: ArchitectureDocument,
  after: ArchitectureDocument,
  versions?: { fromVersion: number; toVersion: number },
): DocumentDiff {
  const changes: DiffChange[] = [];

  if (before.schemaVersion !== after.schemaVersion) {
    changes.push({
      entityType: 'meta',
      id: 'schemaVersion',
      path: 'schemaVersion',
      kind: 'changed',
      before: before.schemaVersion,
      after: after.schemaVersion,
    });
  }
  if (before.name !== after.name) {
    changes.push({
      entityType: 'meta',
      id: 'name',
      path: 'name',
      kind: 'changed',
      before: before.name,
      after: after.name,
    });
  }
  if (before.description !== after.description) {
    changes.push({
      entityType: 'meta',
      id: 'description',
      path: 'description',
      kind: 'changed',
      before: before.description,
      after: after.description,
    });
  }

  if (!equal(before.system, after.system)) {
    changes.push({
      entityType: 'system',
      id: 'system',
      path: 'system',
      kind: 'changed',
      before: before.system,
      after: after.system,
    });
  }

  changes.push(
    ...diffMaps(
      indexById(before.nodes),
      indexById(after.nodes),
      'node',
      (id, a, b) =>
        diffRecordFields('node', id, nodeFields(a), nodeFields(b), [
          'kind',
          'name',
          'replicas',
          'capacityPerReplica',
          'capacityAggregation',
          'declaredLatency',
          'fieldConflicts',
        ]),
    ),
  );

  changes.push(
    ...diffMaps(
      indexById(before.dependencies),
      indexById(after.dependencies),
      'dependency',
      (id, a, b) =>
        diffRecordFields('dependency', id, depFields(a), depFields(b), [
          'from',
          'to',
          'communication',
          'timeout',
          'retry',
        ]),
    ),
  );

  changes.push(
    ...diffMaps(
      indexById(before.assumptions),
      indexById(after.assumptions),
      'assumption',
      (id, a, b) =>
        diffRecordFields(
          'assumption',
          id,
          assumptionFields(a),
          assumptionFields(b),
          ['text', 'provenance', 'fieldsAffected'],
        ),
    ),
  );

  changes.push(
    ...diffMaps(
      indexById(before.conflicts),
      indexById(after.conflicts),
      'conflict',
      (id, a, b) =>
        diffRecordFields(
          'conflict',
          id,
          conflictFields(a),
          conflictFields(b),
          ['description', 'nodeIds', 'field', 'candidates'],
        ),
    ),
  );

  changes.sort(compareChanges);

  const result: DocumentDiff = { changes };
  if (versions !== undefined) {
    result.fromVersion = versions.fromVersion;
    result.toVersion = versions.toVersion;
  }
  return result;
}
