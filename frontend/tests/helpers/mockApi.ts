import type { ApiClient } from '@/api/client';
import { ApiClientError } from '@/api/client';
import type {
  AnalyzeHttpResponse,
  ArchitectureEnvelope,
  DocumentDiff,
  EvaluationRunResult,
  EvaluationSuitesResponse,
  ExtractHttpResponse,
  HistoricalEvaluationResponse,
  UsageSummary,
  ValidateResponse,
  VersionListItem,
} from '@/api/types';

export function emptyUsage(partial?: Partial<UsageSummary['totals']>): UsageSummary {
  return {
    operations: [],
    totals: {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      durationMs: 2,
      estimatedCostUsd: null,
      pricingIncomplete: true,
      ...partial,
    },
  };
}

export function proposedExtract(document: unknown): ExtractHttpResponse {
  return {
    status: 'PROPOSED',
    document,
    findings: [],
    gaps: [],
    clarificationQuestions: [],
    notes: ['fake'],
    canPersist: true,
    usage: emptyUsage(),
    errorClass: null,
  };
}

export function sampleDocument(name = 'demo') {
  return {
    schemaVersion: '1.0.0',
    name,
    nodes: [
      {
        id: 'api',
        kind: 'service',
        name: 'API',
        replicas: {
          state: 'known',
          value: 4,
          unit: 'count',
          provenance: 'declared',
        },
        capacityPerReplica: {
          state: 'known',
          value: 80,
          unit: 'rps',
          provenance: 'declared',
        },
        capacityAggregation: 'sum_replicas',
      },
    ],
    dependencies: [],
    system: {
      incomingTraffic: {
        state: 'known',
        value: 80,
        unit: 'rps',
        provenance: 'declared',
      },
      ingressNodeIds: ['api'],
    },
    assumptions: [],
    conflicts: [],
  };
}

type Store = {
  latest: number;
  docs: Map<number, unknown>;
  versions: VersionListItem[];
};

