/** Mirrors backend HTTP DTOs — do not invent fields. */

export type UsageSummary = {
  operations: Array<{
    operation: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    durationMs: number;
    estimatedCostUsd: number | null;
    errorClass?: string;
  }>;
  totals: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    durationMs: number;
    estimatedCostUsd: number | null;
    pricingIncomplete: boolean;
  };
};

export type ValidationFinding = {
  code: string;
  severity: string;
  findingClass?: string;
  path?: string;
  message: string;
};

export type ExtractHttpResponse = {
  status: 'PROPOSED' | 'EXTRACTION_FAILED';
  document: unknown | null;
  findings: ValidationFinding[];
  gaps: unknown[];
  clarificationQuestions: string[];
  notes: string[];
  canPersist: boolean;
  usage: UsageSummary;
  errorClass: string | null;
  message?: string;
};

export type ArchitectureEnvelope = {
  architectureId: string;
  version: number;
  schemaVersion: string;
  document: unknown;
  findings: ValidationFinding[];
  changeSource: string;
  createdAt: string;
};

export type VersionListItem = {
  version: number;
  createdAt: string;
  changeSource: string;
};

export type VersionListResponse = {
  architectureId: string;
  versions: VersionListItem[];
};

export type DiffChange = {
  entityType: 'node' | 'dependency' | 'assumption' | 'conflict' | 'system' | 'meta';
  id: string;
  path: string;
  kind: 'added' | 'removed' | 'changed';
  before?: unknown;
  after?: unknown;
};

export type DocumentDiff = {
  fromVersion?: number;
  toVersion?: number;
  changes: DiffChange[];
};

export type ValidateResponse = {
  document?: unknown;
  findings: ValidationFinding[];
  canPersist?: boolean;
  valid?: boolean;
  gaps?: unknown[];
};

export type AnalyzeHttpResponse = {
  architectureId: string;
  architectureVersion: number;
  scenarioExtraction: {
    status: 'OK' | 'NEEDS_CLARIFICATION' | 'UNSUPPORTED' | 'FAILED';
    scenario: unknown | null;
    reason: string | null;
    clarificationQuestions: string[];
    errorClass?: string;
    message?: string;
  };
  simulation: {
    status?: string;
    metrics?: Array<{
      metricId: string;
      value?: number | string | boolean;
      unit?: string;
      formulaId?: string;
      [key: string]: unknown;
    }>;
    refused?: Array<{
      metricId: string;
      reasonCode?: string;
      message?: string;
      [key: string]: unknown;
    }>;
    assumptions?: unknown[];
    evidence?: unknown;
    [key: string]: unknown;
  } | null;
  explanation: {
    source: 'llm+deterministic' | 'deterministic_fallback';
    markdown: string;
    evidenceMarkdown: string;
    qualitative?: unknown;
    validationErrors?: string[];
    validationErrorCodes?: string[];
    errorClass?: string;
  } | null;
  usage: UsageSummary;
  timingsMs: {
    extractScenario: number;
    simulate: number;
    explain: number;
    total: number;
  };
};

export type ApiErrorBody = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  errorClass?: string;
  architectureId?: string;
  expectedVersion?: number;
  actualVersion?: number;
  findings?: ValidationFinding[];
};

export type VersionConflictInfo = {
  message: string;
  architectureId?: string;
  expectedVersion?: number;
  actualVersion?: number;
};

/** Phase 9 Evaluation Lab — mirrors src/evaluation/types.ts */

export type EvaluationSuiteId =
  | 'deterministic_full'
  | 'golden'
  | 'validation_formal'
  | 'adversarial';

export type EvaluationCheckKind =
  | 'simulation_correctness'
  | 'schema_validation'
  | 'formal_scenario_validation'
  | 'adversarial_deterministic'
  | 'nl_isolation_check';

export type CaseRunStatus = 'passed' | 'failed' | 'skipped';

export type ComparisonMismatch = {
  path: string;
  expected: unknown;
  actual: unknown;
  message: string;
};

export type MetricEvidenceSummary = {
  metricId: string;
  expectedValue: number;
  actualValue: number | null;
  unit: string | null;
  formulaId: string | null;
  expectedFormulaId: string;
  substitutions: string[];
  inputPaths: string[];
  result: string;
};

export type EvaluationCaseResult = {
  caseId: string;
  suiteId: 'golden' | 'validation_formal' | 'adversarial';
  checkKind: EvaluationCheckKind;
  description: string;
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

export type EvaluationRunResult = {
  runId: string;
  executedAt: string;
  suiteId: EvaluationSuiteId;
  overallStatus: 'passed' | 'failed';
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    durationMs: number;
  };
  suites: EvaluationSuiteSummary[];
};

export type EvaluationSuiteDescriptor = {
  id: EvaluationSuiteId;
  label: string;
  caseCount: number;
  requiresOpenAi: false;
  description: string;
};

export type EvaluationSuitesResponse = {
  suites: EvaluationSuiteDescriptor[];
};

export type HistoricalCaseSummary = {
  caseId: string;
  pipelineFailureClass: string;
  architectureStatus?: string;
  simulationStatus?: string | null;
  fieldAccuracy?: { matches: number; total: number };
  nodePresence?: {
    precision: number | null;
    recall: number | null;
    f1: number | null;
  };
  dependencyPresence?: {
    precision: number | null;
    recall: number | null;
    f1: number | null;
  };
  scenarioCompare?: {
    intentMatch: boolean;
    parameterMatch: boolean;
    overallMatch: boolean;
    expectedIntent?: string | null;
    actualIntent?: string | null;
  };
  explanationSource?: string | null;
  explanationValidationOk?: boolean | null;
  failureCategories?: string[];
  timingsMs?: Record<string, number | undefined>;
  fieldComparisonSample?: Array<{
    path: string;
    match: boolean;
    expected: string;
    actual: string;
    kind?: string;
  }>;
};

export type HistoricalSummary = {
  disclaimer: string;
  id: string;
  passLabel: 'baseline' | 'remediation';
  evaluationDate: string;
  generatedAt: string;
  model: string;
  dataset: string;
  maxProviderRequests: number;
  sourceArtifact: string;
  sourceArtifactSha256: string;
  liveStatus: string;
  metrics: {
    fieldAccuracy: { matches: number; total: number; pct: number };
    node: {
      precision: number | null;
      recall: number | null;
      f1: number | null;
    };
    dependency: {
      precision: number | null;
      recall: number | null;
      f1: number | null;
    };
    quantityState: {
      knownToUnknown: number;
      unknownToKnown: number;
    };
    scenarioStructured: {
      overallOk: number;
      denominator: number;
    };
    scenarioUnsupportedNl: {
      ok: number;
      denominator: number;
    };
    explanation: {
      groundedSuccess: number;
      deterministicFallback: number;
      evaluated: number;
    };
    estimatedUsd: number | null;
    wallMs: { p50: number | null; p95: number | null; sampleSize: number };
    tokens?: { input: number; output: number };
    costProjectionsPer1000Usd?: {
      A: number | null;
      B: number | null;
      C: number | null;
    };
  };
  limitations: string[];
  cases: HistoricalCaseSummary[];
  validationMdCrossCheck: {
    ok: boolean;
    discrepancies: Array<{
      path: string;
      expected: unknown;
      actual: unknown;
      message: string;
    }>;
  };
};

export type HistoricalEvaluationResponse = {
  disclaimer: string;
  artifacts: HistoricalSummary[];
  unavailable: string[];
};
