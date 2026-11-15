import type {
  ArchitectureDocument,
  ArchitectureNode,
  Quantity,
} from '../../architecture/domain/types';

export type FieldComparison = {
  path: string;
  match: boolean;
  expected: string;
  actual: string;
  kind?:
    | 'presence'
    | 'field'
    | 'quantity_state'
    | 'conflict'
    | 'ingress'
    | 'extra';
};

export type PresenceMetrics = {
  truePositives: number;
  falseNegatives: number;
  falsePositives: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
};

export type QuantityStateStats = {
  /** Expected known became unknown/omitted. */
  knownToUnknown: number;
  /** Expected unknown/omitted became known (hallucinated value). */
  unknownToKnown: number;
  knownPreserved: number;
  unknownPreserved: number;
};

/**
 * Distinguishes field-level vs document-level conflict preservation,
 * and extras / mis-leveled conflicts that should not be read as
 * "failed to preserve an expected document conflict".
 */
export type ConflictPreservationReport = {
  /** Nodes where expected fieldConflicts were present and actual kept ≥ expected count. */
  fieldLevelPreserved: boolean | null;
  expectedNodesWithFieldConflicts: number;
  actualNodesWithFieldConflicts: number;
  /** Expected document.conflicts present and actual kept ≥ expected count. */
  documentLevelPreserved: boolean | null;
  expectedDocumentConflicts: number;
  actualDocumentConflicts: number;
  /**
   * Actual document conflicts when expected had none — often mis-leveled
   * field conflicts; not the same as failing to preserve an expected conflict.
   */
  extraDocumentConflicts: number;
  /**
   * Actual fieldConflicts on nodes that expected had none for that node
   * (or extra nodes) — informational.
   */
  extraFieldConflictNodes: number;
};

export type ArchitectureCompareReport = {
  matchedNodes: number;
  expectedNodes: number;
  actualNodes: number;
  extraNodeIds: string[];
  matchedDependencies: number;
  expectedDependencies: number;
  actualDependencies: number;
  extraDependencyKeys: string[];
  fieldComparisons: FieldComparison[];
  /** Matches / total field comparisons with explicit denominator (includes extras). */
  fieldAccuracy: { matches: number; total: number };
  nodePresence: PresenceMetrics;
  dependencyPresence: PresenceMetrics;
  quantityState: QuantityStateStats;
  /** @deprecated Prefer conflictPreservation.documentLevelPreserved */
  documentConflictsPreserved: boolean | null;
  conflictPreservation: ConflictPreservationReport;
};

function qtyKey(q: Quantity | undefined): string {
  if (q === undefined) {
    return 'omitted';
  }
  if (q.state === 'unknown') {
    return `unknown:${q.unit}`;
  }
  return `known:${q.value}:${q.unit}:${q.provenance}`;
}

function qtyState(q: Quantity | undefined): 'known' | 'unknown' | 'omitted' {
  if (q === undefined) {
    return 'omitted';
  }
  if (q.state === 'unknown') {
    return 'unknown';
  }
  return 'known';
}

function presenceMetrics(tp: number, fn: number, fp: number): PresenceMetrics {
  const precision = tp + fp === 0 ? null : tp / (tp + fp);
  const recall = tp + fn === 0 ? null : tp / (tp + fn);
  const f1 =
    precision === null || recall === null || precision + recall === 0
      ? null
      : (2 * precision * recall) / (precision + recall);
  return {
    truePositives: tp,
    falseNegatives: fn,
    falsePositives: fp,
    precision,
    recall,
    f1,
  };
}

function recordQuantityState(
  stats: QuantityStateStats,
  exp: Quantity | undefined,
  act: Quantity | undefined,
): void {
  const e = qtyState(exp);
  const a = qtyState(act);
  if (e === 'known' && a === 'known') {
    stats.knownPreserved += 1;
  } else if (e === 'known' && a !== 'known') {
    stats.knownToUnknown += 1;
  } else if (e !== 'known' && a === 'known') {
    stats.unknownToKnown += 1;
  } else {
    stats.unknownPreserved += 1;
  }
}

