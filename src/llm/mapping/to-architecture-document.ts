import type {
  ArchitectureDependency,
  ArchitectureDocument,
  ArchitectureNode,
  Backoff,
  CapacityAggregation,
  DocumentConflict,
  FieldConflict,
  Quantity,
  Unit,
  ValidationFinding,
} from '../../architecture/domain/types';
import { SCHEMA_VERSION } from '../../architecture/domain/types';
import type {
  ArchitectureExtractionDto,
  ExtractedQuantity,
} from '../dto/architecture-extraction.dto';
import { excerptAppearsInSource, provenanceFinding } from './provenance';

export type MapArchitectureResult = {
  document: ArchitectureDocument;
  findings: ValidationFinding[];
};

function mapQuantity<U extends Unit>(
  q: ExtractedQuantity,
  expectedUnit: U,
  path: string,
  sourceText: string,
  findings: ValidationFinding[],
): Quantity<U> | undefined {
  if (q.presence === 'omitted') {
    return undefined;
  }
  if (q.presence === 'unknown') {
    if (q.reason.trim().length > 0) {
      return {
        state: 'unknown' as const,
        unit: expectedUnit,
        reason: q.reason,
      };
    }
    return {
      state: 'unknown' as const,
      unit: expectedUnit,
    };
  }

  // declared
  if (q.unit !== expectedUnit) {
    findings.push(
      provenanceFinding(
        path,
        `unit mismatch: extracted ${q.unit}, expected ${expectedUnit}`,
      ),
    );
    return {
      state: 'unknown',
      unit: expectedUnit,
      reason: `unit mismatch (${q.unit} vs ${expectedUnit})`,
    };
  }

  if (!excerptAppearsInSource(sourceText, q.sourceExcerpt)) {
    findings.push(provenanceFinding(path, q.sourceExcerpt));
    return {
      state: 'unknown',
      unit: expectedUnit,
      reason: 'provenance excerpt not found in source text',
    };
  }

  return {
    state: 'known',
    value: q.value,
    unit: expectedUnit,
    provenance: 'declared',
    note: `source: ${q.sourceExcerpt}`,
  };
}

function mapConflictCandidates(
  candidates: { value: number; unit: Unit; sourceExcerpt: string }[],
  path: string,
  sourceText: string,
  findings: ValidationFinding[],
): Quantity[] {
  const out: Quantity[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    if (!excerptAppearsInSource(sourceText, c.sourceExcerpt)) {
      findings.push(provenanceFinding(`${path}[${i}]`, c.sourceExcerpt));
      out.push({
        state: 'unknown',
        unit: c.unit,
        reason: 'conflict candidate provenance unverified',
      });
      continue;
    }
    out.push({
      state: 'known',
      value: c.value,
      unit: c.unit,
      provenance: 'declared',
      note: `source: ${c.sourceExcerpt}`,
    });
  }
  return out;
}

type ExtractedBackoff = Extract<
  Extract<
    ArchitectureExtractionDto['dependencies'][number]['retry'],
    { presence: 'declared' }
  >['backoff'],
  { type: string }
>;

function mapBackoff(
  backoff: ExtractedBackoff,
  path: string,
  sourceText: string,
  findings: ValidationFinding[],
): Backoff | undefined {
  switch (backoff.type) {
    case 'omitted':
      return undefined;
    case 'none':
      return { type: 'none' };
    case 'fixed': {
      const delayMs = mapQuantity(
        backoff.delayMs,
        'ms',
        `${path}.delayMs`,
        sourceText,
        findings,
      );
      if (delayMs === undefined) {
        return undefined;
      }
      return { type: 'fixed', delayMs };
    }
    case 'exponential': {
      const initialDelayMs = mapQuantity(
        backoff.initialDelayMs,
        'ms',
        `${path}.initialDelayMs`,
        sourceText,
        findings,
      );
      const multiplier = mapQuantity(
        backoff.multiplier,
        'ratio',
        `${path}.multiplier`,
        sourceText,
        findings,
      );
      if (initialDelayMs === undefined || multiplier === undefined) {
        return undefined;
      }
      return { type: 'exponential', initialDelayMs, multiplier };
    }
    default:
      return undefined;
  }
}

