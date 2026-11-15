import { expect } from 'vitest';
import { architectureDocumentSchema } from '../../src/architecture/domain/schema';
import type { ArchitectureDocument } from '../../src/architecture/domain/types';
import { simulate } from '../../src/simulation/simulate';
import {
  assertGoldenResult,
  type GoldenExpected,
} from '../golden/assertGolden';

export type ValidationMeta = {
  id: string;
  tags: string[];
  requirementIds: string[];
  /**
   * - simulate: run deterministic simulation against expected_simulation.json
   * - schema_only: formal model validates; NL question unsupported for structured scenario
   */
  execution: 'simulate' | 'schema_only';
  /** Human note for unsupported NL outcomes (no invented scenario schema). */
  unsupportedNlOutcome?: string;
};

export function assertValidationPair(input: {
  formalModel: unknown;
  expectedScenario: unknown | null;
  expectedSimulation: GoldenExpected | null;
  meta: ValidationMeta;
}): void {
  const parsed = architectureDocumentSchema.parse(input.formalModel);
  expect(parsed.schemaVersion).toBe('1.0.0');

  if (input.meta.execution === 'schema_only') {
    expect(input.expectedScenario).toBeNull();
    expect(input.expectedSimulation).toBeNull();
    expect(input.meta.unsupportedNlOutcome?.length ?? 0).toBeGreaterThan(0);
    return;
  }

  expect(input.expectedScenario).not.toBeNull();
  expect(input.expectedSimulation).not.toBeNull();
  if (input.expectedScenario === null || input.expectedSimulation === null) {
    return;
  }

  const before = JSON.stringify(parsed);
  const once = simulate(parsed as ArchitectureDocument, input.expectedScenario);
  const twice = simulate(
    parsed as ArchitectureDocument,
    input.expectedScenario,
  );
  expect(once).toEqual(twice);
  expect(JSON.stringify(parsed)).toBe(before);
  expect(once.scenario).toEqual(input.expectedScenario);
  assertGoldenResult(once, input.expectedSimulation);
}
