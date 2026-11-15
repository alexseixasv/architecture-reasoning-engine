import { listAdversarialCaseIds, runAdversarialCase } from './adapters/adversarial.adapter';
import { listGoldenCaseIds, runGoldenCase } from './adapters/golden.adapter';
import {
  listValidationCaseIds,
  runValidationCase,
} from './adapters/validation.adapter';
import type {
  EvaluationCaseResult,
  EvaluationSuiteDescriptor,
  EvaluationSuiteId,
} from './types';

export type SuiteRunnerId = 'golden' | 'validation_formal' | 'adversarial';

export const SUITE_DESCRIPTORS: EvaluationSuiteDescriptor[] = [
  {
    id: 'deterministic_full',
    label: 'Deterministic full (G+V+ADV)',
    caseCount:
      listGoldenCaseIds().length +
      listValidationCaseIds().length +
      listAdversarialCaseIds().length,
    requiresOpenAi: false,
    description:
      'All allowlisted deterministic cases: golden simulation, validation formal/schema, adversarial checks. No OpenAI.',
  },
  {
    id: 'golden',
    label: 'Golden G01–G12',
    caseCount: listGoldenCaseIds().length,
    requiresOpenAi: false,
    description:
      'Hand-oracle simulation correctness against tests/golden expected.json fixtures.',
  },
  {
    id: 'validation_formal',
    label: 'Validation formal V01–V12',
    caseCount: listValidationCaseIds().length,
    requiresOpenAi: false,
    description:
      'V01–V09/V12 formal simulate; V10–V11 schema_only (not NL classification).',
  },
  {
    id: 'adversarial',
    label: 'Adversarial ADV-01–08',
    caseCount: listAdversarialCaseIds().length,
    requiresOpenAi: false,
    description:
      'Deterministic adversarial boundaries. ADV-08 is NL isolation, not LLM injection resistance.',
  },
];

export function resolveSuiteRunners(
  suiteId: EvaluationSuiteId,
): SuiteRunnerId[] {
  switch (suiteId) {
    case 'deterministic_full':
      return ['golden', 'validation_formal', 'adversarial'];
    case 'golden':
      return ['golden'];
    case 'validation_formal':
      return ['validation_formal'];
    case 'adversarial':
      return ['adversarial'];
  }
}

export function runSuiteCases(
  runnerId: SuiteRunnerId,
): EvaluationCaseResult[] {
  switch (runnerId) {
    case 'golden':
      return listGoldenCaseIds().map((id) => runGoldenCase(id));
    case 'validation_formal':
      return listValidationCaseIds().map((id) => runValidationCase(id));
    case 'adversarial':
      return listAdversarialCaseIds().map((id) => runAdversarialCase(id));
  }
}
