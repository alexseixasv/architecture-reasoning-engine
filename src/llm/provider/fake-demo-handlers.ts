import {
  ARCHITECTURE_EXTRACTION_SCHEMA_NAME,
  type ArchitectureExtractionDto,
} from '../dto/architecture-extraction.dto';
import { EXPLANATION_SCHEMA_NAME } from '../dto/explanation.dto';
import {
  SCENARIO_EXTRACTION_SCHEMA_NAME,
  SCENARIO_MISSING_NUMERIC,
  type ScenarioExtractionDto,
} from '../dto/scenario-extraction.dto';
import type { FakeLlmProvider } from './fake-llm-provider';

/**
 * Built-in Fake handlers for Compose / zero-cost HTTP demos via createLlmProvider('fake').
 * Unit tests that construct `new FakeLlmProvider()` directly remain handler-less (fail closed).
 *
 * Covers two defense paths:
 * - simple API demo (original)
 * - checkout → pricing → postgres (+ queue/invoicing) live case
 */
export function installFakeDemoHandlers(provider: FakeLlmProvider): void {
  provider.setHandler(ARCHITECTURE_EXTRACTION_SCHEMA_NAME, async (request) => {
    const text = extractBetween(
      request.userContent,
      'UNTRUSTED_ARCHITECTURE_DESCRIPTION_BEGIN',
      'UNTRUSTED_ARCHITECTURE_DESCRIPTION_END',
    );

    const data = looksLikeCheckoutPricing(text)
      ? checkoutPricingExtraction(text)
      : simpleApiExtraction(text);

    return {
      ok: true,
      data,
      model: 'fake-demo',
      inputTokens: Math.max(1, Math.ceil(text.length / 4)),
      outputTokens: 64,
      totalTokens: Math.max(65, Math.ceil(text.length / 4) + 64),
      durationMs: 1,
    };
  });

  provider.setHandler(SCENARIO_EXTRACTION_SCHEMA_NAME, async (request) => {
    const question = extractBetween(
      request.userContent,
      'UNTRUSTED_QUESTION_BEGIN',
      'UNTRUSTED_QUESTION_END',
    );
    const catalog = extractBetween(
      request.userContent,
      'TRUSTED_NODE_CATALOG_BEGIN',
      'TRUSTED_NODE_CATALOG_END',
    );

    return {
      ok: true,
      data: classifyFakeScenario(question, catalog),
      model: 'fake-demo',
      inputTokens: 8,
      outputTokens: 16,
      totalTokens: 24,
      durationMs: 1,
    };
  });

  provider.setHandler(EXPLANATION_SCHEMA_NAME, async (request) => {
    let catalog: {
      status?: string;
      calculatedMetricIds?: string[];
      refusedMetricIds?: string[];
      refusalCodes?: string[];
      availableComponents?: string[];
    } = {};
    try {
      const begin = request.userContent.indexOf('TRUSTED_EVIDENCE_PACKET_BEGIN');
      const end = request.userContent.indexOf('TRUSTED_EVIDENCE_PACKET_END');
      if (begin >= 0 && end > begin) {
        const json = request.userContent
          .slice(begin + 'TRUSTED_EVIDENCE_PACKET_BEGIN'.length, end)
          .trim();
        catalog = JSON.parse(json) as typeof catalog;
      }
    } catch {
      catalog = {};
    }

    const status = catalog.status ?? 'ANSWERED';
    const metricIds = (catalog.calculatedMetricIds ?? []).filter((id) =>
      id.startsWith('utilization:'),
    );
    const timeoutMetrics = (catalog.calculatedMetricIds ?? []).filter((id) =>
      id.startsWith('timeout_violated:'),
    );
    const componentIds = catalog.availableComponents ?? [];
    const refusedMetricIds = (catalog.refusedMetricIds ?? []).slice(0, 1);
    const refusalCodes = (catalog.refusalCodes ?? []).slice(0, 1);

    const statements = [];
    if (metricIds.length > 0) {
      statements.push({
        text: 'Utilization is provided by a calculated engine metric.',
        metricIds: metricIds.slice(0, 1),
        refusedMetricIds: [],
        componentIds: componentIds.slice(0, 1),
        refusalCodes: [],
        claimKind: 'saturation_classification',
      });
    }
    if (timeoutMetrics.length > 0) {
      statements.push({
        text: 'Timeout violation is provided by a calculated engine metric.',
        metricIds: timeoutMetrics.slice(0, 1),
        refusedMetricIds: [],
        componentIds: componentIds.slice(0, 1),
        refusalCodes: [],
        claimKind: 'general',
      });
    }
    if (refusedMetricIds.length > 0 && refusalCodes.length > 0) {
      statements.push({
        text: 'A standing fabrication metric remains refused by the engine.',
        metricIds: [],
        refusedMetricIds,
        componentIds: [],
        refusalCodes,
        claimKind: 'refusal_preserved',
      });
    }
    if (statements.length === 0) {
      statements.push({
        text: 'Engine result is summarized without inventing numbers.',
        metricIds: [],
        refusedMetricIds: [],
        componentIds: [],
        refusalCodes: [],
        claimKind: 'general',
      });
    }

    return {
      ok: true,
      data: {
        summary: 'Fake-demo grounded explanation of the engine result.',
        acknowledgedStatus: status,
        statements,
      },
      model: 'fake-demo',
      inputTokens: 32,
      outputTokens: 48,
      totalTokens: 80,
      durationMs: 1,
    };
  });
}

