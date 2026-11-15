import type { ApiClient } from '@/api/client';
import { ApiClientError } from '@/api/client';
import type {
  AnalyzeHttpResponse,
  ArchitectureEnvelope,
  DocumentDiff,
  ExtractHttpResponse,
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
    ...overrides,
  };

  return mock;
}
