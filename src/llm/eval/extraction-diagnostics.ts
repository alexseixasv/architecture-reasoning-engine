import type { ArchitectureDocument } from '../../architecture/domain/types';
import type { ValidationFinding } from '../../architecture/domain/types';
import type {
  ArchitectureExtractionDto,
  ExtractedQuantity,
} from '../dto/architecture-extraction.dto';

export type QuantityLossCause =
  | 'missing_in_dto'
  | 'provenance_rejection'
  | 'mapper_unit_or_transform'
  | 'comparator_only'
  | 'inconclusive';

export type QuantityDiagnostic = {
  path: string;
  dtoPresence: 'declared' | 'unknown' | 'omitted' | 'absent';
  mappedState: 'known' | 'unknown' | 'omitted';
  cause: QuantityLossCause;
};

export type ArchitectureExtractionDiagnostics = {
  dtoNodeIds: string[];
  dtoDependencyIds: string[];
  dtoDependencyEndpoints: Array<{ id: string; from: string; to: string }>;
  ingressNodeIds: string[];
  ingressDeclared: boolean;
  quantityDiagnostics: QuantityDiagnostic[];
  provenanceFindingPaths: string[];
  findingCodes: string[];
  documentSummary: {
    nodeIds: string[];
    dependencyIds: string[];
    fieldConflictNodeIds: string[];
    documentConflictIds: string[];
  };
};

function presenceOf(q: ExtractedQuantity | undefined): QuantityDiagnostic['dtoPresence'] {
  if (q === undefined) {
    return 'absent';
  }
  return q.presence;
}

function mappedQtyState(
  doc: ArchitectureDocument,
  kind: 'nodeReplicas' | 'nodeCapacity' | 'traffic' | 'depTimeout' | 'depRpp',
  id?: string,
): QuantityDiagnostic['mappedState'] {
  if (kind === 'traffic') {
    const q = doc.system?.incomingTraffic;
    if (!q) return 'omitted';
    return q.state === 'unknown' ? 'unknown' : 'known';
  }
  if (kind === 'nodeReplicas' || kind === 'nodeCapacity') {
    const n = doc.nodes.find((x) => x.id === id);
    const q = kind === 'nodeReplicas' ? n?.replicas : n?.capacityPerReplica;
    if (!q) return 'omitted';
    return q.state === 'unknown' ? 'unknown' : 'known';
  }
  const d = doc.dependencies.find((x) => x.id === id);
  const q = kind === 'depTimeout' ? d?.timeout : d?.requestsPerParent;
  if (!q) return 'omitted';
  return q.state === 'unknown' ? 'unknown' : 'known';
}

function classifyCause(
  dtoPresence: QuantityDiagnostic['dtoPresence'],
  mapped: QuantityDiagnostic['mappedState'],
  path: string,
  provenancePaths: Set<string>,
): QuantityLossCause {
  if (dtoPresence === 'omitted' || dtoPresence === 'absent') {
    if (mapped === 'omitted') {
      return 'missing_in_dto';
    }
    return 'mapper_unit_or_transform';
  }
  if (dtoPresence === 'unknown') {
    return mapped === 'unknown' ? 'missing_in_dto' : 'mapper_unit_or_transform';
  }
  // declared in DTO
  if (mapped === 'known') {
    return 'comparator_only';
  }
  if (mapped === 'unknown') {
    if ([...provenancePaths].some((p) => path.startsWith(p) || p.startsWith(path))) {
      return 'provenance_rejection';
    }
    // unit mismatch / other mapper downgrades without provenance finding
    return 'mapper_unit_or_transform';
  }
  // declared → omitted should not happen in mapper; treat as transform anomaly
  return 'mapper_unit_or_transform';
}

/**
 * Sanitized diagnostics to distinguish missing DTO values vs provenance vs mapper.
 * Does not include raw architecture prose or secrets.
 */
export function buildArchitectureExtractionDiagnostics(input: {
  dto: ArchitectureExtractionDto;
  document: ArchitectureDocument;
  findings: ValidationFinding[];
}): ArchitectureExtractionDiagnostics {
  const provenanceFindingPaths = input.findings
    .filter((f) => f.code === 'PROVENANCE_UNVERIFIED')
    .map((f) => f.path);
  const unitMismatchPaths = new Set(
    input.findings.filter((f) => f.code === 'UNIT_MISMATCH').map((f) => f.path),
  );
  const provenanceSet = new Set(provenanceFindingPaths);

  const quantityDiagnostics: QuantityDiagnostic[] = [];

  const push = (
    path: string,
    dtoPresence: QuantityDiagnostic['dtoPresence'],
    mapped: QuantityDiagnostic['mappedState'],
  ) => {
    let cause = classifyCause(dtoPresence, mapped, path, provenanceSet);
    if (
      dtoPresence === 'declared' &&
      mapped === 'unknown' &&
      unitMismatchPaths.has(path)
    ) {
      cause = 'mapper_unit_or_transform';
    }
    quantityDiagnostics.push({
      path,
      dtoPresence,
      mappedState: mapped,
      cause,
    });
  };

  for (const [i, n] of input.dto.nodes.entries()) {
    push(
      `nodes[${i}].replicas`,
      presenceOf(n.replicas),
      mappedQtyState(input.document, 'nodeReplicas', n.id),
    );
    push(
      `nodes[${i}].capacityPerReplica`,
      presenceOf(n.capacityPerReplica),
      mappedQtyState(input.document, 'nodeCapacity', n.id),
    );
  }
  for (const [i, d] of input.dto.dependencies.entries()) {
    push(
      `dependencies[${i}].timeout`,
      presenceOf(d.timeout),
      mappedQtyState(input.document, 'depTimeout', d.id),
    );
    push(
      `dependencies[${i}].requestsPerParent`,
      presenceOf(d.requestsPerParent),
      mappedQtyState(input.document, 'depRpp', d.id),
    );
  }
  push(
    'system.incomingTraffic',
    presenceOf(input.dto.incomingTraffic),
    mappedQtyState(input.document, 'traffic'),
  );

  return {
    dtoNodeIds: input.dto.nodes.map((n) => n.id),
    dtoDependencyIds: input.dto.dependencies.map((d) => d.id),
    dtoDependencyEndpoints: input.dto.dependencies.map((d) => ({
      id: d.id,
      from: d.from,
      to: d.to,
    })),
    ingressNodeIds: [...input.dto.ingressNodeIds],
    ingressDeclared: input.dto.ingressDeclared,
    quantityDiagnostics,
    provenanceFindingPaths,
    findingCodes: [...new Set(input.findings.map((f) => f.code))].sort(),
    documentSummary: {
      nodeIds: input.document.nodes.map((n) => n.id),
      dependencyIds: input.document.dependencies.map((d) => d.id),
      fieldConflictNodeIds: input.document.nodes
        .filter((n) => (n.fieldConflicts?.length ?? 0) > 0)
        .map((n) => n.id),
      documentConflictIds: input.document.conflicts.map((c) => c.id),
    },
  };
}
