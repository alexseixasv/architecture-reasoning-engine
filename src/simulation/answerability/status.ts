import type { Answerability, RefusedMetric } from '../domain/result';
import type { Scenario } from '../domain/scenario';

export function resolveStatus(input: {
  scenario: Scenario;
  primarySatisfied: boolean;
  refused: RefusedMetric[];
  hasSecondarySuccess: boolean;
}): Answerability {
  if (!input.primarySatisfied) {
    return 'NOT_ANSWERABLE';
  }
  if (input.refused.length > 0) {
    return 'PARTIALLY_ANSWERED';
  }
  return 'ANSWERED';
}
