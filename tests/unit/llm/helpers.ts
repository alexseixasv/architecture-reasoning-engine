import type { ArchitectureExtractionDto } from '../../../src/llm/dto/architecture-extraction.dto';
import type { ExplanationDto } from '../../../src/llm/dto/explanation.dto';
import type { ScenarioExtractionDto } from '../../../src/llm/dto/scenario-extraction.dto';
import { SCENARIO_MISSING_NUMERIC } from '../../../src/llm/dto/scenario-missing';

export function omitted() {
  return { presence: 'omitted' as const };
}

export function declared(
  value: number,
  unit: 'rps' | 'ms' | 'count' | 'percent' | 'ratio',
  sourceExcerpt: string,
) {
  return {
    presence: 'declared' as const,
    value,
    unit,
    sourceExcerpt,
  };
}

export function baseArchitectureDto(
  overrides: Partial<ArchitectureExtractionDto> = {},
): ArchitectureExtractionDto {
  return {
    name: 'demo',
    description: '',
    nodes: [
      {
        id: 'api',
        kind: 'service',
        name: 'API',
        replicas: declared(4, 'count', '4 replicas'),
        capacityPerReplica: declared(80, 'rps', '80 requests per second'),
        capacityAggregation: 'sum_replicas',
        declaredLatency: omitted(),
        fieldConflicts: [],
      },
    ],
    dependencies: [],
    incomingTraffic: declared(80, 'rps', '80 rps'),
    availabilityTarget: omitted(),
    ingressNodeIds: ['api'],
    ingressDeclared: true,
    documentConflicts: [],
    clarificationQuestions: [],
    notes: [],
    ...overrides,
  };
}

export function loadScenarioDto(
  overrides: Partial<ScenarioExtractionDto> = {},
): ScenarioExtractionDto {
  return {
    outcome: 'load_multiplication',
    componentId: '',
    latencyMs: SCENARIO_MISSING_NUMERIC,
    multiplier: 2,
    reason: '',
    clarificationQuestions: [],
    ...overrides,
  };
}

export function explanationDto(
  overrides: Partial<ExplanationDto> = {},
): ExplanationDto {
  return {
    summary: 'Engine answered the load question.',
    statements: [
      {
        text: 'API utilization is reported by the engine metric.',
        metricIds: ['utilization:api'],
        refusedMetricIds: [],
        componentIds: ['api'],
        refusalCodes: [],
        claimKind: 'saturation_classification',
      },
    ],
    acknowledgedStatus: 'ANSWERED',
    ...overrides,
  };
}

export const SAMPLE_ARCH_TEXT = [
  'The API service runs 4 replicas, each handling 80 requests per second.',
  'Capacity is the sum across replicas. Baseline ingress traffic is 80 rps into the API.',
].join(' ');