export function createMockApi(overrides: Partial<ApiClient> = {}): ApiClient & {
  calls: string[];
  store: Store;
  forceConflictOnce: () => void;
} {
  const calls: string[] = [];
  const store: Store = {
    latest: 0,
    docs: new Map(),
    versions: [],
  };
  let conflictOnce = false;

  const mock: ApiClient & {
    calls: string[];
    store: Store;
    forceConflictOnce: () => void;
  } = {
    calls,
    store,
    forceConflictOnce() {
      conflictOnce = true;
    },
    async extract(architectureText: string) {
      calls.push(`extract:${architectureText.slice(0, 24)}`);
      return proposedExtract(sampleDocument());
    },
    async validate(doc: unknown) {
      calls.push('validate');
      return {
        document: doc,
        findings: [],
        canPersist: true,
      } satisfies ValidateResponse;
    },
    async create(doc: unknown) {
      calls.push('create');
      store.latest = 1;
      store.docs.set(1, doc);
      store.versions = [
        {
          version: 1,
          createdAt: new Date().toISOString(),
          changeSource: 'approved_extraction',
        },
      ];
      return {
        architectureId: 'arch-test',
        version: 1,
        schemaVersion: '1.0.0',
        document: doc,
        findings: [],
        changeSource: 'approved_extraction',
        createdAt: new Date().toISOString(),
      } satisfies ArchitectureEnvelope;
    },
    async getLatest(id: string) {
      calls.push(`getLatest:${id}`);
      const version = store.latest || 1;
      const document = store.docs.get(version) ?? sampleDocument();
      return {
        architectureId: id,
        version,
        schemaVersion: '1.0.0',
        document,
        findings: [],
        changeSource: 'approved_extraction',
        createdAt: new Date().toISOString(),
      };
    },
    async listVersions(id: string) {
      calls.push(`listVersions:${id}`);
      return {
        architectureId: id,
        versions: [...store.versions],
      };
    },
    async getVersion(id: string, version: number) {
      calls.push(`getVersion:${id}:${version}`);
      const document = store.docs.get(version);
      if (!document) {
        throw new ApiClientError({
          message: `Version ${version} not found`,
          status: 404,
        });
      }
      return {
        architectureId: id,
        version,
        schemaVersion: '1.0.0',
        document,
        findings: [],
        changeSource: 'user_corrected',
        createdAt: new Date().toISOString(),
      };
    },
    async update(id: string, expectedVersion: number, doc: unknown) {
      calls.push(`update:${id}:${expectedVersion}`);
      if (conflictOnce || expectedVersion !== store.latest) {
        conflictOnce = false;
        throw new ApiClientError({
          message: 'Version conflict',
          status: 409,
          errorClass: 'VERSION_CONFLICT',
          body: {
            message: 'Version conflict',
            architectureId: id,
            expectedVersion,
            actualVersion: store.latest,
          },
        });
      }
      const next = store.latest + 1;
      store.latest = next;
      store.docs.set(next, doc);
      store.versions.push({
        version: next,
        createdAt: new Date().toISOString(),
        changeSource: 'user_corrected',
      });
      return {
        architectureId: id,
        version: next,
        schemaVersion: '1.0.0',
        document: doc,
        findings: [],
        changeSource: 'user_corrected',
        createdAt: new Date().toISOString(),
      };
    },
    async diff(id: string, from: number, to: number) {
      calls.push(`diff:${id}:${from}:${to}`);
      const before = store.docs.get(from);
      const after = store.docs.get(to);
      const changes =
        JSON.stringify(before) === JSON.stringify(after)
          ? []
          : [
              {
                entityType: 'meta' as const,
                id: 'name',
                path: 'name',
                kind: 'changed' as const,
                before: (before as { name?: string } | undefined)?.name,
                after: (after as { name?: string } | undefined)?.name,
              },
            ];
      return {
        fromVersion: from,
        toVersion: to,
        changes,
      } satisfies DocumentDiff;
    },
    async analyze(id: string, version: number, question: string) {
      calls.push(`analyze:${id}:${version}:${question.slice(0, 20)}`);
      const unsupported = /availability\s*%/i.test(question);
      const response: AnalyzeHttpResponse = {
        architectureId: id,
        architectureVersion: version,
        scenarioExtraction: unsupported
          ? {
              status: 'UNSUPPORTED',
              scenario: null,
              reason: 'availability percent not supported',
              clarificationQuestions: [],
            }
          : {
              status: 'OK',
              scenario: { type: 'load_multiplication', multiplier: 1 },
              reason: null,
              clarificationQuestions: [],
            },
        simulation: unsupported
          ? null
          : {
              status: 'ANSWERED',
              metrics: [
                {
                  metricId: 'utilization:api',
                  value: 0.25,
                  unit: 'ratio',
                  formulaId: 'F-UTIL-001',
                },
              ],
              refused: [
                {
                  metricId: 'availability_percent',
                  reasonCode: 'NO_AVAILABILITY_MODEL',
                  message: 'Availability % is not modeled',
                },
              ],
              assumptions: [],
            },
        explanation: unsupported
          ? null
          : {
              source: 'llm+deterministic',
              markdown: 'Utilization is provided by the engine.',
              evidenceMarkdown: '### Evidence',
            },
        usage: emptyUsage({ estimatedCostUsd: null, pricingIncomplete: true }),
        timingsMs: {
          extractScenario: 1,
          simulate: 1,
          explain: 1,
          total: 3,
        },
      };
      return response;
    },
    async health() {
      calls.push('health');
      return {
        status: 'ok',
        service: 'architecture-reasoning-engine',
        version: '0.1.0',
      };
    },
    async listEvaluationSuites() {
      calls.push('listEvaluationSuites');
      return sampleEvaluationSuites();
    },
    async runEvaluation(suiteId = 'deterministic_full' as const) {
      calls.push(`runEvaluation:${suiteId}`);
      return sampleEvaluationRun(suiteId);
    },
    async getHistoricalEvaluation() {
      calls.push('getHistoricalEvaluation');
      return sampleHistoricalEvaluation();
    },
    ...overrides,
  };

  return mock;
}

export function sampleEvaluationSuites(): EvaluationSuitesResponse {
  return {
    suites: [
      {
        id: 'deterministic_full',
        label: 'Deterministic full (G+V+ADV)',
        caseCount: 32,
        requiresOpenAi: false,
        description: 'All allowlisted deterministic cases.',
      },
      {
        id: 'golden',
        label: 'Golden G01–G12',
        caseCount: 12,
        requiresOpenAi: false,
        description: 'Golden simulation fixtures.',
      },
    ],
  };
}

