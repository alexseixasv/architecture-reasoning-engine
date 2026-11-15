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
