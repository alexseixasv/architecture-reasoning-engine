import { ZodError } from 'zod';
import { architectureDocumentSchema } from '../domain/schema';
import { finding } from '../domain/findings';
import type {
  ArchitectureDocument,
  ArchitectureNode,
  ValidationFinding,
  ValidationResult,
} from '../domain/types';

const MAX_NODES = 15;

function zodPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return '$';
  }
  return path
    .map((p) => (typeof p === 'number' ? `[${p}]` : String(p)))
    .join('.')
    .replace(/\.\[/g, '[');
}

export function mapZodError(error: ZodError): ValidationFinding[] {
  return error.issues.map((issue) =>
    finding({
      code: 'SCHEMA_INVALID',
      severity: 'ERROR',
      findingClass: 'schema',
      path: zodPath(issue.path),
      message: issue.message,
    }),
  );
}

function checkDuplicateIds(
  document: ArchitectureDocument,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const seenNodes = new Map<string, number>();
  const seenDeps = new Map<string, number>();
  const seenAssumptions = new Map<string, number>();
  const seenConflicts = new Map<string, number>();

  for (const [index, node] of document.nodes.entries()) {
    if (seenNodes.has(node.id)) {
      findings.push(
        finding({
          code: 'DUPLICATE_ID',
          severity: 'ERROR',
          findingClass: 'referential',
          path: `nodes[${index}].id`,
          message: `Duplicate node id "${node.id}"`,
          relatedIds: [node.id],
        }),
      );
    } else {
      seenNodes.set(node.id, index);
    }
  }

  for (const [index, dep] of document.dependencies.entries()) {
    if (seenDeps.has(dep.id)) {
      findings.push(
        finding({
          code: 'DUPLICATE_ID',
          severity: 'ERROR',
          findingClass: 'referential',
          path: `dependencies[${index}].id`,
          message: `Duplicate dependency id "${dep.id}"`,
          relatedIds: [dep.id],
        }),
      );
    } else {
      seenDeps.set(dep.id, index);
    }
  }

  for (const [index, assumption] of document.assumptions.entries()) {
    if (seenAssumptions.has(assumption.id)) {
      findings.push(
        finding({
          code: 'DUPLICATE_ID',
          severity: 'ERROR',
          findingClass: 'referential',
          path: `assumptions[${index}].id`,
          message: `Duplicate assumption id "${assumption.id}"`,
          relatedIds: [assumption.id],
        }),
      );
    } else {
      seenAssumptions.set(assumption.id, index);
    }
  }

  for (const [index, conflict] of document.conflicts.entries()) {
    if (seenConflicts.has(conflict.id)) {
      findings.push(
        finding({
          code: 'DUPLICATE_ID',
          severity: 'ERROR',
          findingClass: 'referential',
          path: `conflicts[${index}].id`,
          message: `Duplicate conflict id "${conflict.id}"`,
          relatedIds: [conflict.id],
        }),
      );
    } else {
      seenConflicts.set(conflict.id, index);
    }
  }

  return findings;
}

function checkReferences(
  document: ArchitectureDocument,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const nodeIds = new Set(document.nodes.map((n) => n.id));

  for (const [index, dep] of document.dependencies.entries()) {
    if (!nodeIds.has(dep.from)) {
      findings.push(
        finding({
          code: 'MISSING_NODE_REF',
          severity: 'ERROR',
          findingClass: 'referential',
          path: `dependencies[${index}].from`,
          message: `Dependency "${dep.id}" references missing from node "${dep.from}"`,
          relatedIds: [dep.id, dep.from],
        }),
      );
    }
    if (!nodeIds.has(dep.to)) {
      findings.push(
        finding({
          code: 'MISSING_NODE_REF',
          severity: 'ERROR',
          findingClass: 'referential',
          path: `dependencies[${index}].to`,
          message: `Dependency "${dep.id}" references missing to node "${dep.to}"`,
          relatedIds: [dep.id, dep.to],
        }),
      );
    }
  }

  for (const [index, conflict] of document.conflicts.entries()) {
    for (const nodeId of conflict.nodeIds) {
      if (!nodeIds.has(nodeId)) {
        findings.push(
          finding({
            code: 'MISSING_NODE_REF',
            severity: 'ERROR',
            findingClass: 'referential',
            path: `conflicts[${index}].nodeIds`,
            message: `Conflict "${conflict.id}" references missing node "${nodeId}"`,
            relatedIds: [conflict.id, nodeId],
          }),
        );
      }
    }
  }

  return findings;
}

