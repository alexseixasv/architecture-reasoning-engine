import type { ArchitectureDocument } from '../../architecture/domain/types';
import { architectureDocumentSchema } from '../../architecture/domain/schema';
import { simulate } from '../../simulation/simulate';
import {
  compareGoldenResult,
  type GoldenExpected,
} from '../compare-golden';
import {
  loadValidationCaseFiles,
  VALIDATION_CASE_IDS,
} from '../fixture-loader';
import type { EvaluationCaseResult } from '../types';

export function listValidationCaseIds(): string[] {
  return [...VALIDATION_CASE_IDS];
}

/**
 * V01–V09, V12 (execution=simulate):
 *   Formal model + expected_scenario → simulate → compare expected_simulation.
 *   This is formal-scenario simulation correctness — NOT NL scenario classification.
 *
 * V10–V11 (execution=schema_only):
 *   Formal model parses as ArchitectureDocument schemaVersion 1.0.0;
 *   expected_scenario/simulation are null; unsupportedNlOutcome is documented.
 *   This is schema validation only — NOT successful NL scenario classification,
 *   and NOT a claim that availability%/E2E latency were answered.
 */
export function runValidationCase(caseId: string): EvaluationCaseResult {
  const executedAt = new Date().toISOString();
  const started = performance.now();

  try {
    const files = loadValidationCaseFiles(caseId);
    const { meta } = files;

    if (meta.execution === 'schema_only') {
      return runSchemaOnly(caseId, files, executedAt, started);
    }
    return runFormalSimulate(caseId, files, executedAt, started);
  } catch (err) {
    const durationMs = Math.round((performance.now() - started) * 1000) / 1000;
    const message = err instanceof Error ? err.message : String(err);
    return {
      caseId,
      suiteId: 'validation_formal',
      checkKind: 'formal_scenario_validation',
      description: caseId,
      verifies: 'Validation fixture execution (see adapter docs)',
      executedAt,
      status: 'failed',
      durationMs,
      expectedOutcome: null,
      actualOutcome: null,
      mismatches: [
        {
          path: 'execution',
          expected: 'completed',
          actual: message,
          message,
        },
      ],
      evidence: { notes: ['adapter threw before comparison'] },
      failureReason: message,
      input: null,
    };
  }
}

function runSchemaOnly(
  caseId: string,
  files: ReturnType<typeof loadValidationCaseFiles>,
  executedAt: string,
  started: number,
): EvaluationCaseResult {
  const verifies =
    'Schema validation only: formal_model parses as ArchitectureDocument; expected_scenario and expected_simulation are null; unsupportedNlOutcome is non-empty. Does NOT execute simulate for an invented NL scenario. Does NOT claim NL scenario classification success.';

  const parsed = architectureDocumentSchema.safeParse(files.formalModel);
  const schemaValid = parsed.success && parsed.data.schemaVersion === '1.0.0';
  const scenarioNull = files.expectedScenario === null;
  const simulationNull = files.expectedSimulation === null;
  const hasUnsupported =
    (files.meta.unsupportedNlOutcome?.length ?? 0) > 0;

  const mismatches = [];
  if (!schemaValid) {
    mismatches.push({
      path: 'formal_model.schema',
      expected: 'valid ArchitectureDocument 1.0.0',
      actual: parsed.success ? parsed.data.schemaVersion : parsed.error.issues,
      message: 'formal model failed schema validation',
    });
  }
  if (!scenarioNull) {
    mismatches.push({
      path: 'expected_scenario',
      expected: null,
      actual: files.expectedScenario,
      message: 'schema_only cases must have null expected_scenario',
    });
  }
  if (!simulationNull) {
    mismatches.push({
      path: 'expected_simulation',
      expected: null,
      actual: files.expectedSimulation,
      message: 'schema_only cases must have null expected_simulation',
    });
  }
  if (!hasUnsupported) {
    mismatches.push({
      path: 'meta.unsupportedNlOutcome',
      expected: 'non-empty documentation',
      actual: files.meta.unsupportedNlOutcome ?? null,
      message: 'schema_only cases require unsupportedNlOutcome documentation',
    });
  }

  const ok = mismatches.length === 0;
  const durationMs = Math.round((performance.now() - started) * 1000) / 1000;

  return {
    caseId,
    suiteId: 'validation_formal',
    checkKind: 'schema_validation',
    description: `${caseId} schema_only (unsupported NL documented; not NL classification)`,
    verifies,
    executedAt,
    status: ok ? 'passed' : 'failed',
    durationMs,
    expectedOutcome: {
      execution: 'schema_only',
      schemaValid: true,
      expectedScenario: null,
      expectedSimulation: null,
      hasUnsupportedNlOutcome: true,
    },
    actualOutcome: {
      execution: 'schema_only',
      schemaValid,
      expectedScenario: files.expectedScenario,
      expectedSimulation: files.expectedSimulation,
      hasUnsupportedNlOutcome: hasUnsupported,
      unsupportedNlOutcome: files.meta.unsupportedNlOutcome ?? null,
      note: 'NL scenario classification was not executed',
    },
    mismatches,
    evidence: {
      notes: [
        'V10/V11: schema_only — no simulate, no LLM NL classification',
        files.meta.unsupportedNlOutcome ?? '',
      ].filter(Boolean),
    },
    failureReason: ok
      ? null
      : mismatches.map((m) => m.message).join('; '),
    input: {
      formalModel: files.formalModel,
      meta: files.meta,
    },
  };
}

