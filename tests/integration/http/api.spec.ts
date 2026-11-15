import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Server } from 'node:http';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { architectureDocumentSchema } from '../../../src/architecture/domain/schema';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';
import { ARCHITECTURE_EXTRACTION_SCHEMA_NAME } from '../../../src/llm/dto/architecture-extraction.dto';
import { EXPLANATION_SCHEMA_NAME } from '../../../src/llm/dto/explanation.dto';
import { SCENARIO_EXTRACTION_SCHEMA_NAME } from '../../../src/llm/dto/scenario-extraction.dto';
import { LLM_CONFIG, LLM_PROVIDER } from '../../../src/llm/llm.tokens';
import { FakeLlmProvider } from '../../../src/llm/provider/fake-llm-provider';
import { closeDb, createDb } from '../../../src/persistence/db';
import { runMigrations } from '../../../src/persistence/migrate';
import {
  baseArchitectureDto,
  explanationDto,
  loadScenarioDto,
  SAMPLE_ARCH_TEXT,
} from '../../unit/llm/helpers';

const databaseUrl = process.env['DATABASE_URL'];

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

async function jsonRequest(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

describe.skipIf(!databaseUrl)('HTTP API Phase 6', () => {
  let app: INestApplication;
  let server: Server;
  let baseUrl: string;
  let fake: FakeLlmProvider;

  beforeAll(async () => {
    await runMigrations();
    createDb();

    fake = new FakeLlmProvider();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LLM_PROVIDER)
      .useValue(fake)
      .overrideProvider(LLM_CONFIG)
      .useValue({
        provider: 'fake',
        openaiModel: 'fake',
        openaiTimeoutMs: 5_000,
        maxArchitectureChars: 20_000,
        maxQuestionChars: 4_000,
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (addr === null || typeof addr === 'string') {
      throw new Error('Failed to bind test server');
    }
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await closeDb();
  });

  beforeEach(() => {
    fake = app.get(LLM_PROVIDER) as FakeLlmProvider;
    // reset handlers by replacing map — FakeLlmProvider has no clear; re-set each test
  });

  it('extracts without persistence', async () => {
    fake.setHandler(ARCHITECTURE_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: baseArchitectureDto(),
      model: 'fake',
      inputTokens: 5,
      outputTokens: 5,
      totalTokens: 10,
      durationMs: 1,
    }));
    const res = await jsonRequest(baseUrl, 'POST', '/architectures/extract', {
      architectureText: SAMPLE_ARCH_TEXT,
    });
    expect(res.status).toBe(200);
    const body = res.json as { status: string; canPersist: boolean };
    expect(body.status).toBe('PROPOSED');
  });

  it('rejects oversized extract input with 400', async () => {
    const huge = 'x'.repeat(20_001);
    const res = await jsonRequest(baseUrl, 'POST', '/architectures/extract', {
      architectureText: huge,
    });
    expect(res.status).toBe(400);
  });

  it('maps provider unavailable on extract to 503', async () => {
    fake.failNext({
      errorClass: 'PROVIDER_UNAVAILABLE',
      message: 'down',
    });
    const res = await jsonRequest(baseUrl, 'POST', '/architectures/extract', {
      architectureText: SAMPLE_ARCH_TEXT,
    });
    expect(res.status).toBe(503);
  });

  it('extract → persist → analyze happy path', async () => {
    fake.setHandler(ARCHITECTURE_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: baseArchitectureDto(),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));
    const extracted = await jsonRequest(baseUrl, 'POST', '/architectures/extract', {
      architectureText: SAMPLE_ARCH_TEXT,
    });
    expect(extracted.status).toBe(200);
    const proposed = extracted.json as {
      document: ArchitectureDocument;
      canPersist: boolean;
    };
    expect(proposed.canPersist).toBe(true);

    const created = await jsonRequest(baseUrl, 'POST', '/architectures', {
      document: proposed.document,
      changeSource: 'approved_extraction',
    });
    expect(created.status).toBe(201);
    const stored = created.json as {
      architectureId: string;
      version: number;
      changeSource: string;
    };
    expect(stored.version).toBe(1);
    expect(stored.changeSource).toBe('approved_extraction');

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
        acknowledgedStatus: 'ANSWERED',
        statements: [
          {
            text: 'Utilization for api is provided by the calculated engine metric.',
            metricIds: ['utilization:api'],
            refusedMetricIds: [],
            componentIds: ['api'],
            refusalCodes: [],
            claimKind: 'saturation_classification',
          },
        ],
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const analyzed = await jsonRequest(
      baseUrl,
      'POST',
      `/architectures/${stored.architectureId}/versions/1/analyze`,
      { question: 'What is utilization at baseline load?' },
    );
    expect(analyzed.status).toBe(200);
    const body = analyzed.json as {
      architectureId: string;
      architectureVersion: number;
      scenarioExtraction: { status: string };
      simulation: { status: string; metrics: unknown[] } | null;
      explanation: { source: string } | null;
    };
    expect(body.architectureId).toBe(stored.architectureId);
    expect(body.architectureVersion).toBe(1);
    expect(body.scenarioExtraction.status).toBe('OK');
    expect(body.simulation?.status).toBe('ANSWERED');
    expect(body.explanation?.source).toBe('llm+deterministic');
  });

  it('returns 404 for missing architecture version', async () => {
    const res = await jsonRequest(
      baseUrl,
      'POST',
      '/architectures/00000000-0000-4000-8000-000000000099/versions/1/analyze',
      { question: 'load?' },
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 on optimistic concurrency conflict', async () => {
    const doc = v01();
    const created = await jsonRequest(baseUrl, 'POST', '/architectures', {
      document: doc,
    });
    const stored = created.json as { architectureId: string; version: number };
    const first = await jsonRequest(
      baseUrl,
      'PUT',
      `/architectures/${stored.architectureId}`,
      { expectedVersion: 1, document: doc, changeSource: 'user_corrected' },
    );
    expect(first.status).toBe(200);
    const conflict = await jsonRequest(
      baseUrl,
      'PUT',
      `/architectures/${stored.architectureId}`,
      { expectedVersion: 1, document: doc },
    );
    expect(conflict.status).toBe(409);
  });

  it('analyzes exact older version while a newer version exists', async () => {
    const doc = v01();
    const created = await jsonRequest(baseUrl, 'POST', '/architectures', {
      document: doc,
    });
    const stored = created.json as { architectureId: string };
    await jsonRequest(baseUrl, 'PUT', `/architectures/${stored.architectureId}`, {
      expectedVersion: 1,
      document: { ...doc, name: 'v2' },
      changeSource: 'user_corrected',
    });

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
      data: explanationDto(),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const analyzed = await jsonRequest(
      baseUrl,
      'POST',
      `/architectures/${stored.architectureId}/versions/1/analyze`,
      { question: 'baseline utilization?' },
    );
    expect(analyzed.status).toBe(200);
    const body = analyzed.json as { architectureVersion: number };
    expect(body.architectureVersion).toBe(1);
  });

  it('returns clarification as HTTP 200 domain outcome', async () => {
    const created = await jsonRequest(baseUrl, 'POST', '/architectures', {
      document: v01(),
    });
    const stored = created.json as { architectureId: string };
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'needs_clarification',
        reason: 'ambiguous',
        clarificationQuestions: ['Which node?'],
        multiplier: -1,
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));
    const analyzed = await jsonRequest(
      baseUrl,
      'POST',
      `/architectures/${stored.architectureId}/versions/1/analyze`,
      { question: 'what if it fails?' },
    );
    expect(analyzed.status).toBe(200);
    const body = analyzed.json as {
      scenarioExtraction: { status: string };
      simulation: unknown;
    };
    expect(body.scenarioExtraction.status).toBe('NEEDS_CLARIFICATION');
    expect(body.simulation).toBeNull();
  });

  it('keeps simulation when explanation falls back', async () => {
    const created = await jsonRequest(baseUrl, 'POST', '/architectures', {
      document: v01(),
    });
    const stored = created.json as { architectureId: string };
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
            text: 'bad',
            metricIds: ['ghost'],
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
    const analyzed = await jsonRequest(
      baseUrl,
      'POST',
      `/architectures/${stored.architectureId}/versions/1/analyze`,
      { question: 'utilization?' },
    );
    expect(analyzed.status).toBe(200);
    const body = analyzed.json as {
      simulation: { metrics: unknown[] } | null;
      explanation: { source: string } | null;
    };
    expect(body.simulation?.metrics.length).toBeGreaterThan(0);
    expect(body.explanation?.source).toBe('deterministic_fallback');
  });
});
