/**
 * Internal DTO placeholder for "numeric parameter not provided".
 * Never a legitimate Scenario value — mapper must not pass this to scenarioSchema.
 */
export const SCENARIO_MISSING_NUMERIC = -1 as const;

export function isMissingScenarioNumeric(value: number): boolean {
  return value === SCENARIO_MISSING_NUMERIC;
}
