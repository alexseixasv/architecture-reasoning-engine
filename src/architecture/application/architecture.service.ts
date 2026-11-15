import { Injectable } from '@nestjs/common';
import { diffDocuments } from './diff';
import { validateArchitectureDocument } from './validate';
import { completenessGaps } from '../domain/completeness';
import type {
  ArchitectureDocument,
  CompletenessGap,
  DocumentDiff,
  ValidationFinding,
  ValidationResult,
} from '../domain/types';
import {
  ArchitectureRepository,
  type StoredArchitectureVersion,
  type VersionListItem,
} from '../infrastructure/architecture.repository';

export class PersistRejectedError extends Error {
  constructor(readonly findings: ValidationFinding[]) {
    super('Architecture document failed persistence validation');
    this.name = 'PersistRejectedError';
  }
}

@Injectable()
export class ArchitectureService {
  constructor(private readonly repository: ArchitectureRepository) {}

  validate(input: unknown): ValidationResult & { gaps: CompletenessGap[] } {
    const result = validateArchitectureDocument(input);
    const gaps = result.document
      ? completenessGaps(result.document)
      : [];
    return { ...result, gaps };
  }

  async create(
    input: unknown,
    changeSource = 'manual',
  ): Promise<StoredArchitectureVersion> {
    const result = validateArchitectureDocument(input);
    if (!result.canPersist || !result.document) {
      throw new PersistRejectedError(result.findings);
    }
    return this.repository.create(
      result.document,
      result.findings,
      changeSource,
    );
  }

  async update(
    architectureId: string,
    expectedVersion: number,
    input: unknown,
    changeSource = 'manual',
  ): Promise<StoredArchitectureVersion> {
    const result = validateArchitectureDocument(input);
    if (!result.canPersist || !result.document) {
      throw new PersistRejectedError(result.findings);
    }
    return this.repository.update(
      architectureId,
      expectedVersion,
      result.document,
      result.findings,
      changeSource,
    );
  }

  async getLatest(architectureId: string): Promise<StoredArchitectureVersion> {
    return this.repository.getLatest(architectureId);
  }

  async getVersion(
    architectureId: string,
    version: number,
  ): Promise<StoredArchitectureVersion> {
    return this.repository.getVersion(architectureId, version);
  }

  async listVersions(architectureId: string): Promise<VersionListItem[]> {
    return this.repository.listVersions(architectureId);
  }

  async diff(
    architectureId: string,
    fromVersion: number,
    toVersion: number,
  ): Promise<DocumentDiff> {
    const from = await this.repository.getVersion(architectureId, fromVersion);
    const to = await this.repository.getVersion(architectureId, toVersion);
    return diffDocuments(from.document, to.document, {
      fromVersion,
      toVersion,
    });
  }
}

export type { ArchitectureDocument };