function matchNode(
  expected: ArchitectureNode,
  actual: ArchitectureNode,
  quantityState: QuantityStateStats,
): FieldComparison[] {
  const prefix = `node:${expected.id}`;
  const rows: FieldComparison[] = [];
  const push = (
    path: string,
    exp: string,
    act: string,
    kind: FieldComparison['kind'] = 'field',
  ) => {
    rows.push({ path, match: exp === act, expected: exp, actual: act, kind });
  };
  push(`${prefix}.kind`, expected.kind, actual.kind);
  push(
    `${prefix}.replicas`,
    qtyKey(expected.replicas),
    qtyKey(actual.replicas),
    'quantity_state',
  );
  recordQuantityState(quantityState, expected.replicas, actual.replicas);
  push(
    `${prefix}.capacityPerReplica`,
    qtyKey(expected.capacityPerReplica),
    qtyKey(actual.capacityPerReplica),
    'quantity_state',
  );
  recordQuantityState(
    quantityState,
    expected.capacityPerReplica,
    actual.capacityPerReplica,
  );
  push(
    `${prefix}.capacityAggregation`,
    expected.capacityAggregation ?? 'omitted',
    actual.capacityAggregation ?? 'omitted',
  );
  const expConflicts = (expected.fieldConflicts ?? []).length;
  const actConflicts = (actual.fieldConflicts ?? []).length;
  push(
    `${prefix}.fieldConflicts.count`,
    String(expConflicts),
    String(actConflicts),
    'conflict',
  );
  return rows;
}

function depKey(d: {
  id: string;
  from: string;
  to: string;
  communication: string;
}): string {
  return `${d.id}|${d.from}->${d.to}:${d.communication}`;
}

function buildConflictPreservation(
  expected: ArchitectureDocument,
  actual: ArchitectureDocument,
): ConflictPreservationReport {
  const expectedFieldNodes = expected.nodes.filter(
    (n) => (n.fieldConflicts?.length ?? 0) > 0,
  );
  const actualById = new Map(actual.nodes.map((n) => [n.id, n]));
  let fieldPreservedCount = 0;
  for (const exp of expectedFieldNodes) {
    const act = actualById.get(exp.id);
    if (
      act &&
      (act.fieldConflicts?.length ?? 0) >= (exp.fieldConflicts?.length ?? 0)
    ) {
      fieldPreservedCount += 1;
    }
  }
  const expectedNodesWithFieldConflicts = expectedFieldNodes.length;
  const actualNodesWithFieldConflicts = actual.nodes.filter(
    (n) => (n.fieldConflicts?.length ?? 0) > 0,
  ).length;

  const fieldLevelPreserved =
    expectedNodesWithFieldConflicts === 0
      ? null
      : fieldPreservedCount === expectedNodesWithFieldConflicts;

  const expectedDocumentConflicts = expected.conflicts.length;
  const actualDocumentConflicts = actual.conflicts.length;
  const documentLevelPreserved =
    expectedDocumentConflicts === 0
      ? null
      : actualDocumentConflicts >= expectedDocumentConflicts;

  const expectedFieldIds = new Set(expectedFieldNodes.map((n) => n.id));
  const extraFieldConflictNodes = actual.nodes.filter(
    (n) =>
      (n.fieldConflicts?.length ?? 0) > 0 && !expectedFieldIds.has(n.id),
  ).length;

  const extraDocumentConflicts =
    expectedDocumentConflicts === 0 ? actualDocumentConflicts : 0;

  return {
    fieldLevelPreserved,
    expectedNodesWithFieldConflicts,
    actualNodesWithFieldConflicts,
    documentLevelPreserved,
    expectedDocumentConflicts,
    actualDocumentConflicts,
    extraDocumentConflicts,
    extraFieldConflictNodes,
  };
}

/**
 * Compare architectures with order-insensitive node/edge matching by id.
 * Extra/hallucinated nodes and dependencies are counted in the denominator.
 */
