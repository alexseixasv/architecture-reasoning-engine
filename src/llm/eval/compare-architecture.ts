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
};

export type ArchitectureCompareReport = {
  matchedNodes: number;
  expectedNodes: number;
  matchedDependencies: number;
  expectedDependencies: number;
  fieldComparisons: FieldComparison[];
  /** Matches / total field comparisons with explicit denominator. */
  fieldAccuracy: { matches: number; total: number };
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

function matchNode(
  expected: ArchitectureNode,
  actual: ArchitectureNode,
): FieldComparison[] {
  const prefix = `node:${expected.id}`;
  const rows: FieldComparison[] = [];
  const push = (path: string, exp: string, act: string) => {
    rows.push({ path, match: exp === act, expected: exp, actual: act });
  };
  push(`${prefix}.kind`, expected.kind, actual.kind);
  push(`${prefix}.replicas`, qtyKey(expected.replicas), qtyKey(actual.replicas));
  push(
    `${prefix}.capacityPerReplica`,
    qtyKey(expected.capacityPerReplica),
    qtyKey(actual.capacityPerReplica),
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
  );
  return rows;
}

/**
 * Compare architectures with order-insensitive node/edge matching by id.
 * Names may differ (semantic id match preferred).
 */
export function compareArchitectures(
  expected: ArchitectureDocument,
  actual: ArchitectureDocument,
): ArchitectureCompareReport {
  const fieldComparisons: FieldComparison[] = [];
  const actualNodes = new Map(actual.nodes.map((n) => [n.id, n]));
  let matchedNodes = 0;

  for (const exp of expected.nodes) {
    const act = actualNodes.get(exp.id);
    if (!act) {
      fieldComparisons.push({
        path: `node:${exp.id}`,
        match: false,
        expected: 'present',
        actual: 'missing',
      });
      continue;
    }
    matchedNodes += 1;
    fieldComparisons.push(...matchNode(exp, act));
  }

  const actualDeps = new Map(actual.dependencies.map((d) => [d.id, d]));
  let matchedDependencies = 0;
  for (const exp of expected.dependencies) {
    const act = actualDeps.get(exp.id);
    if (!act) {
      // try match by from+to+communication
      const alt = actual.dependencies.find(
        (d) =>
          d.from === exp.from &&
          d.to === exp.to &&
          d.communication === exp.communication,
      );
      if (!alt) {
        fieldComparisons.push({
          path: `dep:${exp.id}`,
          match: false,
          expected: 'present',
          actual: 'missing',
        });
        continue;
      }
      matchedDependencies += 1;
      fieldComparisons.push({
        path: `dep:${exp.from}->${exp.to}.communication`,
        match: true,
        expected: exp.communication,
        actual: alt.communication,
      });
      fieldComparisons.push({
        path: `dep:${exp.from}->${exp.to}.timeout`,
        match: qtyKey(exp.timeout) === qtyKey(alt.timeout),
        expected: qtyKey(exp.timeout),
        actual: qtyKey(alt.timeout),
      });
      fieldComparisons.push({
        path: `dep:${exp.from}->${exp.to}.requestsPerParent`,
        match: qtyKey(exp.requestsPerParent) === qtyKey(alt.requestsPerParent),
        expected: qtyKey(exp.requestsPerParent),
        actual: qtyKey(alt.requestsPerParent),
      });
      continue;
    }
    matchedDependencies += 1;
    fieldComparisons.push({
      path: `dep:${exp.id}.communication`,
      match: exp.communication === act.communication,
      expected: exp.communication,
      actual: act.communication,
    });
    fieldComparisons.push({
      path: `dep:${exp.id}.from`,
      match: exp.from === act.from,
      expected: exp.from,
      actual: act.from,
    });
    fieldComparisons.push({
      path: `dep:${exp.id}.to`,
      match: exp.to === act.to,
      expected: exp.to,
      actual: act.to,
    });
  }

  const trafficExp = qtyKey(expected.system?.incomingTraffic);
  const trafficAct = qtyKey(actual.system?.incomingTraffic);
  fieldComparisons.push({
    path: 'system.incomingTraffic',
    match: trafficExp === trafficAct,
    expected: trafficExp,
    actual: trafficAct,
  });

  const matches = fieldComparisons.filter((f) => f.match).length;
  return {
    matchedNodes,
    expectedNodes: expected.nodes.length,
    matchedDependencies,
    expectedDependencies: expected.dependencies.length,
    fieldComparisons,
    fieldAccuracy: { matches, total: fieldComparisons.length },
  };
}
