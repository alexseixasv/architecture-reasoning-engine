import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { architectureDocumentSchema } from '../../../src/architecture/domain/schema';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';
import { SCENARIO_EXTRACTION_SCHEMA_NAME } from '../../../src/llm/dto/scenario-extraction.dto';
import { SCENARIO_MISSING_NUMERIC } from '../../../src/llm/dto/scenario-missing';
import { extractScenario } from '../../../src/llm/extraction/extract-scenario';
import { FakeLlmProvider } from '../../../src/llm/provider/fake-llm-provider';
import { SCENARIO_EXTRACTION_SYSTEM_PROMPT } from '../../../src/llm/prompts/scenario';
import { clearUsageRecords } from '../../../src/llm/usage/usage-recorder';
import { loadScenarioDto } from './helpers';

const V01_QUESTION =
  'At the current baseline load (1x), what is the API utilization?';

function loadV01Formal(): ArchitectureDocument {
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

describe('V01 utilization question → load_multiplication ×1', () => {
  beforeEach(() => {
    clearUsageRecords();
  });

  it('fixture question text matches the smoke/live wording', () => {
    const fromFile = readFileSync(
      join(
        process.cwd(),
        'tests',
        'validation',
        'V01_capacity_sum',
        'scenario_nl.md',
      ),
      'utf8',
    ).trim();
    expect(fromFile).toBe(V01_QUESTION);
  });

  it('system prompt documents baseline 1x utilization as load_multiplication', () => {
    expect(SCENARIO_EXTRACTION_SYSTEM_PROMPT).toMatch(/baseline/i);
    expect(SCENARIO_EXTRACTION_SYSTEM_PROMPT).toMatch(/load_multiplication/);
    expect(SCENARIO_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /under an explicit load factor/i,
    );
    expect(SCENARIO_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /does NOT mean utilization questions are unsupported/i,
    );
  });

  it('exact failed live question maps to load_multiplication multiplier 1 when DTO is correct', async () => {
    const formal = loadV01Formal();
    const fake = new FakeLlmProvider();
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async (req) => {
      expect(req.userContent).toContain(V01_QUESTION);
      return {
        ok: true,
        data: loadScenarioDto({
          outcome: 'load_multiplication',
          multiplier: 1,
          latencyMs: SCENARIO_MISSING_NUMERIC,
          componentId: '',
        }),
        model: 'fake',
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        durationMs: 1,
      };
    });

    const result = await extractScenario({
      question: V01_QUESTION,
      architecture: formal,
      provider: fake,
    });
    expect(result).toEqual({
      status: 'OK',
      scenario: { type: 'load_multiplication', multiplier: 1 },
    });
  });

  it('documents the prior live failure mode: incorrect unsupported classification', async () => {
    const formal = loadV01Formal();
    const fake = new FakeLlmProvider();
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'unsupported',
        reason:
          'API utilization is not a supported question type; questions about utilization metrics are unsupported.',
        multiplier: SCENARIO_MISSING_NUMERIC,
        latencyMs: SCENARIO_MISSING_NUMERIC,
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const result = await extractScenario({
      question: V01_QUESTION,
      architecture: formal,
      provider: fake,
    });
    // Pipeline surfaces the bad classification honestly — prompt fix aims to prevent this DTO
    expect(result.status).toBe('UNSUPPORTED');
  });
});

