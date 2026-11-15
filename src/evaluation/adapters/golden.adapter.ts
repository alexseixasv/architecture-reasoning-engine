import type { ArchitectureDocument } from '../../architecture/domain/types';
import { architectureDocumentSchema } from '../../architecture/domain/schema';
import { simulate } from '../../simulation/simulate';
import {
  compareGoldenResult,
  type GoldenExpected,
} from '../compare-golden';
import { GOLDEN_CASE_IDS, loadGoldenCaseFiles } from '../fixture-loader';
import type { EvaluationCaseResult } from '../types';

const DESCRIPTIONS: Readonly<Record<string, string>> = {
  G01: 'capacity sum_replicas',
  G02: 'capacity primary_only',
  G03: 'load multiplication normal',
  G04: 'load multiplication saturated',
  G05: 'shared downstream multi-path',
  G06: 'failure exposure + retry bound',
  G07: 'timeout + retry',
  G08: 'missing baseline traffic',
  G09: 'incomplete inbound',
  G10: 'timeout equality L=T',
  G11: 'fixed backoff restrictions',
  G12: 'conflicting capacity fields',
};

export function listGoldenCaseIds(): string[] {
  return [...GOLDEN_CASE_IDS];
}

/**
 * Verifies: formal architecture + typed scenario → simulate() matches hand-derived
 * expected.json (status, metrics, formulaIds, evidence, saturations, refusals).
 * Also asserts determinism (repeat equality) and architecture immutability.
 * Does not invoke LLM.
 */
export function runGoldenCase(caseId: string): EvaluationCaseResult {
  const executedAt = new Date().toISOString();
  const started = performance.now();
  const verifies =
    'Simulation correctness: simulate(architecture, scenario) matches golden expected.json (metrics, formulaIds, substitutions, refusals, saturations). Determinism and architecture immutability asserted. No LLM.';

  try {
    const files = loadGoldenCaseFiles(caseId);
    const expected = files.expected as GoldenExpected;
    const parsed = architectureDocumentSchema.parse(files.architecture);
    const before = JSON.stringify(parsed);
    const once = simulate(parsed as ArchitectureDocument, files.scenario);
    const twice = simulate(parsed as ArchitectureDocument, files.scenario);
    const determinismOk =
      JSON.stringify(once) === JSON.stringify(twice) &&
      JSON.stringify(parsed) === before;
    const comparison = compareGoldenResult(once, expected);
    const ok = comparison.ok && determinismOk;
    const durationMs = Math.round((performance.now() - started) * 1000) / 1000;

    const mismatches = [...comparison.mismatches];
    if (!determinismOk) {
      mismatches.push({
        path: 'determinism',
        expected: true,
        actual: false,
        message: 'simulate repeat inequality or architecture mutation',
      });
    }

    return {
      caseId,
      suiteId: 'golden',
      checkKind: 'simulation_correctness',
      description: DESCRIPTIONS[caseId] ?? caseId,
      verifies,
      executedAt,
      status: ok ? 'passed' : 'failed',
      durationMs,
      expectedOutcome: {
        status: expected.status,
        metrics: expected.metrics,
        requiredRefusedReasonCodes: expected.requiredRefusedReasonCodes,
        saturations: expected.saturations,
      },
      actualOutcome: {
        status: once.status,
        metrics: once.metrics.map((m) => ({
          metricId: m.metricId,
          value: m.value,
          unit: m.unit,
          formulaId: m.formulaId,
        })),
        refused: once.refused,
        saturations: once.saturations,
      },
      mismatches,
      evidence: {
        determinismOk,
        metricEvidence: comparison.metricEvidence,
        refusedReasonCodes: comparison.refusedReasonCodes,
        formulaIds: [
          ...new Set(once.metrics.map((m) => m.formulaId)),
        ].sort(),
      },
      failureReason: ok
        ? null
        : mismatches.map((m) => m.message).join('; ') || 'comparison failed',
      input: {
        architecture: files.architecture,
        scenario: files.scenario,
      },
    };
  } catch (err) {
    const durationMs = Math.round((performance.now() - started) * 1000) / 1000;
    const message = err instanceof Error ? err.message : String(err);
    return {
      caseId,
      suiteId: 'golden',
      checkKind: 'simulation_correctness',
      description: DESCRIPTIONS[caseId] ?? caseId,
      verifies,
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