export function mapExtractionToArchitectureDocument(
  dto: ArchitectureExtractionDto,
  sourceText: string,
): MapArchitectureResult {
  const findings: ValidationFinding[] = [];

  const nodes: ArchitectureNode[] = dto.nodes.map((n, ni) => {
    const node: ArchitectureNode = {
      id: n.id,
      kind: n.kind,
      name: n.name,
    };

    const replicas = mapQuantity(
      n.replicas,
      'count',
      `nodes[${ni}].replicas`,
      sourceText,
      findings,
    );
    if (replicas) {
      node.replicas = replicas;
    }

    const cap = mapQuantity(
      n.capacityPerReplica,
      'rps',
      `nodes[${ni}].capacityPerReplica`,
      sourceText,
      findings,
    );
    if (cap) {
      node.capacityPerReplica = cap;
    }

    if (n.capacityAggregation !== 'omitted') {
      node.capacityAggregation = n.capacityAggregation as CapacityAggregation;
    }

    const lat = mapQuantity(
      n.declaredLatency,
      'ms',
      `nodes[${ni}].declaredLatency`,
      sourceText,
      findings,
    );
    if (lat) {
      node.declaredLatency = lat;
    }

    if (n.fieldConflicts.length > 0) {
      const fieldConflicts: FieldConflict[] = n.fieldConflicts.map((fc, fi) => {
        const conflict: FieldConflict = {
          field: fc.field,
          candidates: mapConflictCandidates(
            fc.candidates,
            `nodes[${ni}].fieldConflicts[${fi}].candidates`,
            sourceText,
            findings,
          ),
        };
        if (fc.note) {
          conflict.note = fc.note;
        }
        return conflict;
      });
      node.fieldConflicts = fieldConflicts;
    }

    return node;
  });

  const dependencies: ArchitectureDependency[] = dto.dependencies.map(
    (d, di) => {
      const dep: ArchitectureDependency = {
        id: d.id,
        from: d.from,
        to: d.to,
        communication: d.communication,
      };

      const timeout = mapQuantity(
        d.timeout,
        'ms',
        `dependencies[${di}].timeout`,
        sourceText,
        findings,
      );
      if (timeout) {
        dep.timeout = timeout;
      }

      const rpp = mapQuantity(
        d.requestsPerParent,
        'ratio',
        `dependencies[${di}].requestsPerParent`,
        sourceText,
        findings,
      );
      if (rpp) {
        dep.requestsPerParent = rpp;
      }

      if (d.retry.presence === 'declared') {
        const additionalAttempts = mapQuantity(
          d.retry.additionalAttempts,
          'count',
          `dependencies[${di}].retry.additionalAttempts`,
          sourceText,
          findings,
        );
        const backoff = mapBackoff(
          d.retry.backoff,
          `dependencies[${di}].retry.backoff`,
          sourceText,
          findings,
        );
        if (additionalAttempts && backoff) {
          dep.retry = { additionalAttempts, backoff };
        }
      }

      return dep;
    },
  );

  const conflicts: DocumentConflict[] = dto.documentConflicts.map((c, ci) => {
    const conflict: DocumentConflict = {
      id: c.id,
      description: c.description,
      nodeIds: c.nodeIds,
      candidates: mapConflictCandidates(
        c.candidates,
        `conflicts[${ci}].candidates`,
        sourceText,
        findings,
      ),
    };
    if (c.field) {
      conflict.field = c.field;
    }
    return conflict;
  });

  const document: ArchitectureDocument = {
    schemaVersion: SCHEMA_VERSION,
    nodes,
    dependencies,
    assumptions: [],
    conflicts,
  };

  if (dto.name.trim()) {
    document.name = dto.name.trim();
  }
  if (dto.description.trim()) {
    document.description = dto.description.trim();
  }

  const system: ArchitectureDocument['system'] = {};
  const traffic = mapQuantity(
    dto.incomingTraffic,
    'rps',
    'system.incomingTraffic',
    sourceText,
    findings,
  );
  if (traffic) {
    system.incomingTraffic = traffic;
  }
  const avail = mapQuantity(
    dto.availabilityTarget,
    'percent',
    'system.availabilityTarget',
    sourceText,
    findings,
  );
  if (avail) {
    system.availabilityTarget = avail;
  }
  if (dto.ingressDeclared && dto.ingressNodeIds.length > 0) {
    // ingress ids are structural, not numeric — still require they reference nodes
    system.ingressNodeIds = [...dto.ingressNodeIds];
  }
  if (Object.keys(system).length > 0) {
    document.system = system;
  }

  return { document, findings };
}
