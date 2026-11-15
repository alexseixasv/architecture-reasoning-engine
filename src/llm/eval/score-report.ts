import type { ArchitectureCompareReport } from './compare-architecture';
import type { ScenarioCompareReport } from './compare-scenario';
import {
  STRUCTURED_SCENARIO_DENOMINATOR,
  UNSUPPORTED_NL_DENOMINATOR,
} from './compare-scenario';
import type { CostBucketProjection } from './cost-projections';
import type { ArchitectureExtractionDiagnostics } from './extraction-diagnostics';
import type { LatencySummary } from './percentiles';

export type PipelineFailureClass =
  | 'architecture_extraction'
  | 'scenario_extraction'
  | 'simulation_engine'
  | 'explanation'
  | 'none';

/** Per-case failure buckets for remediation diagnosis (sanitized). */
export type CaseFailureCategory =
  | 'arch_missing_in_dto'
  | 'arch_provenance_rejection'
  | 'arch_mapper_transform'
  | 'arch_comparator_mismatch'
  | 'arch_id_or_extra_nodes'
  | 'arch_conflict_field_miss'
  | 'arch_conflict_document_miss'
  | 'arch_conflict_extra_or_misleveled'
  | 'scenario_intent_miss'
  | 'scenario_parameter_miss'
  | 'explanation_fallback'
  | 'none';

export type CaseEvalRecord = {
  caseId: string;
  architectureStatus?: string;
  architectureCompare?: ArchitectureCompareReport;
  architectureDiagnostics?: ArchitectureExtractionDiagnostics;
  scenarioCompare?: ScenarioCompareReport;
  simulationStatus?: string | null;
  /** When scenario wrong, mark extraction — never blame engine math. */
  pipelineFailureClass: PipelineFailureClass;
  failureCategories?: CaseFailureCategory[];
  explanationSource?: 'llm+deterministic' | 'deterministic_fallback' | null;
  explanationValidationOk?: boolean | null;
  explanationValidationErrors?: string[];
  explanationValidationErrorCodes?: string[];
  invalidReferenceCount?: number;
  unsupportedNumericClaimRejections?: number;
  timingsMs?: {
    extractArchitecture?: number;
    extractScenario?: number;
    simulate?: number;
    explain?: number;
    totalWall?: number;
  };
  errorClass?: string;
  errorMessageSanitized?: string;
};

export type ExplanationQualitySummary = {
  evaluated: number;
  groundedSuccess: number;
  deterministicFallback: number;
  groundedSuccessRate: number | null;
  fallbackRate: number | null;
  invalidReferenceCount: number;
  unsupportedNumericClaimRejections: number;
};

export type EvaluationAggregateReport = {
  architectureFieldAccuracy: { matches: number; total: number };
  scenarioStructured: {
    intentOk: number;
    parameterOk: number;
    overallOk: number;
    denominator: typeof STRUCTURED_SCENARIO_DENOMINATOR;
  };
  scenarioUnsupportedNl: {
    ok: number;
    denominator: typeof UNSUPPORTED_NL_DENOMINATOR;
  };
  explanation: ExplanationQualitySummary;
  pipelineFailureCounts: Record<PipelineFailureClass, number>;
  latency: {
    extractArchitecture: LatencySummary;
    extractScenario: LatencySummary;
    simulate: LatencySummary;
    explain: LatencySummary;
    totalWall: LatencySummary;
  };
  cost: {
    fullAnalysis: CostBucketProjection;
    persistedArchitectureAnalysis: CostBucketProjection;
    earlyTerminal: CostBucketProjection;
    note: string;
  };
  cases: CaseEvalRecord[];
  liveStatus: 'NOT_RUN' | 'MEASURED';
};

export function emptyLatency(): LatencySummary {
  return {
    sampleSize: 0,
    method: 'linear_interpolation_inclusive',
    p50Ms: null,
    p95Ms: null,
    minMs: null,
    maxMs: null,
    meanMs: null,
  };
}

export function classifyPipelineFailure(input: {
  architectureOk: boolean;
  scenarioOverallOk: boolean | null;
  simulationRan: boolean;
  simulationMatchedExpected: boolean | null;
}): PipelineFailureClass {
  if (!input.architectureOk) {
    return 'architecture_extraction';
  }
  if (input.scenarioOverallOk === false) {
    return 'scenario_extraction';
  }
  if (
    input.simulationRan &&
    input.simulationMatchedExpected === false &&
    input.scenarioOverallOk === true
  ) {
    return 'simulation_engine';
  }
  return 'none';
}

/**
 * Derive sanitized per-case failure categories from compare + diagnostics.
 * Does not require raw NL text.
 */