function runFormalSimulate(
  caseId: string,
  files: ReturnType<typeof loadValidationCaseFiles>,
  executedAt: string,
  started: number,
): EvaluationCaseResult {
  const verifies =
    'Formal scenario validation: simulate(formal_model, expected_scenario) matches expected_simulation.json. Uses hand formal architecture + structured scenario — NOT extracted NL architecture/scenario. No LLM.';

  if (
    files.expectedScenario === null ||
    files.expectedSimulation === null
  ) {
    throw new Error(
      `${caseId}: simulate execution requires non-null expected_scenario and expected_simulation`,
    );
  }

  const expected = files.expectedSimulation as GoldenExpected;
  const parsed = architectureDocumentSchema.parse(files.formalModel);
  const before = JSON.stringify(parsed);
  const once = simulate(
    parsed as ArchitectureDocument,
    files.expectedScenario,
  );
  const twice = simulate(
    parsed as ArchitectureDocument,
    files.expectedScenario,
  );
  const determinismOk =
    JSON.stringify(once) === JSON.stringify(twice) &&
    JSON.stringify(parsed) === before;
  const scenarioEchoOk =
    JSON.stringify(once.scenario) === JSON.stringify(files.expectedScenario);
  const comparison = compareGoldenResult(once, expected);

  const mismatches = [...comparison.mismatches];
  if (!determinismOk) {
    mismatches.push({
      path: 'determinism',
      expected: true,
      actual: false,
      message: 'simulate repeat inequality or architecture mutation',
    });
  }
  if (!scenarioEchoOk) {
    mismatches.push({
      path: 'scenario',
      expected: files.expectedScenario,
      actual: once.scenario,
      message: 'result.scenario does not equal expected_scenario',
    });
  }

  const ok = mismatches.length === 0;
  const durationMs = Math.round((performance.now() - started) * 1000) / 1000;

  return {
    caseId,
    suiteId: 'validation_formal',
    checkKind: 'formal_scenario_validation',
    description: `${caseId} formal simulate (${files.meta.tags.join(', ')})`,
    verifies,
    executedAt,
    status: ok ? 'passed' : 'failed',
    durationMs,
    expectedOutcome: {
      execution: 'simulate',
      status: expected.status,
      metrics: expected.metrics,
      requiredRefusedReasonCodes: expected.requiredRefusedReasonCodes,
      scenario: files.expectedScenario,
    },
    actualOutcome: {
      execution: 'simulate',
      status: once.status,
      metrics: once.metrics.map((m) => ({
        metricId: m.metricId,
        value: m.value,
        unit: m.unit,
        formulaId: m.formulaId,
      })),
      refused: once.refused,
      scenario: once.scenario,
    },
    mismatches,
    evidence: {
      determinismOk,
      metricEvidence: comparison.metricEvidence,
      refusedReasonCodes: comparison.refusedReasonCodes,
      formulaIds: [
        ...new Set(once.metrics.map((m) => m.formulaId)),
      ].sort(),
      notes: [
        'Formal context only — NL extraction accuracy is historical LLM evidence',
      ],
    },
    failureReason: ok
      ? null
      : mismatches.map((m) => m.message).join('; '),
    input: {
      formalModel: files.formalModel,
      expectedScenario: files.expectedScenario,
      meta: files.meta,
    },
  };
}
