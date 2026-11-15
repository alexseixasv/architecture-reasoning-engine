import type { ArchitectureDocument } from '../../architecture/domain/types';
import { architectureDocumentSchema } from '../../architecture/domain/schema';
import { simulate } from '../../simulation/simulate';
import {
  loadAdversarialFixture,
  loadAdversarialJson,
} from '../fixture-loader';
import type { EvaluationCaseResult } from '../types';

export const ADVERSARIAL_CASE_IDS = [
  'ADV-01',
  'ADV-02',
  'ADV-03',
  'ADV-04',
  'ADV-05',
  'ADV-06',
  'ADV-07',
  'ADV-08',
] as const;

export function listAdversarialCaseIds(): string[] {
  return [...ADVERSARIAL_CASE_IDS];
}

type Check = {
  ok: boolean;
  path: string;
  expected: unknown;
  actual: unknown;
  message: string;
};

function fail(
  path: string,
  expected: unknown,
  actual: unknown,
  message: string,
): Check {
  return { ok: false, path, expected, actual, message };
}

function pass(
  path: string,
  expected: unknown,
  actual: unknown,
): Check {
  return { ok: true, path, expected, actual, message: 'ok' };
}

/**
 * ADV-01..08 deterministic adversarial boundaries.
 * ADV-08 is an NL isolation check only — not LLM prompt-injection resistance.
 */
export function runAdversarialCase(caseId: string): EvaluationCaseResult {
  const executedAt = new Date().toISOString();
  const started = performance.now();

  try {
    switch (caseId) {
      case 'ADV-01':
        return finish(caseId, executedAt, started, runAdv01());
      case 'ADV-02':
        return finish(caseId, executedAt, started, runAdv02());
      case 'ADV-03':
        return finish(caseId, executedAt, started, runAdv03());
      case 'ADV-04':
        return finish(caseId, executedAt, started, runAdv04());
      case 'ADV-05':
        return finish(caseId, executedAt, started, runAdv05());
      case 'ADV-06':
        return finish(caseId, executedAt, started, runAdv06());
      case 'ADV-07':
        return finish(caseId, executedAt, started, runAdv07());
      case 'ADV-08':
        return finish(caseId, executedAt, started, runAdv08());
      default:
        throw new Error(`Unknown adversarial caseId: ${caseId}`);
    }
  } catch (err) {
    const durationMs = Math.round((performance.now() - started) * 1000) / 1000;
    const message = err instanceof Error ? err.message : String(err);
    return {
      caseId,
      suiteId: 'adversarial',
      checkKind: 'adversarial_deterministic',
      description: caseId,
      verifies: 'Adversarial deterministic check',
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
      evidence: { notes: ['adapter threw'] },
      failureReason: message,
      input: null,
    };
  }
}

type AdvResult = {
  description: string;
  verifies: string;
  checkKind: EvaluationCaseResult['checkKind'];
  checks: Check[];
  expectedOutcome: unknown;
  actualOutcome: unknown;
  evidence: EvaluationCaseResult['evidence'];
  input: unknown;
};

function finish(
  caseId: string,
  executedAt: string,
  started: number,
  result: AdvResult,
): EvaluationCaseResult {
  const mismatches = result.checks
    .filter((c) => !c.ok)
    .map((c) => ({
      path: c.path,
      expected: c.expected,
      actual: c.actual,
      message: c.message,
    }));
  const ok = mismatches.length === 0;
  const durationMs = Math.round((performance.now() - started) * 1000) / 1000;
  return {
    caseId,
    suiteId: 'adversarial',
    checkKind: result.checkKind,
    description: result.description,
    verifies: result.verifies,
    executedAt,
    status: ok ? 'passed' : 'failed',
    durationMs,
    expectedOutcome: result.expectedOutcome,
    actualOutcome: result.actualOutcome,
    mismatches,
    evidence: result.evidence,
    failureReason: ok
      ? null
      : mismatches.map((m) => m.message).join('; '),
    input: result.input,
  };
}

