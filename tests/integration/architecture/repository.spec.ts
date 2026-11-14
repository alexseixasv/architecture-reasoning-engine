import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArchitectureService } from '../../../src/architecture/application/architecture.service';
import {
  ArchitectureRepository,
  VersionConflictError,
} from '../../../src/architecture/infrastructure/architecture.repository';
import { closeDb, createDb } from '../../../src/persistence/db';
import { runMigrations } from '../../../src/persistence/migrate';
import { checkoutPricingDocument } from '../../fixtures/architectures/checkout-pricing';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';

const databaseUrl = process.env['DATABASE_URL'];

function minimalServicePair(overrides: Partial<ArchitectureDocument> = {}): ArchitectureDocument {
  return {
    schemaVersion: '1.0.0',
    name: `arch-${randomUUID()}`,
    nodes: [
      {
        id: 'a',
        kind: 'service',
        name: 'A',
        replicas: { state: 'known', value: 2, unit: 'count', provenance: 'declared' },
        capacityPerReplica: {
          state: 'known',
          value: 10,
          unit: 'rps',
          provenance: 'declared',
        },
        capacityAggregation: 'sum_replicas',
      },
      {
        id: 'b',
        kind: 'service',
        name: 'B',
        replicas: { state: 'known', value: 2, unit: 'count', provenance: 'declared' },
        capacityPerReplica: {
          state: 'known',
          value: 10,
          unit: 'rps',
          provenance: 'declared',
        },
        capacityAggregation: 'sum_replicas',
      },
    ],
    dependencies: [
      {
        id: 'a-b',
        from: 'a',
        to: 'b',
        communication: 'sync',
        timeout: { state: 'known', value: 1000, unit: 'ms', provenance: 'declared' },
      },
    ],
    system: {
      incomingTraffic: {
        state: 'known',
        value: 5,
        unit: 'rps',
        provenance: 'declared',
      },
    },
    assumptions: [],
    conflicts: [],
    ...overrides,
  };
}

describe.runIf(Boolean(databaseUrl))('ArchitectureRepository integration', () => {
  let repository: ArchitectureRepository;
  let service: ArchitectureService;

  beforeAll(async () => {
    await runMigrations(databaseUrl);
    const db = createDb(databaseUrl);
    repository = new ArchitectureRepository(db);
    service = new ArchitectureService(repository);
  }, 60_000);

  afterAll(async () => {
    await closeDb();
  });

  it('keeps prior versions immutable and readable after update', async () => {
    const created = await service.create(checkoutPricingDocument);
    expect(created.version).toBe(1);
    const originalV1 = structuredClone(created.document);

    const corrected: ArchitectureDocument = {
      ...checkoutPricingDocument,
      nodes: checkoutPricingDocument.nodes.map((node) => {
        if (node.id !== 'pricing') {
          return node;
        }
        const { fieldConflicts: _removed, ...rest } = node;
        return {
          ...rest,
          replicas: {
            state: 'known',
            value: 4,
            unit: 'count',
            provenance: 'user_confirmed',
          },
        };
      }),
      conflicts: [],
    };

    const updated = await service.update(created.architectureId, 1, corrected);
    expect(updated.version).toBe(2);

    const versions = await service.listVersions(created.architectureId);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);

    const v1 = await service.getVersion(created.architectureId, 1);
    expect(v1.version).toBe(1);
    expect(v1.document).toEqual(originalV1);
    expect(v1.document.conflicts).toHaveLength(1);
    expect(
      v1.document.nodes.find((n) => n.id === 'pricing')?.replicas,
    ).toEqual({
      state: 'known',
      value: 4,
      unit: 'count',
      provenance: 'declared',
    });

    const v2 = await service.getVersion(created.architectureId, 2);
    expect(v2.document.conflicts).toEqual([]);
    expect(
      v2.document.nodes.find((n) => n.id === 'pricing')?.replicas?.provenance,
    ).toBe('user_confirmed');

    const diff = await service.diff(created.architectureId, 1, 2);
    expect(diff.changes.length).toBeGreaterThan(0);
  });

  it('persists structurally valid architecture with semantic WARNING findings', async () => {
    const cyclic = minimalServicePair({
      dependencies: [
        {
          id: 'a-b',
          from: 'a',
          to: 'b',
          communication: 'sync',
          // intentionally missing timeout → SYNC_MISSING_TIMEOUT
        },
        {
          id: 'b-a',
          from: 'b',
          to: 'a',
          communication: 'sync',
          timeout: {
            state: 'known',
            value: 100,
            unit: 'ms',
            provenance: 'declared',
          },
        },
      ],
    });

    const stored = await service.create(cyclic);
    expect(stored.version).toBe(1);
    expect(stored.findings.some((f) => f.code === 'SYNC_CYCLE')).toBe(true);
    expect(stored.findings.some((f) => f.code === 'SYNC_MISSING_TIMEOUT')).toBe(
      true,
    );
    expect(stored.findings.every((f) => f.severity !== 'ERROR')).toBe(true);

    const reloaded = await service.getLatest(stored.architectureId);
    expect(reloaded.findings.some((f) => f.code === 'SYNC_CYCLE')).toBe(true);
    expect(reloaded.document.dependencies).toHaveLength(2);
  });

  it('accepts exactly one of two concurrent updates with the same expectedVersion', async () => {
    const created = await service.create(
      minimalServicePair({ name: `concurrent-${randomUUID()}` }),
    );
    expect(created.version).toBe(1);

    const updateA = service.update(created.architectureId, 1, {
      ...minimalServicePair(),
      name: 'writer-a',
    });
    const updateB = service.update(created.architectureId, 1, {
      ...minimalServicePair(),
      name: 'writer-b',
    });

    const settled = await Promise.allSettled([updateA, updateB]);
    const fulfilled = settled.filter((r) => r.status === 'fulfilled');
    const rejected = settled.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const winner = (fulfilled[0] as PromiseFulfilledResult<Awaited<typeof updateA>>)
      .value;
    expect(winner.version).toBe(2);
    expect(['writer-a', 'writer-b']).toContain(winner.document.name);

    const failure = (rejected[0] as PromiseRejectedResult).reason;
    expect(failure).toBeInstanceOf(VersionConflictError);
    expect((failure as VersionConflictError).expectedVersion).toBe(1);
    expect((failure as VersionConflictError).actualVersion).toBe(2);

    const versions = await service.listVersions(created.architectureId);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);

    const latest = await service.getLatest(created.architectureId);
    expect(latest.version).toBe(2);
    expect(latest.document.name).toBe(winner.document.name);
  });
});