export function compareArchitectures(
  expected: ArchitectureDocument,
  actual: ArchitectureDocument,
): ArchitectureCompareReport {
  const fieldComparisons: FieldComparison[] = [];
  const quantityState: QuantityStateStats = {
    knownToUnknown: 0,
    unknownToKnown: 0,
    knownPreserved: 0,
    unknownPreserved: 0,
  };
  const actualNodes = new Map(actual.nodes.map((n) => [n.id, n]));
  const expectedNodeIds = new Set(expected.nodes.map((n) => n.id));
  let matchedNodes = 0;

  for (const exp of expected.nodes) {
    const act = actualNodes.get(exp.id);
    if (!act) {
      fieldComparisons.push({
        path: `node:${exp.id}`,
        match: false,
        expected: 'present',
        actual: 'missing',
        kind: 'presence',
      });
      continue;
    }
    matchedNodes += 1;
    fieldComparisons.push(...matchNode(exp, act, quantityState));
  }

  const extraNodeIds = actual.nodes
    .map((n) => n.id)
    .filter((id) => !expectedNodeIds.has(id))
    .sort();
  for (const id of extraNodeIds) {
    fieldComparisons.push({
      path: `node:${id}`,
      match: false,
      expected: 'absent',
      actual: 'extra',
      kind: 'extra',
    });
  }

  const expectedDepKeys = new Set(
    expected.dependencies.map((d) => depKey(d)),
  );
  const matchedActualDepIndexes = new Set<number>();
  let matchedDependencies = 0;

  for (const exp of expected.dependencies) {
    let actIndex = actual.dependencies.findIndex((d) => d.id === exp.id);
    let act = actIndex >= 0 ? actual.dependencies[actIndex] : undefined;
    if (!act) {
      actIndex = actual.dependencies.findIndex(
        (d) =>
          d.from === exp.from &&
          d.to === exp.to &&
          d.communication === exp.communication,
      );
      act = actIndex >= 0 ? actual.dependencies[actIndex] : undefined;
    }
    if (!act || actIndex < 0) {
      fieldComparisons.push({
        path: `dep:${exp.id}`,
        match: false,
        expected: 'present',
        actual: 'missing',
        kind: 'presence',
      });
      continue;
    }
    matchedActualDepIndexes.add(actIndex);
    matchedDependencies += 1;
    fieldComparisons.push({
      path: `dep:${exp.id}.communication`,
      match: exp.communication === act.communication,
      expected: exp.communication,
      actual: act.communication,
      kind: 'field',
    });
    fieldComparisons.push({
      path: `dep:${exp.id}.from`,
      match: exp.from === act.from,
      expected: exp.from,
      actual: act.from,
      kind: 'field',
    });
    fieldComparisons.push({
      path: `dep:${exp.id}.to`,
      match: exp.to === act.to,
      expected: exp.to,
      actual: act.to,
      kind: 'field',
    });
    fieldComparisons.push({
      path: `dep:${exp.id}.timeout`,
      match: qtyKey(exp.timeout) === qtyKey(act.timeout),
      expected: qtyKey(exp.timeout),
      actual: qtyKey(act.timeout),
      kind: 'quantity_state',
    });
    recordQuantityState(quantityState, exp.timeout, act.timeout);
    fieldComparisons.push({
      path: `dep:${exp.id}.requestsPerParent`,
      match: qtyKey(exp.requestsPerParent) === qtyKey(act.requestsPerParent),
      expected: qtyKey(exp.requestsPerParent),
      actual: qtyKey(act.requestsPerParent),
      kind: 'quantity_state',
    });
    recordQuantityState(
      quantityState,
      exp.requestsPerParent,
      act.requestsPerParent,
    );
  }

  const extraDependencyKeys: string[] = [];
  for (const [i, d] of actual.dependencies.entries()) {
    if (matchedActualDepIndexes.has(i)) {
      continue;
    }
    const key = depKey(d);
    if (!expectedDepKeys.has(key) && !expected.dependencies.some((e) => e.id === d.id)) {
      extraDependencyKeys.push(key);
      fieldComparisons.push({
        path: `dep:${key}`,
        match: false,
        expected: 'absent',
        actual: 'extra',
        kind: 'extra',
      });
    }
  }
  extraDependencyKeys.sort();

  const trafficExp = qtyKey(expected.system?.incomingTraffic);
  const trafficAct = qtyKey(actual.system?.incomingTraffic);
  fieldComparisons.push({
    path: 'system.incomingTraffic',
    match: trafficExp === trafficAct,
    expected: trafficExp,
    actual: trafficAct,
    kind: 'ingress',
  });
  recordQuantityState(
    quantityState,
    expected.system?.incomingTraffic,
    actual.system?.incomingTraffic,
  );

  const ingressExp = [...(expected.system?.ingressNodeIds ?? [])].sort().join(',');
  const ingressAct = [...(actual.system?.ingressNodeIds ?? [])].sort().join(',');
  fieldComparisons.push({
    path: 'system.ingressNodeIds',
    match: ingressExp === ingressAct,
    expected: ingressExp || '(none)',
    actual: ingressAct || '(none)',
    kind: 'ingress',
  });

  const conflictPreservation = buildConflictPreservation(expected, actual);

  // Field-level: score preservation only when expected has fieldConflicts.
  // Extra fieldConflicts on unexpected nodes are reported separately.
  if (conflictPreservation.expectedNodesWithFieldConflicts > 0) {
    fieldComparisons.push({
      path: 'conflicts.fieldLevel.preserved',
      match: conflictPreservation.fieldLevelPreserved === true,
      expected: String(conflictPreservation.expectedNodesWithFieldConflicts),
      actual: String(conflictPreservation.actualNodesWithFieldConflicts),
      kind: 'conflict',
    });
  } else if (conflictPreservation.extraFieldConflictNodes > 0) {
    fieldComparisons.push({
      path: 'conflicts.fieldLevel.extra',
      match: false,
      expected: '0',
      actual: String(conflictPreservation.extraFieldConflictNodes),
      kind: 'extra',
    });
  }

  // Document-level: only score preservation when expected has document conflicts.
  // Extra document conflicts (expected=0, actual>0) are reported separately — often
  // mis-leveled field conflicts, not a failed preservation of an expected doc conflict.
  if (conflictPreservation.expectedDocumentConflicts > 0) {
    fieldComparisons.push({
      path: 'conflicts.documentLevel.preserved',
      match: conflictPreservation.documentLevelPreserved === true,
      expected: String(conflictPreservation.expectedDocumentConflicts),
      actual: String(conflictPreservation.actualDocumentConflicts),
      kind: 'conflict',
    });
  } else if (conflictPreservation.extraDocumentConflicts > 0) {
    fieldComparisons.push({
      path: 'conflicts.documentLevel.extra',
      match: false,
      expected: '0',
      actual: String(conflictPreservation.extraDocumentConflicts),
      kind: 'extra',
    });
  }

  const matches = fieldComparisons.filter((f) => f.match).length;
  const missingNodes = expected.nodes.length - matchedNodes;
  const missingDeps = expected.dependencies.length - matchedDependencies;

  return {
    matchedNodes,
    expectedNodes: expected.nodes.length,
    actualNodes: actual.nodes.length,
    extraNodeIds,
    matchedDependencies,
    expectedDependencies: expected.dependencies.length,
    actualDependencies: actual.dependencies.length,
    extraDependencyKeys,
    fieldComparisons,
    fieldAccuracy: { matches, total: fieldComparisons.length },
    nodePresence: presenceMetrics(
      matchedNodes,
      missingNodes,
      extraNodeIds.length,
    ),
    dependencyPresence: presenceMetrics(
      matchedDependencies,
      missingDeps,
      extraDependencyKeys.length,
    ),
    quantityState,
    documentConflictsPreserved: conflictPreservation.documentLevelPreserved,
    conflictPreservation,
  };
}