export function sampleEvaluationRun(
  suiteId: EvaluationRunResult['suiteId'] = 'deterministic_full',
  opts?: { failG03?: boolean },
): EvaluationRunResult {
  const g01 = {
    caseId: 'G01',
    suiteId: 'golden' as const,
    checkKind: 'simulation_correctness' as const,
    description: 'capacity sum_replicas',
    verifies: 'Simulation correctness against expected.json. No LLM.',
    executedAt: '2026-11-15T21:00:00.000Z',
    status: 'passed' as const,
    durationMs: 4.2,
    expectedOutcome: { status: 'ANSWERED' },
    actualOutcome: { status: 'ANSWERED' },
    mismatches: [],
    evidence: {
      determinismOk: true,
      formulaIds: ['F-UTIL-001'],
      refusedReasonCodes: ['NO_AVAILABILITY_MODEL'],
      metricEvidence: [
        {
          metricId: 'utilization:api',
          expectedValue: 0.25,
          actualValue: 0.25,
          unit: 'ratio',
          formulaId: 'F-UTIL-001',
          expectedFormulaId: 'F-UTIL-001',
          substitutions: ['U = offered / capacity'],
          inputPaths: ['node_offered_load:api'],
          result: '0.25',
        },
      ],
    },
    failureReason: null,
    input: { architecture: { name: 'g01' }, scenario: { type: 'load_multiplication' } },
  };

  const g03 = {
    caseId: 'G03',
    suiteId: 'golden' as const,
    checkKind: 'simulation_correctness' as const,
    description: 'load multiplication normal',
    verifies: 'Simulation correctness. No LLM.',
    executedAt: '2026-11-15T21:00:00.000Z',
    status: (opts?.failG03 ? 'failed' : 'passed') as 'passed' | 'failed',
    durationMs: 3.1,
    expectedOutcome: { status: 'ANSWERED' },
    actualOutcome: opts?.failG03
      ? { status: 'PARTIALLY_ANSWERED' }
      : { status: 'ANSWERED' },
    mismatches: opts?.failG03
      ? [
          {
            path: 'status',
            expected: 'ANSWERED',
            actual: 'PARTIALLY_ANSWERED',
            message: 'status mismatch',
          },
        ]
      : [],
    evidence: { determinismOk: true, formulaIds: ['F-LOAD-001'] },
    failureReason: opts?.failG03 ? 'status mismatch' : null,
    input: { architecture: { name: 'g03' }, scenario: { type: 'load_multiplication' } },
  };

  const v10 = {
    caseId: 'V10',
    suiteId: 'validation_formal' as const,
    checkKind: 'schema_validation' as const,
    description: 'V10 schema_only (unsupported NL documented; not NL classification)',
    verifies:
      'Schema validation only. Does NOT claim NL scenario classification success.',
    executedAt: '2026-11-15T21:00:00.000Z',
    status: 'passed' as const,
    durationMs: 0.5,
    expectedOutcome: { execution: 'schema_only' },
    actualOutcome: { execution: 'schema_only', schemaValid: true },
    mismatches: [],
    evidence: { notes: ['V10/V11: schema_only — no simulate'] },
    failureReason: null,
    input: { meta: { execution: 'schema_only' } },
  };

  const adv08 = {
    caseId: 'ADV-08',
    suiteId: 'adversarial' as const,
    checkKind: 'nl_isolation_check' as const,
    description:
      'NL isolation check — injection markdown unused by simulate (NOT LLM prompt-injection resistance)',
    verifies:
      'Deterministic NL isolation. This does NOT prove LLM prompt-injection resistance.',
    executedAt: '2026-11-15T21:00:00.000Z',
    status: 'passed' as const,
    durationMs: 0.8,
    expectedOutcome: {
      nlNotPassedToSimulate: true,
      llmPromptInjectionResistance: 'NOT_CLAIMED',
    },
    actualOutcome: {
      nlPassedToSimulate: false,
      llmPromptInjectionResistance: 'NOT_TESTED',
    },
    mismatches: [],
    evidence: {
      notes: [
        'Do not cite this case as evidence that prompt injection against a real LLM was tested.',
      ],
    },
    failureReason: null,
    input: { nlFixturePresent: true },
  };

  const failed = opts?.failG03 ? 1 : 0;
  const passed = 4 - failed;

  return {
    runId: 'evr_test_001',
    executedAt: '2026-11-15T21:00:00.000Z',
    suiteId,
    overallStatus: failed ? 'failed' : 'passed',
    summary: {
      total: 4,
      passed,
      failed,
      skipped: 0,
      durationMs: 12.5,
    },
    suites: [
      {
        suiteId: 'golden',
        passed: failed ? 1 : 2,
        failed,
        skipped: 0,
        durationMs: 8,
        cases: [g01, g03],
      },
      {
        suiteId: 'validation_formal',
        passed: 1,
        failed: 0,
        skipped: 0,
        durationMs: 2,
        cases: [v10],
      },
      {
        suiteId: 'adversarial',
        passed: 1,
        failed: 0,
        skipped: 0,
        durationMs: 2.5,
        cases: [adv08],
      },
    ],
  };
}

