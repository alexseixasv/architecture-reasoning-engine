import { ARCHITECTURE_EXTRACTION_SCHEMA_NAME } from '../dto/architecture-extraction.dto';
import { EXPLANATION_SCHEMA_NAME } from '../dto/explanation.dto';
import {
  SCENARIO_EXTRACTION_SCHEMA_NAME,
  SCENARIO_MISSING_NUMERIC,
} from '../dto/scenario-extraction.dto';
import type { FakeLlmProvider } from './fake-llm-provider';

/**
 * Built-in Fake handlers for Compose / zero-cost HTTP demos via createLlmProvider('fake').
 * Unit tests that construct `new FakeLlmProvider()` directly remain handler-less (fail closed).
 */
export function installFakeDemoHandlers(provider: FakeLlmProvider): void {
  provider.setHandler(ARCHITECTURE_EXTRACTION_SCHEMA_NAME, async (request) => {
    const text = extractBetween(
      request.userContent,
      'UNTRUSTED_ARCHITECTURE_DESCRIPTION_BEGIN',
      'UNTRUSTED_ARCHITECTURE_DESCRIPTION_END',
    );
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
        : { presence: 'unknown' as const, unit: 'count' as const, reason: 'not stated' };

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
      ok: true,
      data: {
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
            declaredLatency: { presence: 'omitted' },
            fieldConflicts: [],
          },
        ],
        dependencies: [],
        incomingTraffic,
        availabilityTarget: { presence: 'omitted' },
        ingressNodeIds: ['api'],
        ingressDeclared: true,
        documentConflicts: [],
        clarificationQuestions:
          replicasExcerpt === undefined || capacityExcerpt === undefined
            ? ['What are the API replica count and per-replica capacity?']
            : [],
        notes: ['fake-demo extraction'],
      },
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
    ).toLowerCase();

    if (
      /monte\s*carlo|discrete[- ]event|availability\s*%|p95|p99|throughput\s+success/.test(
        question,
      )
    ) {
      return {
        ok: true,
        data: {
          outcome: 'unsupported',
          componentId: '',
          latencyMs: SCENARIO_MISSING_NUMERIC,
          multiplier: SCENARIO_MISSING_NUMERIC,
          reason: 'Scenario type not supported by the deterministic engine',
          clarificationQuestions: [],
        },
        model: 'fake-demo',
        inputTokens: 8,
        outputTokens: 16,
        totalTokens: 24,
        durationMs: 1,
      };
    }

    if (
      /\b(which|what)\s+service\b/.test(question) ||
      (/fail|down|unavailable/.test(question) &&
        !/api|pricing|checkout|inventory|gateway/.test(question))
    ) {
      return {
        ok: true,
        data: {
          outcome: 'needs_clarification',
          componentId: '',
          latencyMs: SCENARIO_MISSING_NUMERIC,
          multiplier: SCENARIO_MISSING_NUMERIC,
          reason: 'Component is ambiguous',
          clarificationQuestions: ['Which component is affected?'],
        },
        model: 'fake-demo',
        inputTokens: 8,
        outputTokens: 16,
        totalTokens: 24,
        durationMs: 1,
      };
    }

    return {
      ok: true,
      data: {
        outcome: 'load_multiplication',
        componentId: '',
        latencyMs: SCENARIO_MISSING_NUMERIC,
        multiplier: 1,
        reason: '',
        clarificationQuestions: [],
      },
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
