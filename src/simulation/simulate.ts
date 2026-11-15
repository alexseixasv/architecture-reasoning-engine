import type { ArchitectureDocument } from '../architecture/domain/types';
import { analyzeLatencyDegradation } from './calculators/latency';
import { analyzeRetriesOnEdges } from './calculators/retries';
import { analyzeUnavailability } from './calculators/unavailability';
import { scenarioSchema, type Scenario } from './domain/scenario';
import type {
  MetricEvidence,
  RefusedMetric,
  SimulationAssumption,
  SimulationResult,
} from './domain/result';
import { sortMetrics } from './evidence/build-evidence';
import { accumulateLoad } from './graph/load_graph';

function emptyResult(scenario: Scenario): SimulationResult {
  return {
    scenario,
    status: 'NOT_ANSWERABLE',
    metrics: [],
    refused: [],
    impacts: [],
    saturations: [],
    assumptions: [],
    warnings: [],
    propagationPaths: [],
  };
}

function mergeRefused(target: RefusedMetric[], extra: RefusedMetric[]): void {
  const seen = new Set(target.map((r) => `${r.metricId}:${r.reasonCode}`));
  for (const r of extra) {
    const key = `${r.metricId}:${r.reasonCode}`;
    if (!seen.has(key)) {
      target.push(r);
      seen.add(key);
    }
  }
}

function sortResult(result: SimulationResult): SimulationResult {
  return {
    ...result,
    metrics: sortMetrics(result.metrics),
    refused: [...result.refused].sort(
      (a, b) =>
        a.metricId.localeCompare(b.metricId) ||
        a.reasonCode.localeCompare(b.reasonCode),
    ),
    impacts: [...result.impacts].sort((a, b) =>
      a.componentId.localeCompare(b.componentId),
    ),
    saturations: [...result.saturations].sort((a, b) =>
      a.componentId.localeCompare(b.componentId),
    ),
    assumptions: [...result.assumptions].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
    warnings: [...result.warnings].sort(),
    propagationPaths: [...result.propagationPaths].sort((a, b) =>
      a.componentId.localeCompare(b.componentId),
    ),
  };
}

function alwaysRefuseFabrications(refused: RefusedMetric[]): void {
  refused.push({
    metricId: 'availability_percent',
    reasonCode: 'NO_AVAILABILITY_MODEL',
    message:
      'Availability percentage is not mathematically defensible without a failure-probability model',
  });
  refused.push({
    metricId: 'throughput',
    reasonCode: 'NO_THROUGHPUT_MODEL',
    message:
      'Successful throughput is not computed; offered load and capacity are distinct from completed work',
  });
  refused.push({
    metricId: 'latency_p95_p99',
    reasonCode: 'NO_LATENCY_DISTRIBUTION',
    message: 'p95/p99 and latency distributions are not invented',
  });
}

/**
 * Pure deterministic simulation. Does not mutate `architecture`.
 * Independent of NestJS, Drizzle, PostgreSQL, and LLM providers.
 */
