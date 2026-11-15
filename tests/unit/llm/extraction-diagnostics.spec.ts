import { describe, expect, it } from 'vitest';
import { mapExtractionToArchitectureDocument } from '../../../src/llm/mapping/to-architecture-document';
import { buildArchitectureExtractionDiagnostics } from '../../../src/llm/eval/extraction-diagnostics';
import {
  SAMPLE_ARCH_TEXT,
  baseArchitectureDto,
  declared,
  omitted,
} from './helpers';

describe('buildArchitectureExtractionDiagnostics', () => {
  it('classifies omitted DTO quantity as missing_in_dto when mapped omitted', () => {
    const dto = baseArchitectureDto({
      nodes: [
        {
          id: 'api',
          kind: 'service',
          name: 'API',
          replicas: omitted(),
          capacityPerReplica: declared(80, 'rps', '80 requests per second'),
          capacityAggregation: 'sum_replicas',
          declaredLatency: omitted(),
          fieldConflicts: [],
        },
      ],
    });
    const mapped = mapExtractionToArchitectureDocument(dto, SAMPLE_ARCH_TEXT);
    const diag = buildArchitectureExtractionDiagnostics({
      dto,
      document: mapped.document,
      findings: mapped.findings,
    });
    const replicas = diag.quantityDiagnostics.find(
      (q) => q.path === 'nodes[0].replicas',
    );
    expect(replicas?.cause).toBe('missing_in_dto');
    expect(replicas?.dtoPresence).toBe('omitted');
    expect(replicas?.mappedState).toBe('omitted');
  });

  it('classifies provenance rejection when excerpt is not in source', () => {
    const dto = baseArchitectureDto({
      nodes: [
        {
          id: 'api',
          kind: 'service',
          name: 'API',
          replicas: declared(4, 'count', 'EXCERPT_NOT_IN_SOURCE'),
          capacityPerReplica: declared(80, 'rps', '80 requests per second'),
          capacityAggregation: 'sum_replicas',
          declaredLatency: omitted(),
          fieldConflicts: [],
        },
      ],
    });
    const mapped = mapExtractionToArchitectureDocument(dto, SAMPLE_ARCH_TEXT);
    const diag = buildArchitectureExtractionDiagnostics({
      dto,
      document: mapped.document,
      findings: mapped.findings,
    });
    const replicas = diag.quantityDiagnostics.find(
      (q) => q.path === 'nodes[0].replicas',
    );
    expect(replicas?.cause).toBe('provenance_rejection');
    expect(diag.provenanceFindingPaths.length).toBeGreaterThan(0);
  });

  it('marks declared+mapped known quantities as comparator_only (mismatch is external)', () => {
    const dto = baseArchitectureDto();
    const mapped = mapExtractionToArchitectureDocument(dto, SAMPLE_ARCH_TEXT);
    const diag = buildArchitectureExtractionDiagnostics({
      dto,
      document: mapped.document,
      findings: mapped.findings,
    });
    const replicas = diag.quantityDiagnostics.find(
      (q) => q.path === 'nodes[0].replicas',
    );
    expect(replicas?.cause).toBe('comparator_only');
    expect(replicas?.mappedState).toBe('known');
  });
});
