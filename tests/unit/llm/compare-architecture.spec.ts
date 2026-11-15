import { describe, expect, it } from 'vitest';
import { architectureDocumentSchema } from '../../../src/architecture/domain/schema';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';
import { compareArchitectures } from '../../../src/llm/eval/compare-architecture';

function baseDoc(): ArchitectureDocument {
  return architectureDocumentSchema.parse({
    schemaVersion: '1.0.0',
    nodes: [
      {
        id: 'api',
        kind: 'service',
        name: 'API',
        replicas: {
          state: 'known',
          value: 4,
          unit: 'count',
          provenance: 'declared',
        },
        capacityPerReplica: {
          state: 'known',
          value: 80,
          unit: 'rps',
          provenance: 'declared',
        },
        capacityAggregation: 'sum_replicas',
      },
    ],
    dependencies: [],
    system: {
      incomingTraffic: {
        state: 'known',
        value: 80,
        unit: 'rps',
        provenance: 'declared',
      },
      ingressNodeIds: ['api'],
    },
    assumptions: [],
    conflicts: [],
  }) as ArchitectureDocument;
}

describe('compareArchitectures semantic scoring', () => {
  it('scores perfect match with field denominator', () => {
    const doc = baseDoc();
    const report = compareArchitectures(doc, structuredClone(doc));
    expect(report.fieldAccuracy.matches).toBe(report.fieldAccuracy.total);
    expect(report.extraNodeIds).toEqual([]);
    expect(report.nodePresence.f1).toBe(1);
  });

  it('counts missing and extra nodes in presence metrics', () => {
    const expected = baseDoc();
    const actual = structuredClone(expected);
    actual.nodes.push({
      id: 'ghost',
      kind: 'service',
      name: 'Ghost',
      capacityAggregation: 'sum_replicas',
    });
    actual.nodes = actual.nodes.filter((n) => n.id !== 'api');
    const report = compareArchitectures(expected, actual);
    expect(report.extraNodeIds).toContain('ghost');
    expect(report.nodePresence.falsePositives).toBe(1);
    expect(report.nodePresence.falseNegatives).toBe(1);
    expect(
      report.fieldComparisons.some((f) => f.kind === 'extra' && !f.match),
    ).toBe(true);
  });

  it('detects known→unknown and unknown→known quantity hallucinations', () => {
    const expected = baseDoc();
    const toUnknown = structuredClone(expected);
    toUnknown.nodes[0]!.replicas = { state: 'unknown', unit: 'count' };
    const a = compareArchitectures(expected, toUnknown);
    expect(a.quantityState.knownToUnknown).toBeGreaterThan(0);

    const expectedUnknown = structuredClone(expected);
    expectedUnknown.nodes[0]!.replicas = { state: 'unknown', unit: 'count' };
    const invented = structuredClone(expectedUnknown);
    invented.nodes[0]!.replicas = {
      state: 'known',
      value: 99,
      unit: 'count',
      provenance: 'declared',
    };
    const b = compareArchitectures(expectedUnknown, invented);
    expect(b.quantityState.unknownToKnown).toBeGreaterThan(0);
  });

  it('requires document-level conflict preservation when expected document conflicts exist', () => {
    const expected = baseDoc();
    expected.conflicts = [
      {
        id: 'c1',
        description: 'replicas disagree',
        nodeIds: ['api'],
        candidates: [],
      },
    ];
    const actual = structuredClone(baseDoc());
    const report = compareArchitectures(expected, actual);
    expect(report.documentConflictsPreserved).toBe(false);
    expect(report.conflictPreservation.documentLevelPreserved).toBe(false);
    expect(report.conflictPreservation.expectedDocumentConflicts).toBe(1);
  });

  it('distinguishes field-level preservation from extra document conflicts (V12-style)', () => {
    const expected = baseDoc();
    expected.nodes[0]!.fieldConflicts = [
      {
        field: 'replicas',
        candidates: [
          {
            state: 'known',
            value: 4,
            unit: 'count',
            provenance: 'declared',
          },
          {
            state: 'known',
            value: 6,
            unit: 'count',
            provenance: 'declared',
          },
        ],
      },
    ];
    // Actual preserves fieldConflicts but also emits a mis-leveled document conflict
    const actual = structuredClone(expected);
    actual.conflicts = [
      {
        id: 'misleveled',
        description: 'should have been fieldConflicts only',
        nodeIds: ['api'],
        candidates: [],
      },
    ];
    const report = compareArchitectures(expected, actual);
    expect(report.conflictPreservation.fieldLevelPreserved).toBe(true);
    expect(report.conflictPreservation.documentLevelPreserved).toBeNull();
    expect(report.conflictPreservation.extraDocumentConflicts).toBe(1);
    expect(
      report.fieldComparisons.find(
        (f) => f.path === 'conflicts.documentLevel.extra',
      )?.kind,
    ).toBe('extra');
    // Must not claim failed document preservation when expected had none
    expect(
      report.fieldComparisons.some(
        (f) => f.path === 'conflicts.documentLevel.preserved',
      ),
    ).toBe(false);
  });

  it('scores missing fieldConflicts as field-level preservation failure', () => {
    const expected = baseDoc();
    expected.nodes[0]!.fieldConflicts = [
      {
        field: 'replicas',
        candidates: [
          {
            state: 'known',
            value: 4,
            unit: 'count',
            provenance: 'declared',
          },
          {
            state: 'known',
            value: 6,
            unit: 'count',
            provenance: 'declared',
          },
        ],
      },
    ];
    const actual = structuredClone(baseDoc());
    const report = compareArchitectures(expected, actual);
    expect(report.conflictPreservation.fieldLevelPreserved).toBe(false);
  });

  it('compares ingress and traffic', () => {
    const expected = baseDoc();
    const actual = structuredClone(expected);
    actual.system = {
      ...actual.system!,
      ingressNodeIds: ['other'],
      incomingTraffic: { state: 'unknown', unit: 'rps' },
    };
    const report = compareArchitectures(expected, actual);
    expect(
      report.fieldComparisons.find((f) => f.path === 'system.ingressNodeIds')
        ?.match,
    ).toBe(false);
    expect(
      report.fieldComparisons.find((f) => f.path === 'system.incomingTraffic')
        ?.match,
    ).toBe(false);
  });
});
