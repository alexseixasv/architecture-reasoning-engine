import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDatabase } from '../../persistence/db';
import {
  architectures,
  architectureVersions,
} from '../../persistence/schema';
import type {
  ArchitectureDocument,
  ValidationFinding,
} from '../domain/types';

export class VersionConflictError extends Error {
  constructor(
    readonly architectureId: string,
    readonly expectedVersion: number,
    readonly actualVersion: number,
  ) {
    super(
      `Version conflict for architecture ${architectureId}: expected ${expectedVersion}, actual ${actualVersion}`,
    );
    this.name = 'VersionConflictError';
  }
}

export class ArchitectureNotFoundError extends Error {
  constructor(readonly architectureId: string) {
    super(`Architecture ${architectureId} not found`);
    this.name = 'ArchitectureNotFoundError';
  }
}

export class ArchitectureVersionNotFoundError extends Error {
  constructor(
    readonly architectureId: string,
    readonly version: number,
  ) {
    super(
      `Architecture ${architectureId} version ${version} not found`,
    );
    this.name = 'ArchitectureVersionNotFoundError';
  }
}

export type StoredArchitectureVersion = {
  architectureId: string;
  version: number;
  document: ArchitectureDocument;
  findings: ValidationFinding[];
  changeSource: string;
  createdAt: Date;
};

export type VersionListItem = {
  version: number;
  createdAt: Date;
  changeSource: string;
};

export class ArchitectureRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(
    document: ArchitectureDocument,
    findings: ValidationFinding[],
  ): Promise<StoredArchitectureVersion> {
    return this.db.transaction(async (tx) => {
      const [arch] = await tx
        .insert(architectures)
        .values({ latestVersion: 1 })
        .returning();

      if (!arch) {
        throw new Error('Failed to insert architecture');
      }

      const [version] = await tx
        .insert(architectureVersions)
        .values({
          architectureId: arch.id,
          version: 1,
          document,
          validationSummary: findings,
          changeSource: 'manual',
        })
        .returning();

      if (!version) {
        throw new Error('Failed to insert architecture version');
      }

      return {
        architectureId: arch.id,
        version: version.version,
        document: version.document as ArchitectureDocument,
        findings: version.validationSummary as ValidationFinding[],
        changeSource: version.changeSource,
        createdAt: version.createdAt,
      };
    });
  }

  async update(
    architectureId: string,
    expectedVersion: number,
    document: ArchitectureDocument,
    findings: ValidationFinding[],
  ): Promise<StoredArchitectureVersion> {
    return this.db.transaction(async (tx) => {
      const nextVersion = expectedVersion + 1;

      const updated = await tx
        .update(architectures)
        .set({
          latestVersion: nextVersion,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(architectures.id, architectureId),
            eq(architectures.latestVersion, expectedVersion),
          ),
        )
        .returning();

      if (updated.length === 0) {
        const [current] = await tx
          .select()
          .from(architectures)
          .where(eq(architectures.id, architectureId))
          .limit(1);

        if (!current) {
          throw new ArchitectureNotFoundError(architectureId);
        }

        throw new VersionConflictError(
          architectureId,
          expectedVersion,
          current.latestVersion,
        );
      }

      const [version] = await tx
        .insert(architectureVersions)
        .values({
          architectureId,
          version: nextVersion,
          document,
          validationSummary: findings,
          changeSource: 'manual',
        })
        .returning();

      if (!version) {
        throw new Error('Failed to insert architecture version');
      }

      return {
        architectureId,
        version: version.version,
        document: version.document as ArchitectureDocument,
        findings: version.validationSummary as ValidationFinding[],
        changeSource: version.changeSource,
        createdAt: version.createdAt,
      };
    });
  }

  async getLatest(
    architectureId: string,
  ): Promise<StoredArchitectureVersion> {
    const [arch] = await this.db
      .select()
      .from(architectures)
      .where(eq(architectures.id, architectureId))
      .limit(1);

    if (!arch) {
      throw new ArchitectureNotFoundError(architectureId);
    }

    return this.getVersion(architectureId, arch.latestVersion);
  }

  async getVersion(
    architectureId: string,
    version: number,
  ): Promise<StoredArchitectureVersion> {
    const [row] = await this.db
      .select()
      .from(architectureVersions)
      .where(
        and(
          eq(architectureVersions.architectureId, architectureId),
          eq(architectureVersions.version, version),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ArchitectureVersionNotFoundError(architectureId, version);
    }

    return {
      architectureId: row.architectureId,
      version: row.version,
      document: row.document as ArchitectureDocument,
      findings: row.validationSummary as ValidationFinding[],
      changeSource: row.changeSource,
      createdAt: row.createdAt,
    };
  }

  async listVersions(architectureId: string): Promise<VersionListItem[]> {
    const [arch] = await this.db
      .select()
      .from(architectures)
      .where(eq(architectures.id, architectureId))
      .limit(1);

    if (!arch) {
      throw new ArchitectureNotFoundError(architectureId);
    }

    const rows = await this.db
      .select({
        version: architectureVersions.version,
        createdAt: architectureVersions.createdAt,
        changeSource: architectureVersions.changeSource,
      })
      .from(architectureVersions)
      .where(eq(architectureVersions.architectureId, architectureId))
      .orderBy(asc(architectureVersions.version));

    return rows;
  }
}