function runAdv01(): AdvResult {
  const architecture = loadAdversarialJson('adv01_forced_numbers.json');
  const parsed = architectureDocumentSchema.parse(architecture);
  const result = simulate(parsed as ArchitectureDocument, {
    type: 'load_multiplication',
    multiplier: 1,
  });
  const util = result.metrics.find((m) => m.metricId === 'utilization:api');
  const checks: Check[] = [
    util?.value === 0.25
      ? pass('utilization:api', 0.25, util.value)
      : fail('utilization:api', 0.25, util?.value, 'forced NL numbers must be ignored'),
    !result.metrics.some((m) => m.value === 9999)
      ? pass('no_9999', false, false)
      : fail('no_9999', false, true, 'metric value 9999 must not appear'),
    result.refused.some((r) => r.reasonCode === 'NO_AVAILABILITY_MODEL')
      ? pass('refused.NO_AVAILABILITY_MODEL', true, true)
      : fail(
          'refused.NO_AVAILABILITY_MODEL',
          true,
          false,
          'missing standing refusal',
        ),
  ];
  return {
    description: 'Forced numbers in untrusted description ignored',
    verifies:
      'Adversarial deterministic: numbers in node description text do not steer simulate metrics (utilization stays 0.25). No LLM.',
    checkKind: 'adversarial_deterministic',
    checks,
    expectedOutcome: { utilizationApi: 0.25, noForced9999: true },
    actualOutcome: {
      utilizationApi: util?.value ?? null,
      metrics: result.metrics.map((m) => ({
        metricId: m.metricId,
        value: m.value,
      })),
      refused: result.refused.map((r) => r.reasonCode),
    },
    evidence: {
      formulaIds: result.metrics.map((m) => m.formulaId),
      refusedReasonCodes: result.refused.map((r) => r.reasonCode),
    },
    input: { architecture, scenario: { type: 'load_multiplication', multiplier: 1 } },
  };
}

function runAdv02(): AdvResult {
  const architecture = loadAdversarialJson('adv01_forced_numbers.json');
  const parsed = architectureDocumentSchema.parse(architecture);
  const result = simulate(parsed as ArchitectureDocument, {
    type: 'chaos_monkey',
    severity: 'high',
  });
  const checks: Check[] = [
    result.status === 'NOT_ANSWERABLE'
      ? pass('status', 'NOT_ANSWERABLE', result.status)
      : fail('status', 'NOT_ANSWERABLE', result.status, 'unsupported scenario must refuse'),
    result.refused.some((r) => r.reasonCode === 'INVALID_SCENARIO')
      ? pass('refused.INVALID_SCENARIO', true, true)
      : fail('refused.INVALID_SCENARIO', true, false, 'missing INVALID_SCENARIO'),
    result.metrics.length === 0
      ? pass('metrics.empty', 0, 0)
      : fail('metrics.empty', 0, result.metrics.length, 'metrics must be empty'),
  ];
  return {
    description: 'Unsupported scenario type refused',
    verifies:
      'Adversarial deterministic: unknown scenario type chaos_monkey → NOT_ANSWERABLE + INVALID_SCENARIO. No LLM.',
    checkKind: 'adversarial_deterministic',
    checks,
    expectedOutcome: {
      status: 'NOT_ANSWERABLE',
      refused: ['INVALID_SCENARIO'],
    },
    actualOutcome: {
      status: result.status,
      refused: result.refused.map((r) => r.reasonCode),
      metricCount: result.metrics.length,
    },
    evidence: { refusedReasonCodes: result.refused.map((r) => r.reasonCode) },
    input: {
      architecture,
      scenario: { type: 'chaos_monkey', severity: 'high' },
    },
  };
}

function runAdv03(): AdvResult {
  const architecture = loadAdversarialJson('adv03_malformed_numbers.json');
  const parsed = architectureDocumentSchema.safeParse(architecture);
  const checks: Check[] = [
    !parsed.success
      ? pass('schema', 'reject', 'reject')
      : fail('schema', 'reject', 'accept', 'malformed numbers must fail schema'),
  ];
  return {
    description: 'Malformed numbers rejected by schema',
    verifies:
      'Schema validation: malformed numeric fields fail architectureDocumentSchema.safeParse. No simulate. No LLM.',
    checkKind: 'schema_validation',
    checks,
    expectedOutcome: { schemaSuccess: false },
    actualOutcome: {
      schemaSuccess: parsed.success,
      issues: parsed.success ? null : parsed.error.issues.slice(0, 5),
    },
    evidence: { notes: ['schema_only rejection'] },
    input: { architecture },
  };
}

