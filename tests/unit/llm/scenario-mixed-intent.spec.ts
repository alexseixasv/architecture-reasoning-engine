import { describe, expect, it, beforeEach } from 'vitest';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';
import { SCENARIO_EXTRACTION_SCHEMA_NAME } from '../../../src/llm/dto/scenario-extraction.dto';
import { SCENARIO_MISSING_NUMERIC } from '../../../src/llm/dto/scenario-missing';
import { extractScenario } from '../../../src/llm/extraction/extract-scenario';
import { FakeLlmProvider } from '../../../src/llm/provider/fake-llm-provider';
import { SCENARIO_EXTRACTION_SYSTEM_PROMPT } from '../../../src/llm/prompts/scenario';
import { clearUsageRecords } from '../../../src/llm/usage/usage-recorder';
import { loadScenarioDto } from './helpers';

const doc: ArchitectureDocument = {
  schemaVersion: '1.0.0',
  nodes: [
    { id: 'payments', kind: 'service', name: 'Payments' },
    { id: 'checkout', kind: 'service', name: 'Checkout' },
  ],
  dependencies: [],
  assumptions: [],
  conflicts: [],
};

describe('mixed-intent unsupported scenario classification', () => {
  beforeEach(() => {
    clearUsageRecords();
  });

  it('prompt distinguishes outage impact from availability%/nines/uptime/p95', () => {
    expect(SCENARIO_EXTRACTION_SYSTEM_PROMPT).toMatch(/Mixed-intent rule/i);
    expect(SCENARIO_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /Availability percentage estimation/i,
    );
    expect(SCENARIO_EXTRACTION_SYSTEM_PROMPT).toMatch(/Reliability nines/i);
    expect(SCENARIO_EXTRACTION_SYSTEM_PROMPT).toMatch(/Uptime probability/i);
    expect(SCENARIO_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /End-to-end p95 \/ p99/i,
    );
    expect(SCENARIO_EXTRACTION_SYSTEM_PROMPT).toMatch(
      /even when it also mentions a component outage/i,
    );
  });

  it('availability% + outage mention → UNSUPPORTED (not component_unavailable)', async () => {
    const question =
      'If payments is down, what is the system availability percentage?';
    const fake = new FakeLlmProvider();
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async (req) => {
      expect(req.systemPrompt).toMatch(/Mixed-intent rule/i);
      expect(req.userContent).toContain(question);
      return {
        ok: true,
        data: loadScenarioDto({
          outcome: 'unsupported',
          reason: 'availability percent not supported',
          componentId: '',
          multiplier: SCENARIO_MISSING_NUMERIC,
          latencyMs: SCENARIO_MISSING_NUMERIC,
        }),
        model: 'fake',
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        durationMs: 1,
      };
    });

    const result = await extractScenario({
      question,
      architecture: doc,
      provider: fake,
    });
    expect(result.status).toBe('UNSUPPORTED');
  });

  it('reliability nines + outage → UNSUPPORTED', async () => {
    const fake = new FakeLlmProvider();
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'unsupported',
        reason: 'reliability nines not supported',
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
      question: 'How many nines of reliability if checkout fails?',
      architecture: doc,
      provider: fake,
    });
    expect(result.status).toBe('UNSUPPORTED');
  });

  it('uptime probability question → UNSUPPORTED', async () => {
    const fake = new FakeLlmProvider();
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'unsupported',
        reason: 'uptime probability not supported',
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
      question: 'What is the uptime probability when payments is unavailable?',
      architecture: doc,
      provider: fake,
    });
    expect(result.status).toBe('UNSUPPORTED');
  });

  it('end-to-end p95 latency estimation → UNSUPPORTED', async () => {
    const fake = new FakeLlmProvider();
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'unsupported',
        reason: 'e2e p95 not supported',
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
      question: 'Estimate end-to-end p95 latency if payments is slow.',
      architecture: doc,
      provider: fake,
    });
    expect(result.status).toBe('UNSUPPORTED');
  });

  it('pure outage impact analysis remains component_unavailable when DTO is correct', async () => {
    const fake = new FakeLlmProvider();
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'component_unavailable',
        componentId: 'payments',
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
      question:
        'What happens to the checkout path if payments is unavailable?',
      architecture: doc,
      provider: fake,
    });
    expect(result).toEqual({
      status: 'OK',
      scenario: { type: 'component_unavailable', componentId: 'payments' },
    });
  });

  it('documents prior live failure mode: inventing component_unavailable for availability%', async () => {
    const fake = new FakeLlmProvider();
    fake.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async () => ({
      ok: true,
      data: loadScenarioDto({
        outcome: 'component_unavailable',
        componentId: 'payments',
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
      question: 'If payments is down, what is availability %?',
      architecture: doc,
      provider: fake,
    });
    // Honest pipeline surfaces bad classification; prompt aims to prevent this DTO
    expect(result.status).toBe('OK');
    if (result.status === 'OK') {
      expect(result.scenario.type).toBe('component_unavailable');
    }
  });
});