function looksLikeCheckoutPricing(text: string): boolean {
  return /checkout/i.test(text) && /pricing/i.test(text);
}

function omitted(): { presence: 'omitted' } {
  return { presence: 'omitted' };
}

function unknown(
  unit: 'rps' | 'ms' | 'count' | 'percent' | 'ratio',
  reason: string,
): {
  presence: 'unknown';
  unit: 'rps' | 'ms' | 'count' | 'percent' | 'ratio';
  reason: string;
} {
  return { presence: 'unknown', unit, reason };
}

function declaredFrom(
  text: string,
  re: RegExp,
  unit: 'rps' | 'ms' | 'count' | 'percent' | 'ratio',
  mapValue: (raw: number) => number = (n) => n,
):
  | {
      presence: 'declared';
      value: number;
      unit: 'rps' | 'ms' | 'count' | 'percent' | 'ratio';
      sourceExcerpt: string;
    }
  | { presence: 'omitted' } {
  const found = findExcerpt(text, re);
  if (found === undefined || found.match[1] === undefined) {
    return omitted();
  }
  return {
    presence: 'declared',
    value: mapValue(Number(found.match[1])),
    unit,
    sourceExcerpt: found.excerpt,
  };
}

function simpleApiExtraction(text: string): ArchitectureExtractionDto {
  const replicasExcerpt = findExcerpt(text, /(\d+)\s+replicas?/i);
  const capacityExcerpt = findExcerpt(
    text,
    /(\d+)\s+requests?\s+per\s+second/i,
  );
  const trafficExcerpt = findExcerpt(text, /(\d+)\s*rps/i);

  const replicas =
    replicasExcerpt !== undefined
      ? {
          presence: 'declared' as const,
          value: Number(replicasExcerpt.match?.[1]),
          unit: 'count' as const,
          sourceExcerpt: replicasExcerpt.excerpt,
        }
      : {
          presence: 'unknown' as const,
          unit: 'count' as const,
          reason: 'not stated',
        };

  const capacityPerReplica =
    capacityExcerpt !== undefined
      ? {
          presence: 'declared' as const,
          value: Number(capacityExcerpt.match?.[1]),
          unit: 'rps' as const,
          sourceExcerpt: capacityExcerpt.excerpt,
        }
      : { presence: 'omitted' as const };

  const incomingTraffic =
    trafficExcerpt !== undefined
      ? {
          presence: 'declared' as const,
          value: Number(trafficExcerpt.match?.[1]),
          unit: 'rps' as const,
          sourceExcerpt: trafficExcerpt.excerpt,
        }
      : { presence: 'omitted' as const };

  return {
    name: 'demo',
    description: '',
    nodes: [
      {
        id: 'api',
        kind: 'service',
        name: 'API',
        replicas,
        capacityPerReplica,
        capacityAggregation: 'sum_replicas',
        declaredLatency: omitted(),
        fieldConflicts: [],
      },
    ],
    dependencies: [],
    incomingTraffic,
    availabilityTarget: omitted(),
    ingressNodeIds: ['api'],
    ingressDeclared: true,
    documentConflicts: [],
    clarificationQuestions:
      replicasExcerpt === undefined || capacityExcerpt === undefined
        ? ['What are the API replica count and per-replica capacity?']
        : [],
    notes: ['fake-demo extraction'],
  };
}