export function sampleHistoricalEvaluation(): HistoricalEvaluationResponse {
  return {
    disclaimer: 'Historical OpenAI evaluation — not executed in this run',
    unavailable: [],
    artifacts: [
      {
        disclaimer: 'Historical OpenAI evaluation — not executed in this run',
        id: 'baseline-2026-11-15',
        passLabel: 'baseline',
        evaluationDate: '2026-11-15',
        generatedAt: '2026-11-15T13:40:00.172Z',
        model: 'gpt-4.1',
        dataset: 'V01–V12',
        maxProviderRequests: 34,
        sourceArtifact: 'artifacts/eval/run-2026-11-15T13-40-00-172Z.json',
        sourceArtifactSha256: '2d1ca9c7',
        liveStatus: 'MEASURED',
        metrics: {
          fieldAccuracy: { matches: 120, total: 235, pct: 51.06 },
          node: { precision: 0.8, recall: 0.86, f1: 0.83 },
          dependency: { precision: 0.7, recall: 0.78, f1: 0.74 },
          quantityState: { knownToUnknown: 61, unknownToKnown: 0 },
          scenarioStructured: { overallOk: 10, denominator: 10 },
          scenarioUnsupportedNl: { ok: 1, denominator: 2 },
          explanation: {
            groundedSuccess: 9,
            deterministicFallback: 1,
            evaluated: 10,
          },
          estimatedUsd: 0.186,
          wallMs: { p50: 7972, p95: 10980, sampleSize: 12 },
          tokens: { input: 43247, output: 12405 },
        },
        limitations: [
          'formal_context_scenario_scoring',
          'small_sample_N12',
          'estimated_usd_not_invoice',
          'fake_llm_not_openai_accuracy',
        ],
        cases: [
          {
            caseId: 'V01',
            pipelineFailureClass: 'none',
            fieldAccuracy: { matches: 10, total: 12 },
            scenarioCompare: {
              intentMatch: true,
              parameterMatch: true,
              overallMatch: true,
            },
            explanationSource: 'llm+deterministic',
          },
        ],
        validationMdCrossCheck: { ok: true, discrepancies: [] },
      },
      {
        disclaimer: 'Historical OpenAI evaluation — not executed in this run',
        id: 'remediation-2026-11-15',
        passLabel: 'remediation',
        evaluationDate: '2026-11-15',
        generatedAt: '2026-11-15T13:55:04.443Z',
        model: 'gpt-4.1',
        dataset: 'V01–V12',
        maxProviderRequests: 34,
        sourceArtifact: 'artifacts/eval/run-2026-11-15T13-55-04-443Z.json',
        sourceArtifactSha256: '47a76aa3',
        liveStatus: 'MEASURED',
        metrics: {
          fieldAccuracy: { matches: 141, total: 244, pct: 57.79 },
          node: { precision: 0.83, recall: 0.89, f1: 0.86 },
          dependency: { precision: 0.8, recall: 0.89, f1: 0.84 },
          quantityState: { knownToUnknown: 57, unknownToKnown: 0 },
          scenarioStructured: { overallOk: 10, denominator: 10 },
          scenarioUnsupportedNl: { ok: 2, denominator: 2 },
          explanation: {
            groundedSuccess: 9,
            deterministicFallback: 1,
            evaluated: 10,
          },
          estimatedUsd: 0.203,
          wallMs: { p50: 7575, p95: 19828, sampleSize: 12 },
          tokens: { input: 49931, output: 12872 },
        },
        limitations: ['denominator_change_between_passes'],
        cases: [
          {
            caseId: 'V01',
            pipelineFailureClass: 'none',
            fieldAccuracy: { matches: 11, total: 12 },
            scenarioCompare: {
              intentMatch: true,
              parameterMatch: true,
              overallMatch: true,
            },
            explanationSource: 'llm+deterministic',
          },
        ],
        validationMdCrossCheck: { ok: true, discrepancies: [] },
      },
    ],
  };
}