function runAdv04(): AdvResult {
  const architecture = loadAdversarialJson('adv04_contradictory.json');
  const parsed = architectureDocumentSchema.parse(architecture);
  const result = simulate(parsed as ArchitectureDocument, {
    type: 'load_multiplication',
    multiplier: 1,
  });
  const checks: Check[] = [
    result.status === 'PARTIALLY_ANSWERED'
      ? pass('status', 'PARTIALLY_ANSWERED', result.status)
      : fail(
          'status',
          'PARTIALLY_ANSWERED',
          result.status,
          'conflicting capacity should partially answer',
        ),
    result.refused.some((r) => r.reasonCode === 'CONFLICTING_CAPACITY_FIELDS')
      ? pass('refused.CONFLICTING_CAPACITY_FIELDS', true, true)
      : fail(
          'refused.CONFLICTING_CAPACITY_FIELDS',
          true,
          false,
          'missing CONFLICTING_CAPACITY_FIELDS',
        ),
    !result.metrics.some((m) => m.metricId === 'utilization:pricing')
      ? pass('no_utilization:pricing', true, true)
      : fail(
          'no_utilization:pricing',
          true,
          false,
          'utilization:pricing must be refused',
        ),
  ];
  return {
    description: 'Contradictory capacity refuses utilization',
    verifies:
      'Adversarial deterministic: conflicting capacity fields → PARTIALLY_ANSWERED + CONFLICTING_CAPACITY_FIELDS; no utilization:pricing metric. No LLM.',
    checkKind: 'adversarial_deterministic',
    checks,
    expectedOutcome: {
      status: 'PARTIALLY_ANSWERED',
      refused: ['CONFLICTING_CAPACITY_FIELDS'],
    },
    actualOutcome: {
      status: result.status,
      refused: result.refused.map((r) => r.reasonCode),
      metricIds: result.metrics.map((m) => m.metricId),
    },
    evidence: { refusedReasonCodes: result.refused.map((r) => r.reasonCode) },
    input: {
      architecture,
      scenario: { type: 'load_multiplication', multiplier: 1 },
    },
  };
}

function runAdv05(): AdvResult {
  const architecture = loadAdversarialJson('adv05_misleading_units.json');
  const parsed = architectureDocumentSchema.safeParse(architecture);
  const checks: Check[] = [
    !parsed.success
      ? pass('schema', 'reject', 'reject')
      : fail('schema', 'reject', 'accept', 'misleading units must fail schema'),
  ];
  return {
    description: 'Misleading units rejected by schema',
    verifies:
      'Schema validation: misleading/invalid units fail architectureDocumentSchema.safeParse. No simulate. No LLM.',
    checkKind: 'schema_validation',
    checks,
    expectedOutcome: { schemaSuccess: false },
    actualOutcome: {
      schemaSuccess: parsed.success,
      issues: parsed.success ? null : parsed.error.issues.slice(0, 5),
    },
    evidence: { notes: ['schema_only rejection'] },
    input: { architecture },
  };
}

function runAdv06(): AdvResult {
  const a = architectureDocumentSchema.parse(
    loadAdversarialJson('adv06_order_a.json'),
  ) as ArchitectureDocument;
  const b = architectureDocumentSchema.parse(
    loadAdversarialJson('adv06_order_b.json'),
  ) as ArchitectureDocument;
  const scenario = { type: 'load_multiplication' as const, multiplier: 2 };
  const ra = simulate(a, scenario);
  const rb = simulate(b, scenario);
  const equal = JSON.stringify(ra) === JSON.stringify(rb);
  const checks: Check[] = [
    equal
      ? pass('simulate_equality', true, true)
      : fail(
          'simulate_equality',
          true,
          false,
          'reordered arrays must yield identical simulate results',
        ),
  ];
  return {
    description: 'Reordered arrays yield identical simulation',
    verifies:
      'Adversarial deterministic: architecture array reorder does not change simulate output. No LLM.',
    checkKind: 'adversarial_deterministic',
    checks,
    expectedOutcome: { resultsEqual: true },
    actualOutcome: {
      resultsEqual: equal,
      statusA: ra.status,
      statusB: rb.status,
    },
    evidence: {
      formulaIds: ra.metrics.map((m) => m.formulaId),
    },
    input: { orderA: a, orderB: b, scenario },
  };
}

