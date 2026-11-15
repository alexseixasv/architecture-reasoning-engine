import { describe, expect, it, beforeEach } from 'vitest';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';
import { extractScenario } from '../../../src/llm/extraction/extract-scenario';
import { FakeLlmProvider } from '../../../src/llm/provider/fake-llm-provider';
import { SCENARIO_EXTRACTION_SCHEMA_NAME } from '../../../src/llm/dto/scenario-extraction.dto';
import { clearUsageRecords } from '../../../src/llm/usage/usage-recorder';
import { loadScenarioDto } from './helpers';

const doc: ArchitectureDocument = {
  schemaVersion: '1.0.0',
  nodes: [
    { id: 'api', kind: 'service', name: 'API' },
    { id: 'db', kind: 'datastore', name: 'Postgres' },
    { id: 'db_replica', kind: 'datastore', name: 'Postgres' },
  ],
  dependencies: [],
  assumptions: [],
  conflicts: [],
};

describe('extractScenario', () => {
  beforeEach(() => {
    clearUsageRecords();
  });

  it('extracts load_multiplication', async () => {
    const fake = new FakeLlmProvider();
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({ multiplier: 3 }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const result = await extractScenario({
      question: 'What if traffic triples?',
      architecture: doc,
      provider: fake,
    });
    expect(result).toEqual({
      status: 'OK',
      scenario: { type: 'load_multiplication', multiplier: 3 },
    });
  });

  it('refuses unsupported intents', async () => {
    const fake = new FakeLlmProvider();
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'unsupported',
        reason: 'availability percent not supported',
        multiplier: -1,
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const result = await extractScenario({
      question: 'What is availability % if db dies?',
      architecture: doc,
      provider: fake,
    });
    expect(result.status).toBe('UNSUPPORTED');
  });

  it('asks clarification for ambiguous component names', async () => {
    const fake = new FakeLlmProvider();
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'component_unavailable',
        componentId: 'Postgres',
        multiplier: -1,
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const result = await extractScenario({
      question: 'What if Postgres is unavailable?',
      architecture: doc,
      provider: fake,
    });
    expect(result.status).toBe('NEEDS_CLARIFICATION');
  });

  it('does not invent missing latencyMs', async () => {
    const fake = new FakeLlmProvider();
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'latency_degradation',
        componentId: 'db',
        latencyMs: -1,
        multiplier: -1,
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const result = await extractScenario({
      question: 'What if db gets slow?',
      architecture: doc,
      provider: fake,
    });
    expect(result.status).toBe('NEEDS_CLARIFICATION');
  });

  it('resolves unique component id', async () => {
    const fake = new FakeLlmProvider();
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'component_unavailable',
        componentId: 'api',
        multiplier: -1,
      }),
      model: 'fake',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      durationMs: 1,
    }));

    const result = await extractScenario({
      question: 'What if api is unavailable?',
      architecture: doc,
      provider: fake,
    });
    expect(result).toEqual({
      status: 'OK',
      scenario: { type: 'component_unavailable', componentId: 'api' },
    });
  });
});