function checkGraphSize(document: ArchitectureDocument): ValidationFinding[] {
  if (document.nodes.length <= MAX_NODES) {
    return [];
  }
  return [
    finding({
      code: 'GRAPH_TOO_LARGE',
      severity: 'ERROR',
      findingClass: 'referential',
      path: 'nodes',
      message: `Architecture has ${document.nodes.length} nodes; maximum supported is ${MAX_NODES}`,
    }),
  ];
}

function checkFieldConflicts(
  document: ArchitectureDocument,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const [index, node] of document.nodes.entries()) {
    for (const [cIndex, conflict] of (node.fieldConflicts ?? []).entries()) {
      if (conflict.candidates.length < 2) {
        findings.push(
          finding({
            code: 'INVALID_FIELD_CONFLICT',
            severity: 'ERROR',
            findingClass: 'schema',
            path: `nodes[${index}].fieldConflicts[${cIndex}]`,
            message: `Field conflict on "${conflict.field}" must retain at least two candidates`,
            relatedIds: [node.id],
          }),
        );
      }
    }
  }

  if (document.conflicts.length > 0 || document.nodes.some((n) => (n.fieldConflicts?.length ?? 0) > 0)) {
    findings.push(
      finding({
        code: 'CONTRADICTION_PRESENT',
        severity: 'WARNING',
        findingClass: 'semantic',
        path: 'conflicts',
        message:
          'Document preserves contradictory declarations; no value was auto-selected',
        relatedIds: document.conflicts.map((c) => c.id),
      }),
    );
  }

  return findings;
}

function findSyncCycles(document: ArchitectureDocument): string[][] {
  const adj = new Map<string, string[]>();
  for (const node of document.nodes) {
    adj.set(node.id, []);
  }
  for (const dep of document.dependencies) {
    if (dep.communication !== 'sync') {
      continue;
    }
    const list = adj.get(dep.from);
    if (list) {
      list.push(dep.to);
    }
  }

  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(nodeId: string): void {
    visiting.add(nodeId);
    stack.push(nodeId);
    for (const next of adj.get(nodeId) ?? []) {
      if (visiting.has(next)) {
        const start = stack.indexOf(next);
        cycles.push(stack.slice(start).concat(next));
        continue;
      }
      if (!visited.has(next)) {
        dfs(next);
      }
    }
    stack.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const node of document.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  return cycles;
}

function checkSemantic(document: ArchitectureDocument): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const cycle of findSyncCycles(document)) {
    findings.push(
      finding({
        code: 'SYNC_CYCLE',
        severity: 'WARNING',
        findingClass: 'semantic',
        path: 'dependencies',
        message: `Synchronous dependency cycle detected: ${cycle.join(' -> ')}`,
        relatedIds: [...new Set(cycle)],
      }),
    );
  }

  for (const [index, dep] of document.dependencies.entries()) {
    if (dep.communication === 'sync' && dep.timeout === undefined) {
      findings.push(
        finding({
          code: 'SYNC_MISSING_TIMEOUT',
          severity: 'WARNING',
          findingClass: 'semantic',
          path: `dependencies[${index}].timeout`,
          message: `Synchronous dependency "${dep.id}" has no timeout`,
          relatedIds: [dep.id],
        }),
      );
    }

    if (dep.retry !== undefined) {
      const attempts = dep.retry.additionalAttempts;
      const hasRetries =
        attempts.state === 'known' ? attempts.value > 0 : true;
      if (hasRetries && dep.retry.backoff.type === 'none') {
        findings.push(
          finding({
            code: 'RETRY_WITHOUT_BACKOFF',
            severity: 'WARNING',
            findingClass: 'semantic',
            path: `dependencies[${index}].retry.backoff`,
            message: `Dependency "${dep.id}" declares retries without backoff`,
            relatedIds: [dep.id],
          }),
        );
      }
    }
  }

  for (const [index, node] of document.nodes.entries()) {
    const hasCapacityIntent =
      node.capacityPerReplica !== undefined || node.replicas !== undefined;
    if (hasCapacityIntent && node.capacityAggregation === undefined) {
      findings.push(
        finding({
          code: 'CAPACITY_AGGREGATION_UNSPECIFIED',
          severity: 'WARNING',
          findingClass: 'semantic',
          path: `nodes[${index}].capacityAggregation`,
          message: `Node "${node.id}" has capacity/replica fields but no explicit capacityAggregation policy`,
          relatedIds: [node.id],
        }),
      );
    }
  }

  findings.push(...checkSpof(document));
  return findings;
}