function checkoutPricingExtraction(text: string): ArchitectureExtractionDto {
  const capacity = declaredFrom(text, /(\d+)\s*rps/i, 'rps');
  const checkoutReplicas = declaredFrom(
    text,
    /checkout\s+runs\s+(\d+)\s+replicas/i,
    'count',
  );
  const pricingReplicas = declaredFrom(text, /pricing\s+(\d+)/i, 'count');
  const timeoutMs = declaredFrom(
    text,
    /(\d+)\s*s(?:ec(?:ond)?s?)?\s+timeout/i,
    'ms',
    (seconds) => seconds * 1000,
  );
  const retries = declaredFrom(text, /(\d+)\s+retr(?:y|ies)/i, 'count');
  const availabilityTarget = declaredFrom(
    text,
    /target(?:\s+is)?[^\n.]{0,40}?(\d+(?:\.\d+)?)\s*%/i,
    'percent',
  );

  const postgresSingle = /single\s+postgres/i.test(text);
  const postgresReplicas = postgresSingle
    ? (() => {
        const found = findExcerpt(text, /single\s+postgres(?:ql)?\s+primary/i);
        return {
          presence: 'declared' as const,
          value: 1,
          unit: 'count' as const,
          sourceExcerpt: found?.excerpt ?? 'single Postgres primary',
        };
      })()
    : omitted();

  const hasQueue = /queue/i.test(text);
  const hasInvoicing = /invoic/i.test(text);

  const nodes: ArchitectureExtractionDto['nodes'] = [
    {
      id: 'checkout',
      kind: 'service',
      name: 'Checkout API',
      replicas: checkoutReplicas,
      capacityPerReplica: capacity,
      capacityAggregation: 'sum_replicas',
      declaredLatency: omitted(),
      fieldConflicts: [],
    },
    {
      id: 'pricing',
      kind: 'service',
      name: 'Pricing',
      replicas: pricingReplicas,
      capacityPerReplica: capacity,
      capacityAggregation: 'sum_replicas',
      declaredLatency: omitted(),
      fieldConflicts: [],
    },
    {
      id: 'postgres',
      kind: 'datastore',
      name: 'Postgres primary',
      replicas: postgresReplicas,
      capacityPerReplica: omitted(),
      capacityAggregation: 'primary_only',
      declaredLatency: omitted(),
      fieldConflicts: [],
    },
  ];

  if (hasQueue) {
    nodes.push({
      id: 'invoice-queue',
      kind: 'queue',
      name: 'Invoice events',
      replicas: omitted(),
      capacityPerReplica: omitted(),
      capacityAggregation: 'omitted',
      declaredLatency: omitted(),
      fieldConflicts: [],
    });
  }
  if (hasInvoicing) {
    nodes.push({
      id: 'invoicing',
      kind: 'service',
      name: 'Invoicing worker',
      replicas: omitted(),
      capacityPerReplica: omitted(),
      capacityAggregation: 'omitted',
      declaredLatency: omitted(),
      fieldConflicts: [],
    });
  }

  const dependencies: ArchitectureExtractionDto['dependencies'] = [
    {
      id: 'checkout-pricing',
      from: 'checkout',
      to: 'pricing',
      communication: 'sync',
      timeout: timeoutMs,
      retry:
        retries.presence === 'declared'
          ? {
              presence: 'declared',
              additionalAttempts: retries,
              backoff: { type: 'none' },
            }
          : { presence: 'omitted' },
      requestsPerParent: omitted(),
    },
    {
      id: 'pricing-postgres',
      from: 'pricing',
      to: 'postgres',
      communication: 'sync',
      timeout: omitted(),
      retry: { presence: 'omitted' },
      requestsPerParent: omitted(),
    },
  ];

  if (hasQueue) {
    dependencies.push({
      id: 'checkout-queue',
      from: 'checkout',
      to: 'invoice-queue',
      communication: 'async',
      timeout: omitted(),
      retry: { presence: 'omitted' },
      requestsPerParent: omitted(),
    });
  }
  if (hasQueue && hasInvoicing) {
    dependencies.push({
      id: 'queue-invoicing',
      from: 'invoice-queue',
      to: 'invoicing',
      communication: 'async',
      timeout: omitted(),
      retry: { presence: 'omitted' },
      requestsPerParent: omitted(),
    });
  }

  return {
    name: 'checkout-pricing',
    description: '',
    nodes,
    dependencies,
    incomingTraffic: unknown(
      'rps',
      'Ingress RPS is not declared; “80%” is not a requests-per-second quantity',
    ),
    availabilityTarget,
    ingressNodeIds: ['checkout'],
    ingressDeclared: true,
    documentConflicts: [],
    clarificationQuestions: [
      'What is the ingress traffic in rps (not utilization %)?',
      'What is the pricing → Postgres timeout in milliseconds?',
    ],
    notes: [
      'fake-demo checkout-pricing extraction',
      'Claimed actual availability percentages are not architecture inputs and are not used as engine answers',
    ],
  };
}

