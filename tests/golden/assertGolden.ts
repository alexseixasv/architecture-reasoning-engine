import { expect } from 'vitest';
import type { ArchitectureDocument } from '../../src/architecture/domain/types';
import { architectureDocumentSchema } from '../../src/architecture/domain/schema';
import {
  compareGoldenResult,
  STANDING_REFUSALS,
  type GoldenExpected,
} from '../../src/evaluation/compare-golden';
import { simulate } from '../../src/simulation/simulate';
import type { SimulationResult } from '../../src/simulation/domain/result';

export type {
  ExpectedMetric,
  ExpectedSaturation,
  ExpectedImpact,
  ExpectedPropagationPath,
  GoldenExpected,
} from '../../src/evaluation/compare-golden';

export { STANDING_REFUSALS };

export function assertGoldenResult(
  actual: SimulationResult,
  expected: GoldenExpected,
): void {
  const comparison = compareGoldenResult(actual, expected);
  expect(
    comparison.ok,
    comparison.mismatches.map((m) => m.message).join('\n') ||
      'golden comparison failed',
  ).toBe(true);
}

export function runGoldenCase(input: {
  architecture: unknown;
  scenario: unknown;
  expected: GoldenExpected;
}): SimulationResult {
  const parsed = architectureDocumentSchema.parse(input.architecture);
  const before = JSON.stringify(parsed);
  const once = simulate(parsed as ArchitectureDocument, input.scenario);
  const twice = simulate(parsed as ArchitectureDocument, input.scenario);
  expect(once).toEqual(twice);
  expect(JSON.stringify(parsed)).toBe(before);
  assertGoldenResult(once, input.expected);
  return once;
}