function checkSpof(document: ArchitectureDocument): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const incoming = new Map<string, number>();
  for (const node of document.nodes) {
    incoming.set(node.id, 0);
  }
  for (const dep of document.dependencies) {
    incoming.set(dep.to, (incoming.get(dep.to) ?? 0) + 1);
  }

  for (const node of document.nodes) {
    if (node.kind !== 'datastore' && node.kind !== 'service') {
      continue;
    }
    const replicasKnown =
      node.replicas?.state === 'known' ? node.replicas.value : undefined;
    const isSingle =
      replicasKnown === undefined || replicasKnown === 1;
    const hasDependents = (incoming.get(node.id) ?? 0) > 0;
    if (isSingle && hasDependents) {
      findings.push(
        finding({
          code: 'SPOF',
          severity: 'WARNING',
          findingClass: 'semantic',
          path: `nodes[id=${node.id}]`,
          message: `Node "${node.id}" appears to be a single point of failure for dependents`,
          relatedIds: [node.id],
        }),
      );
    }
  }

  return findings;
}

function checkSimulationReadiness(
  document: ArchitectureDocument,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  const traffic = document.system?.incomingTraffic;
  if (traffic === undefined || traffic.state === 'unknown') {
    findings.push(
      finding({
        code: 'MISSING_BASELINE_TRAFFIC',
        severity: 'MISSING_INFORMATION',
        findingClass: 'simulation_readiness',
        path: 'system.incomingTraffic',
        message:
          'Baseline incoming traffic is missing or unknown; load-multiplication scenarios will not be answerable until provided',
      }),
    );
  }

  for (const node of document.nodes) {
    if (node.kind === 'queue') {
      continue;
    }
    if (
      node.capacityPerReplica === undefined ||
      node.capacityPerReplica.state === 'unknown' ||
      node.replicas === undefined ||
      node.replicas.state === 'unknown'
    ) {
      findings.push(
        finding({
          code: 'MISSING_CAPACITY',
          severity: 'MISSING_INFORMATION',
          findingClass: 'simulation_readiness',
          path: `nodes[id=${node.id}]`,
          message: `Node "${node.id}" lacks known replicas and/or capacityPerReplica for capacity calculations`,
          relatedIds: [node.id],
        }),
      );
    }
  }

  return findings;
}

export function validateArchitectureDocument(
  input: unknown,
): ValidationResult {
  let document: ArchitectureDocument;
  try {
    document = architectureDocumentSchema.parse(
      input,
    ) as ArchitectureDocument;
  } catch (error) {
    if (error instanceof ZodError) {
      const findings = mapZodError(error);
      return {
        ok: false,
        findings,
        canPersist: false,
      };
    }
    throw error;
  }

  const findings: ValidationFinding[] = [
    ...checkDuplicateIds(document),
    ...checkReferences(document),
    ...checkGraphSize(document),
    ...checkFieldConflicts(document),
    ...checkSemantic(document),
    ...checkSimulationReadiness(document),
  ];

  const canPersist = findings.every((f) => f.persistenceEffect === 'allow');

  return {
    ok: findings.every((f) => f.severity !== 'ERROR'),
    document,
    findings,
    canPersist,
  };
}

/** Helper for tests / Phase 3: compute nominal capacity only when policy allows. */
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
  // sum_replicas
  if (node.replicas === undefined || node.replicas.state !== 'known') {
    return { status: 'not_answerable', reason: 'replicas unknown' };
  }
  return {
    status: 'ok',
    value: node.replicas.value * node.capacityPerReplica.value,
  };
}