function classifyFakeScenario(
  question: string,
  catalog: string,
): ScenarioExtractionDto {
  const q = question.toLowerCase();

  if (
    /monte\s*carlo|discrete[- ]event|availability\s*%|p95|p99|throughput\s+success/.test(
      q,
    )
  ) {
    return {
      outcome: 'unsupported',
      componentId: '',
      latencyMs: SCENARIO_MISSING_NUMERIC,
      multiplier: SCENARIO_MISSING_NUMERIC,
      reason: 'Scenario type not supported by the deterministic engine',
      clarificationQuestions: [],
    };
  }

  const latencyIntent =
    /latency|slow(?:er|ing)?|timeout/.test(q) &&
    /(\d+)\s*(ms|milliseconds|s|sec|seconds)\b/.test(q);

  if (latencyIntent) {
    const seconds = findExcerpt(
      question,
      /(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)\b/i,
    );
    const millis = findExcerpt(
      question,
      /(\d+(?:\.\d+)?)\s*(?:ms|milliseconds)\b/i,
    );
    let latencyMs: number = SCENARIO_MISSING_NUMERIC;
    if (millis?.match[1] !== undefined) {
      latencyMs = Number(millis.match[1]);
    } else if (seconds?.match[1] !== undefined) {
      latencyMs = Number(seconds.match[1]) * 1000;
    }

    const componentId = resolveCatalogComponent(q, catalog);
    if (!componentId) {
      return {
        outcome: 'needs_clarification',
        componentId: '',
        latencyMs,
        multiplier: SCENARIO_MISSING_NUMERIC,
        reason: 'Latency component is ambiguous',
        clarificationQuestions: ['Which component has the increased latency?'],
      };
    }

    return {
      outcome: 'latency_degradation',
      componentId,
      latencyMs,
      multiplier: SCENARIO_MISSING_NUMERIC,
      reason: '',
      clarificationQuestions: [],
    };
  }

  if (
    /\b(which|what)\s+service\b/.test(q) ||
    (/fail|down|unavailable/.test(q) &&
      !/api|pricing|checkout|inventory|gateway|postgres/.test(q))
  ) {
    return {
      outcome: 'needs_clarification',
      componentId: '',
      latencyMs: SCENARIO_MISSING_NUMERIC,
      multiplier: SCENARIO_MISSING_NUMERIC,
      reason: 'Component is ambiguous',
      clarificationQuestions: ['Which component is affected?'],
    };
  }

  return {
    outcome: 'load_multiplication',
    componentId: '',
    latencyMs: SCENARIO_MISSING_NUMERIC,
    multiplier: 1,
    reason: '',
    clarificationQuestions: [],
  };
}

function resolveCatalogComponent(
  questionLower: string,
  catalog: string,
): string {
  const ids = [...catalog.matchAll(/id=([^\s]+)/g)].map((m) => m[1] ?? '');
  const aliases: Array<{ id: string; needles: RegExp }> = [
    { id: 'postgres', needles: /postgres|postgresql|database|\bdb\b/ },
    { id: 'pricing', needles: /pricing/ },
    { id: 'checkout', needles: /checkout/ },
    { id: 'invoicing', needles: /invoic/ },
    { id: 'api', needles: /\bapi\b/ },
  ];
  for (const alias of aliases) {
    if (alias.needles.test(questionLower) && ids.includes(alias.id)) {
      return alias.id;
    }
  }
  return '';
}

function extractBetween(text: string, begin: string, end: string): string {
  const i = text.indexOf(begin);
  const j = text.indexOf(end);
  if (i < 0 || j < 0 || j <= i) {
    return text;
  }
  return text.slice(i + begin.length, j).trim();
}

function findExcerpt(
  text: string,
  re: RegExp,
): { excerpt: string; match: RegExpMatchArray } | undefined {
  const match = text.match(re);
  if (!match || match.index === undefined) {
    return undefined;
  }
  return { excerpt: match[0], match };
}