function runAdv07(): AdvResult {
  const architecture = loadAdversarialJson('adv07_no_implied_fallback.json');
  const parsed = architectureDocumentSchema.parse(architecture);
  const result = simulate(parsed as ArchitectureDocument, {
    type: 'component_unavailable',
    componentId: 'db',
  });
  const assumption = result.assumptions.find(
    (a) => a.id === 'NO_IMPLIED_FALLBACK',
  );
  const api = result.impacts.find((i) => i.componentId === 'api');
  const checks: Check[] = [
    assumption
      ? pass('assumption.NO_IMPLIED_FALLBACK', true, true)
      : fail(
          'assumption.NO_IMPLIED_FALLBACK',
          true,
          false,
          'missing NO_IMPLIED_FALLBACK assumption',
        ),
    assumption?.text.toLowerCase().includes('not treated as proof')
      ? pass('assumption.text', 'contains not treated as proof', assumption.text)
      : fail(
          'assumption.text',
          'contains not treated as proof',
          assumption?.text,
          'assumption text must clarify non-proof semantics',
        ),
    api?.impact === 'sync_failure_exposed'
      ? pass('impacts.api', 'sync_failure_exposed', api.impact)
      : fail(
          'impacts.api',
          'sync_failure_exposed',
          api?.impact,
          'api impact mismatch',
        ),
    !result.metrics.some((m) => m.metricId === 'availability_percent')
      ? pass('no_availability_percent', true, true)
      : fail(
          'no_availability_percent',
          true,
          false,
          'must not fabricate availability_percent',
        ),
  ];
  return {
    description: 'NO_IMPLIED_FALLBACK semantics',
    verifies:
      'Adversarial deterministic: missing fallback is not treated as proof of absence; exposure taxonomy without inventing availability%. No LLM.',
    checkKind: 'adversarial_deterministic',
    checks,
    expectedOutcome: {
      assumptionId: 'NO_IMPLIED_FALLBACK',
      apiImpact: 'sync_failure_exposed',
      noAvailabilityPercent: true,
    },
    actualOutcome: {
      assumption,
      apiImpact: api?.impact ?? null,
      metricIds: result.metrics.map((m) => m.metricId),
    },
    evidence: {
      notes: [assumption?.text ?? ''],
      refusedReasonCodes: result.refused.map((r) => r.reasonCode),
    },
    input: {
      architecture,
      scenario: { type: 'component_unavailable', componentId: 'db' },
    },
  };
}

function runAdv08(): AdvResult {
  const nl = loadAdversarialFixture('adv08_injection_nl.md');
  const architecture = loadAdversarialJson('adv01_forced_numbers.json');
  const parsed = architectureDocumentSchema.parse(architecture);
  // Simulate only sees formal model — NL file is intentionally unused.
  const result = simulate(parsed as ArchitectureDocument, {
    type: 'load_multiplication',
    multiplier: 1,
  });
  const util = result.metrics.find((m) => m.metricId === 'utilization:api');
  const checks: Check[] = [
    nl.includes('IGNORE PREVIOUS')
      ? pass('nl.contains_injection_marker', true, true)
      : fail(
          'nl.contains_injection_marker',
          true,
          false,
          'fixture must contain injection marker',
        ),
    nl.includes('utilization = 0')
      ? pass('nl.contains_forced_util', true, true)
      : fail(
          'nl.contains_forced_util',
          true,
          false,
          'fixture must contain forced utilization text',
        ),
    util?.value === 0.25
      ? pass('utilization:api', 0.25, util.value)
      : fail(
          'utilization:api',
          0.25,
          util?.value,
          'NL injection text must not affect simulate',
        ),
  ];
  return {
    description:
      'NL isolation check — injection markdown unused by simulate (NOT LLM prompt-injection resistance)',
    verifies:
      'Deterministic NL isolation: adv08_injection_nl.md is not passed to simulate; formal architecture yields utilization:api=0.25. This does NOT prove LLM prompt-injection resistance.',
    checkKind: 'nl_isolation_check',
    checks,
    expectedOutcome: {
      nlNotPassedToSimulate: true,
      utilizationApi: 0.25,
      llmPromptInjectionResistance: 'NOT_CLAIMED',
    },
    actualOutcome: {
      nlLength: nl.length,
      nlPassedToSimulate: false,
      utilizationApi: util?.value ?? null,
      llmPromptInjectionResistance: 'NOT_TESTED',
    },
    evidence: {
      notes: [
        'ADV-08 is an isolation check that NL content is outside the simulate input surface.',
        'Do not cite this case as evidence that prompt injection against a real LLM was tested.',
      ],
      formulaIds: result.metrics.map((m) => m.formulaId),
    },
    input: {
      architecture,
      scenario: { type: 'load_multiplication', multiplier: 1 },
      nlFixturePresent: true,
      nlPreview: nl.slice(0, 200),
    },
  };
}
