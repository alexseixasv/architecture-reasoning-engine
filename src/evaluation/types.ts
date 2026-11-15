import type { ComparisonMismatch, MetricEvidenceSummary } from './compare-golden';

/** Allowlisted suite identifiers — browser cannot invent paths. */
export const EVALUATION_SUITE_IDS = [
  'deterministic_full',
  'golden',
  'validation_formal',
  'adversarial',
] as const;

export type EvaluationSuiteId = (typeof EVALUATION_SUITE_IDS)[number];

export function isEvaluationSuiteId(value: unknown): value is EvaluationSuiteId {
  return (
    typeof value === 'string' &&
    (EVALUATION_SUITE_IDS as readonly string[]).includes(value)
  );
}

/**
 * What kind of check the adapter performed.
 * Distinct from historical LLM evaluation.
 */
export type EvaluationCheckKind =
  | 'simulation_correctness'
  | 'schema_validation'
  | 'formal_scenario_validation'
  | 'adversarial_deterministic'
  | 'nl_isolation_check';

export type CaseRunStatus = 'passed' | 'failed' | 'skipped';

export type EvaluationCaseResult = {
  caseId: string;
  suiteId: 'golden' | 'validation_formal' | 'adversarial';
  checkKind: EvaluationCheckKind;
  description: string;
  /** Exact statement of what this adapter verifies. */
  verifies: string;
  executedAt: string;
  status: CaseRunStatus;
  durationMs: number;
  expectedOutcome: unknown;
  actualOutcome: unknown;
  mismatches: ComparisonMismatch[];
  evidence: {
    determinismOk?: boolean;
    metricEvidence?: MetricEvidenceSummary[];
    refusedReasonCodes?: string[];
    formulaIds?: string[];
    notes?: string[];
    [key: string]: unknown;
  };
  failureReason: string | null;
  input: unknown;
};

export type EvaluationSuiteSummary = {
  suiteId: 'golden' | 'validation_formal' | 'adversarial';
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  cases: EvaluationCaseResult[];
};

export type EvaluationRunSummary = {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
};

export type EvaluationRunResult = {
  runId: string;
  executedAt: string;
  suiteId: EvaluationSuiteId;
  overallStatus: 'passed' | 'failed';
  summary: EvaluationRunSummary;
  suites: EvaluationSuiteSummary[];
};

export type EvaluationSuiteDescriptor = {
  id: EvaluationSuiteId;
  label: string;
  caseCount: number;
  requiresOpenAi: false;
  description: string;
};