export function simulate(
  architecture: ArchitectureDocument,
  scenarioInput: unknown,
): SimulationResult {
  const parsed = scenarioSchema.safeParse(scenarioInput);
  if (!parsed.success) {
    const fallback: Scenario = {
      type: 'load_multiplication',
      multiplier: 1,
    };
    const result = emptyResult(
      typeof scenarioInput === 'object' &&
        scenarioInput !== null &&
        'type' in scenarioInput &&
        typeof (scenarioInput as { type: unknown }).type === 'string'
        ? (scenarioInput as Scenario)
        : fallback,
    );
    result.refused.push({
      metricId: 'scenario',
      reasonCode: 'INVALID_SCENARIO',
      message: parsed.error.issues.map((i) => i.message).join('; '),
    });
    alwaysRefuseFabrications(result.refused);
    return sortResult(result);
  }

  const scenario = parsed.data;
  // Read-only use of architecture — never assign into it.
  const document = architecture;

  const metrics: MetricEvidence[] = [];
  const refused: RefusedMetric[] = [];
  const assumptions: SimulationAssumption[] = [];
  const warnings: string[] = [];

  alwaysRefuseFabrications(refused);

  if (scenario.type === 'component_unavailable') {
    const analysis = analyzeUnavailability(document, scenario.componentId);
    assumptions.push(...analysis.assumptions);
    warnings.push(...analysis.warnings);

    if (!analysis.primarySatisfied) {
      refused.push({
        metricId: 'component_unavailable',
        reasonCode: 'UNKNOWN_COMPONENT',
        message: analysis.refusedReason ?? 'Unknown component',
      });
      return sortResult({
        scenario,
        status: 'NOT_ANSWERABLE',
        metrics,
        refused,
        impacts: [],
        saturations: [],
        assumptions,
        warnings,
        propagationPaths: [],
      });
    }

    const callingEdges = document.dependencies
      .filter(
        (d) =>
          d.communication === 'sync' && d.to === scenario.componentId,
      )
      .map((d) => d.id);

    const load = accumulateLoad(document, 1);
    assumptions.push(...load.assumptions);
    warnings.push(...load.warnings);
    // Do not require load for primary unavailability answer
    mergeRefused(
      refused,
      load.refused.filter((r) => r.metricId !== 'scenario_offered_traffic'),
    );

    const retries = analyzeRetriesOnEdges({
      document,
      edgeIds: callingEdges,
      edgeLogicalLoadRps: load.edgeContribRps,
      reason: 'unavailable',
    });
    metrics.push(...retries.metrics);
    mergeRefused(refused, retries.refused);
    assumptions.push(...retries.assumptions);

    // Standing refusals (always present) do not force PARTIAL by themselves.
    const standing = new Set([
      'availability_percent',
      'throughput',
      'latency_p95_p99',
      'expected_attempts',
      'observed_attempts',
      'end_to_end_latency',
    ]);
    const materialRefusals = refused.filter((r) => !standing.has(r.metricId));
    const finalStatus =
      materialRefusals.length > 0 ? 'PARTIALLY_ANSWERED' : 'ANSWERED';

    return sortResult({
      scenario,
      status: finalStatus,
      metrics: sortMetrics(metrics),
      refused,
      impacts: analysis.impacts,
      saturations: [],
      assumptions,
      warnings,
      propagationPaths: analysis.propagationPaths,
    });
  }

  if (scenario.type === 'latency_degradation') {
    const analysis = analyzeLatencyDegradation(
      document,
      scenario.componentId,
      scenario.latencyMs,
    );
    metrics.push(...analysis.metrics);
    mergeRefused(refused, analysis.refused);
    assumptions.push(...analysis.assumptions);
    warnings.push(...analysis.warnings);

    if (!analysis.primarySatisfied) {
      return sortResult({
        scenario,
        status: 'NOT_ANSWERABLE',
        metrics: sortMetrics(metrics),
        refused,
        impacts: [],
        saturations: [],
        assumptions,
        warnings,
        propagationPaths: [],
      });
    }

    const load = accumulateLoad(document, 1);
    assumptions.push(...load.assumptions);
    const retries = analyzeRetriesOnEdges({
      document,
      edgeIds: analysis.timedOutEdgeIds,
      edgeLogicalLoadRps: load.edgeContribRps,
      reason: 'timeout',
    });
    metrics.push(...retries.metrics);
    mergeRefused(refused, retries.refused);
    // load refusals are secondary
    mergeRefused(
      refused,
      load.refused.filter((r) => r.reasonCode !== 'MISSING_BASELINE_TRAFFIC'),
    );
    assumptions.push(...retries.assumptions);

    const standing = new Set([
      'availability_percent',
      'throughput',
      'latency_p95_p99',
      'expected_attempts',
      'observed_attempts',
      'end_to_end_latency',
    ]);
    const materialRefusals = refused.filter((r) => !standing.has(r.metricId));

    return sortResult({
      scenario,
      status:
        materialRefusals.length > 0 ? 'PARTIALLY_ANSWERED' : 'ANSWERED',
      metrics: sortMetrics(metrics),
      refused,
      impacts: [],
      saturations: [],
      assumptions,
      warnings,
      propagationPaths: [],
    });
  }

  // load_multiplication
  const load = accumulateLoad(document, scenario.multiplier);
  metrics.push(...load.metrics);
  mergeRefused(refused, load.refused);
  assumptions.push(...load.assumptions);
  warnings.push(...load.warnings);

  const primaryOk = load.metrics.some(
    (m) => m.metricId === 'scenario_offered_traffic',
  );

  if (!primaryOk) {
    return sortResult({
      scenario,
      status: 'NOT_ANSWERABLE',
      metrics: sortMetrics(metrics),
      refused,
      impacts: [],
      saturations: [],
      assumptions,
      warnings,
      propagationPaths: [],
    });
  }

  const standing = new Set([
    'availability_percent',
    'throughput',
    'latency_p95_p99',
    'expected_attempts',
    'observed_attempts',
    'end_to_end_latency',
  ]);
  const materialRefusals = refused.filter((r) => !standing.has(r.metricId));

  return sortResult({
    scenario,
    status: materialRefusals.length > 0 ? 'PARTIALLY_ANSWERED' : 'ANSWERED',
    metrics: sortMetrics(metrics),
    refused,
    impacts: [],
    saturations: load.saturations,
    assumptions,
    warnings,
    propagationPaths: [],
  });
}

export type { Scenario, SimulationResult };
