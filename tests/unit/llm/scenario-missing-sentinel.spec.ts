import { describe, expect, it } from 'vitest';
import type { ArchitectureDocument } from '../../../src/architecture/domain/types';
import { SCENARIO_MISSING_NUMERIC } from '../../../src/llm/dto/scenario-missing';
import { mapExtractionToScenario } from '../../../src/llm/mapping/to-scenario';
import { loadScenarioDto } from './helpers';

const doc: ArchitectureDocument = {
  schemaVersion: '1.0.0',
  nodes: [{ id: 'api', kind: 'service', name: 'API' }],
  dependencies: [],
  assumptions: [],
  conflicts: [],
};

describe('SCENARIO_MISSING_NUMERIC sentinel', () => {
  it('is exactly -1 and never becomes a load_multiplication scenario value', () => {
    expect(SCENARIO_MISSING_NUMERIC).toBe(-1);
    const mapped = mapExtractionToScenario(
      loadScenarioDto({
        outcome: 'load_multiplication',
        multiplier: SCENARIO_MISSING_NUMERIC,
      }),
      doc,
    );
    expect(mapped.status).toBe('needs_clarification');
    if (mapped.status === 'ok') {
      throw new Error('sentinel must not produce ok scenario');
    }
  });

  it('never becomes a latency_degradation scenario value', () => {
    const mapped = mapExtractionToScenario(
      loadScenarioDto({
        outcome: 'latency_degradation',
        componentId: 'api',
        latencyMs: SCENARIO_MISSING_NUMERIC,
        multiplier: SCENARIO_MISSING_NUMERIC,
      }),
      doc,
    );
    expect(mapped.status).toBe('needs_clarification');
  });

  it('rejects other negative numbers as invalid (not missing)', () => {
    const mapped = mapExtractionToScenario(
      loadScenarioDto({
        outcome: 'load_multiplication',
        multiplier: -5,
      }),
      doc,
    );
    expect(mapped.status).toBe('invalid');
  });

  it('rejects multiplier 0 via domain validation path', () => {
    const mapped = mapExtractionToScenario(
      loadScenarioDto({
        outcome: 'load_multiplication',
        multiplier: 0,
      }),
      doc,
    );
    expect(mapped.status).toBe('invalid');
  });
});
