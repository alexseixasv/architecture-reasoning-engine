import type { Scenario } from '../../simulation/domain/scenario';
import type { ScenarioExtractionResult } from '../extraction/extract-scenario';

/** Dataset denominators for V01–V12 scenario evaluation. */
export const STRUCTURED_SCENARIO_DENOMINATOR = 10;
export const UNSUPPORTED_NL_DENOMINATOR = 2;

export type ScenarioIntentClass =
  | 'load_multiplication'
  | 'component_unavailable'
  | 'latency_degradation'
  | 'UNSUPPORTED'
  | 'NEEDS_CLARIFICATION'
  | 'FAILED'
  | 'OTHER';

export type ScenarioCompareReport = {
  intentMatch: boolean;
  parameterMatch: boolean;
  overallMatch: boolean;
  expectedIntent: ScenarioIntentClass;
  actualIntent: ScenarioIntentClass;
  details: string[];
};

export function scenarioIntentFromExpected(
  expected: Scenario | null,
): ScenarioIntentClass {
  if (expected === null) {
    return 'UNSUPPORTED';
  }
  return expected.type;
}

export function scenarioIntentFromResult(
  result: ScenarioExtractionResult,
): ScenarioIntentClass {
  if (result.status === 'OK') {
    return result.scenario.type;
  }
  if (result.status === 'UNSUPPORTED') {
    return 'UNSUPPORTED';
  }
  if (result.status === 'NEEDS_CLARIFICATION') {
    return 'NEEDS_CLARIFICATION';
  }
  if (result.status === 'FAILED') {
    return 'FAILED';
  }
  return 'OTHER';
}

function parametersEqual(expected: Scenario, actual: Scenario): boolean {
  if (expected.type !== actual.type) {
    return false;
  }
  if (expected.type === 'load_multiplication' && actual.type === 'load_multiplication') {
    return expected.multiplier === actual.multiplier;
  }
  if (
    expected.type === 'component_unavailable' &&
    actual.type === 'component_unavailable'
  ) {
    return expected.componentId === actual.componentId;
  }
  if (
    expected.type === 'latency_degradation' &&
    actual.type === 'latency_degradation'
  ) {
    return (
      expected.componentId === actual.componentId &&
      expected.latencyMs === actual.latencyMs
    );
  }
  return false;
}

/**
 * Semantic scenario comparison.
 * - Supported expected: requires OK + type + parameters.
 * - Unsupported expected (null): UNSUPPORTED or NEEDS_CLARIFICATION pass intent;
 *   inventing an OK scenario fails (no credit for fabricated structured scenarios).
 */
export function compareScenarioExtraction(
  expected: Scenario | null,
  actual: ScenarioExtractionResult,
): ScenarioCompareReport {
  const expectedIntent = scenarioIntentFromExpected(expected);
  const actualIntent = scenarioIntentFromResult(actual);
  const details: string[] = [];

  if (expected === null) {
    const intentMatch =
      actualIntent === 'UNSUPPORTED' || actualIntent === 'NEEDS_CLARIFICATION';
    if (actual.status === 'OK') {
      details.push('invented_structured_scenario');
    }
    if (!intentMatch) {
      details.push(`expected_unsupported_got_${actualIntent}`);
    }
    return {
      intentMatch,
      parameterMatch: intentMatch,
      overallMatch: intentMatch,
      expectedIntent,
      actualIntent,
      details,
    };
  }

  const intentMatch = actualIntent === expected.type;
  if (!intentMatch) {
    details.push(`intent_mismatch expected=${expected.type} actual=${actualIntent}`);
  }

  let parameterMatch = false;
  if (actual.status === 'OK') {
    parameterMatch = parametersEqual(expected, actual.scenario);
    if (!parameterMatch) {
      details.push('parameter_mismatch');
    }
  } else {
    details.push('missing_ok_scenario');
  }

  return {
    intentMatch,
    parameterMatch: intentMatch && parameterMatch,
    overallMatch: intentMatch && parameterMatch,
    expectedIntent,
    actualIntent,
    details,
  };
}
