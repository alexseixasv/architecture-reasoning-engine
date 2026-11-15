import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisService } from '../../../src/analysis/analysis.service';
import type { ArchitectureService } from '../../../src/architecture/application/architecture.service';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';
import { architectureDocumentSchema } from '../../../src/architecture/domain/schema';
import { ARCHITECTURE_EXTRACTION_SCHEMA_NAME } from '../../../src/llm/dto/architecture-extraction.dto';
import { EXPLANATION_SCHEMA_NAME } from '../../../src/llm/dto/explanation.dto';
import { SCENARIO_EXTRACTION_SCHEMA_NAME } from '../../../src/llm/dto/scenario-extraction.dto';
import { FakeLlmProvider } from '../../../src/llm/provider/fake-llm-provider';
import {
  baseArchitectureDto,
  explanationDto,
  loadScenarioDto,
  SAMPLE_ARCH_TEXT,
} from '../llm/helpers';
import { ServiceUnavailableException, BadRequestException } from '@nestjs/common';

function v01(): ArchitectureDocument {
  return architectureDocumentSchema.parse(
    JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'tests',
          'validation',
          'V01_capacity_sum',
          'formal_model.json',
        ),
        'utf8',
      ),
    ),
  ) as ArchitectureDocument;
}

describe('AnalysisService', () => {
  let fake: FakeLlmProvider;
  let architectures: ArchitectureService;
  let service: AnalysisService;
  const config = {
    provider: 'fake' as const,
    openaiModel: 'fake',
    openaiTimeoutMs: 1000,
    maxArchitectureChars: 20_000,
    maxQuestionChars: 4_000,
  };

  beforeEach(() => {
    fake = new FakeLlmProvider();
    architectures = {
      getVersion: vi.fn(async () => ({
        architectureId: 'arch-1',
        version: 1,
        document: v01(),
        findings: [],
        changeSource: 'manual',
        createdAt: new Date(),
      })),
    } as unknown as ArchitectureService;
    service = new AnalysisService(architectures, fake, config);
  });

  it('extracts without persistence and returns PROPOSED', async () => {
    fake.setHandler(ARCHITECTURE_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: baseArchitectureDto(),
      model: 'fake',
      inputTokens: 11,
      outputTokens: 22,
      totalTokens: 33,
      durationMs: 5,
    }));
    const create = vi.fn();
    (architectures as { create?: unknown }).create = create;

    const result = await service.extractFromText(SAMPLE_ARCH_TEXT);
    expect(result.status).toBe('PROPOSED');
    expect(result.document).toBeTruthy();
    expect(result.usage.operations).toHaveLength(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns PROPOSED for incomplete/unknown values without treating as 500', async () => {
    fake.setHandler(ARCHITECTURE_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: baseArchitectureDto({
        nodes: [
          {
            id: 'api',
            kind: 'service',
            name: 'API',
            replicas: { presence: 'unknown', unit: 'count', reason: 'not stated' },
            capacityPerReplica: { presence: 'omitted' },
            capacityAggregation: 'sum_replicas',
            declaredLatency: { presence: 'omitted' },
            fieldConflicts: [],
          },
        ],
        incomingTraffic: { presence: 'omitted' },
        clarificationQuestions: ['What is API capacity?'],
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));
    const result = await service.extractFromText(SAMPLE_ARCH_TEXT);
    expect(result.status).toBe('PROPOSED');
    expect(result.clarificationQuestions.length).toBeGreaterThan(0);
  });

  it('maps provider timeout on extract to 503', async () => {
    fake.failNext({
      errorClass: 'PROVIDER_TIMEOUT',
      message: 'timed out',
    });
    await expect(service.extractFromText(SAMPLE_ARCH_TEXT)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('maps oversized extract input to 400 via LLM layer', async () => {
    const tiny = { ...config, maxArchitectureChars: 5 };
    service = new AnalysisService(architectures, fake, tiny);
    await expect(service.extractFromText(SAMPLE_ARCH_TEXT)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns NEEDS_CLARIFICATION without simulating', async () => {
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'needs_clarification',
        reason: 'ambiguous component',
        clarificationQuestions: ['Which service?'],
        multiplier: -1,
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));
    const result = await service.analyzeVersion({
      architectureId: 'arch-1',
      version: 1,
      question: 'what if something fails?',
    });
    expect(result.scenarioExtraction.status).toBe('NEEDS_CLARIFICATION');
    expect(result.simulation).toBeNull();
    expect(result.explanation).toBeNull();
    expect(result.architectureVersion).toBe(1);
  });

  it('returns UNSUPPORTED without simulating', async () => {
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'unsupported',
        reason: 'monte carlo not supported',
        multiplier: -1,
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));
    const result = await service.analyzeVersion({
      architectureId: 'arch-1',
      version: 1,
      question: 'run a monte carlo',
    });
    expect(result.scenarioExtraction.status).toBe('UNSUPPORTED');
    expect(result.simulation).toBeNull();
  });

  it('runs simulate+explain and keeps simulation on explanation fallback', async () => {
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'load_multiplication',
        multiplier: 1,
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));
    fake.setHandler(EXPLANATION_SCHEMA_NAME, async () => ({
      ok: true,
      data: explanationDto({
        statements: [
          {
            text: 'Invented metric.',
            metricIds: ['not_real'],
            refusedMetricIds: [],
            componentIds: [],
            refusalCodes: [],
            claimKind: 'general',
          },
        ],
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const result = await service.analyzeVersion({
      architectureId: 'arch-1',
      version: 1,
      question: 'utilization at baseline?',
    });
    expect(result.scenarioExtraction.status).toBe('OK');
    expect(result.simulation).not.toBeNull();
    expect(result.simulation?.status).toBe('ANSWERED');
    expect(result.explanation?.source).toBe('deterministic_fallback');
    expect(result.architectureId).toBe('arch-1');
    expect(result.architectureVersion).toBe(1);
  });

  it('returns NOT_ANSWERABLE simulation for missing baseline traffic', async () => {
    const incomplete = structuredClone(v01());
    delete incomplete.system?.incomingTraffic;
    architectures = {
      getVersion: vi.fn(async () => ({
        architectureId: 'arch-1',
        version: 1,
        document: incomplete,
        findings: [],
        changeSource: 'manual',
        createdAt: new Date(),
      })),
    } as unknown as ArchitectureService;
    service = new AnalysisService(architectures, fake, config);
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'load_multiplication',
        multiplier: 1,
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));
    fake.setHandler(EXPLANATION_SCHEMA_NAME, async () => ({
      ok: true,
      data: explanationDto({ acknowledgedStatus: 'NOT_ANSWERABLE' }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));
    const result = await service.analyzeVersion({
      architectureId: 'arch-1',
      version: 1,
      question: 'utilization?',
    });
    expect(result.simulation?.status).toBe('NOT_ANSWERABLE');
    expect(result.explanation).not.toBeNull();
  });

  it('loads the exact requested version (never silent latest)', async () => {
    const getVersion = vi.fn(async (_id: string, version: number) => ({
      architectureId: 'arch-1',
      version,
      document: v01(),
      findings: [],
      changeSource: 'manual',
      createdAt: new Date(),
    }));
    architectures = { getVersion } as unknown as ArchitectureService;
    service = new AnalysisService(architectures, fake, config);
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'unsupported',
        reason: 'x',
        multiplier: -1,
      }),
      model: 'fake',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      durationMs: 1,
    }));
    await service.analyzeVersion({
      architectureId: 'arch-1',
      version: 2,
      question: 'q',
    });
    expect(getVersion).toHaveBeenCalledWith('arch-1', 2);
  });
});