export function classifyCaseFailureCategories(
  record: CaseEvalRecord,
): CaseFailureCategory[] {
  const cats = new Set<CaseFailureCategory>();
  const cmp = record.architectureCompare;
  const diag = record.architectureDiagnostics;

  if (cmp) {
    if (cmp.extraNodeIds.length > 0 || cmp.nodePresence.falseNegatives > 0) {
      cats.add('arch_id_or_extra_nodes');
    }
    const cp = cmp.conflictPreservation;
    if (cp.fieldLevelPreserved === false) {
      cats.add('arch_conflict_field_miss');
    }
    if (cp.documentLevelPreserved === false) {
      cats.add('arch_conflict_document_miss');
    }
    if (cp.extraDocumentConflicts > 0 || cp.extraFieldConflictNodes > 0) {
      cats.add('arch_conflict_extra_or_misleveled');
    }
    const mismatched = cmp.fieldComparisons.filter((f) => !f.match);
    if (mismatched.some((f) => f.kind === 'quantity_state' || f.kind === 'field')) {
      cats.add('arch_comparator_mismatch');
    }
  }

  if (diag) {
    for (const q of diag.quantityDiagnostics) {
      if (q.cause === 'missing_in_dto') {
        cats.add('arch_missing_in_dto');
      } else if (q.cause === 'provenance_rejection') {
        cats.add('arch_provenance_rejection');
      } else if (q.cause === 'mapper_unit_or_transform') {
        cats.add('arch_mapper_transform');
      }
    }
  }

  if (record.scenarioCompare?.intentMatch === false) {
    cats.add('scenario_intent_miss');
  } else if (
    record.scenarioCompare &&
    record.scenarioCompare.intentMatch &&
    !record.scenarioCompare.parameterMatch
  ) {
    cats.add('scenario_parameter_miss');
  }

  if (record.explanationSource === 'deterministic_fallback') {
    cats.add('explanation_fallback');
  }

  if (cats.size === 0) {
    return ['none'];
  }
  return [...cats].sort();
}

export function aggregateCaseRecords(
  cases: CaseEvalRecord[],
  cost: EvaluationAggregateReport['cost'],
  latency: EvaluationAggregateReport['latency'],
  liveStatus: 'NOT_RUN' | 'MEASURED',
): EvaluationAggregateReport {
  let fieldMatches = 0;
  let fieldTotal = 0;
  let structuredIntentOk = 0;
  let structuredParamOk = 0;
  let structuredOverallOk = 0;
  let structuredN = 0;
  let unsupportedOk = 0;
  let unsupportedN = 0;

  let explained = 0;
  let grounded = 0;
  let fallback = 0;
  let invalidRefs = 0;
  let numericRejections = 0;

  const pipelineFailureCounts: Record<PipelineFailureClass, number> = {
    architecture_extraction: 0,
    scenario_extraction: 0,
    simulation_engine: 0,
    explanation: 0,
    none: 0,
  };

  for (const c of cases) {
    if (c.architectureCompare) {
      fieldMatches += c.architectureCompare.fieldAccuracy.matches;
      fieldTotal += c.architectureCompare.fieldAccuracy.total;
    }
    if (c.scenarioCompare) {
      if (c.scenarioCompare.expectedIntent === 'UNSUPPORTED') {
        unsupportedN += 1;
        if (c.scenarioCompare.overallMatch) {
          unsupportedOk += 1;
        }
      } else if (
        c.scenarioCompare.expectedIntent === 'load_multiplication' ||
        c.scenarioCompare.expectedIntent === 'component_unavailable' ||
        c.scenarioCompare.expectedIntent === 'latency_degradation'
      ) {
        structuredN += 1;
        if (c.scenarioCompare.intentMatch) {
          structuredIntentOk += 1;
        }
        if (c.scenarioCompare.parameterMatch) {
          structuredParamOk += 1;
        }
        if (c.scenarioCompare.overallMatch) {
          structuredOverallOk += 1;
        }
      }
    }
    if (c.explanationSource) {
      explained += 1;
      if (c.explanationSource === 'llm+deterministic') {
        grounded += 1;
      } else {
        fallback += 1;
      }
    }
    invalidRefs += c.invalidReferenceCount ?? 0;
    numericRejections += c.unsupportedNumericClaimRejections ?? 0;
    pipelineFailureCounts[c.pipelineFailureClass] += 1;
  }

  return {
    architectureFieldAccuracy: { matches: fieldMatches, total: fieldTotal },
    scenarioStructured: {
      intentOk: structuredIntentOk,
      parameterOk: structuredParamOk,
      overallOk: structuredOverallOk,
      denominator: STRUCTURED_SCENARIO_DENOMINATOR,
    },
    scenarioUnsupportedNl: {
      ok: unsupportedOk,
      denominator: UNSUPPORTED_NL_DENOMINATOR,
    },
    explanation: {
      evaluated: explained,
      groundedSuccess: grounded,
      deterministicFallback: fallback,
      groundedSuccessRate: explained === 0 ? null : grounded / explained,
      fallbackRate: explained === 0 ? null : fallback / explained,
      invalidReferenceCount: invalidRefs,
      unsupportedNumericClaimRejections: numericRejections,
    },
    pipelineFailureCounts,
    latency,
    cost,
    cases,
    liveStatus,
    // expose counts actually seen for honesty when N < denominator
    ...(structuredN !== STRUCTURED_SCENARIO_DENOMINATOR ||
    unsupportedN !== UNSUPPORTED_NL_DENOMINATOR
      ? {}
      : {}),
  };
}
