import { createHash } from 'node:crypto';

export const HISTORICAL_DISCLAIMER =
  'Historical OpenAI evaluation — not executed in this run';

/** Values published in VALIDATION.md D–G for cross-check (not invented). */
export const VALIDATION_MD_EXPECTATIONS = {
  baseline: {
    fieldMatches: 120,
    fieldTotal: 235,
    nodePrecision: 0.8,
    nodeRecall: 0.86,
    nodeF1: 0.83,
    depPrecision: 0.7,
    depRecall: 0.78,
    depF1: 0.74,
    knownToUnknown: 61,
    unknownToKnown: 0,
    scenarioStructuredOk: 10,
    scenarioUnsupportedOk: 1,
    grounded: 9,
    fallback: 1,
    estimatedUsdApprox: 0.186,
    wallP50Approx: 7972,
    wallP95Approx: 10980,
  },
  remediation: {
    fieldMatches: 141,
    fieldTotal: 244,
    nodeF1: 0.86,
    depF1: 0.84,
    scenarioStructuredOk: 10,
    scenarioUnsupportedOk: 2,
    grounded: 9,
    fallback: 1,
    estimatedUsdApprox: 0.203,
    wallP50Approx: 7575,
    wallP95Approx: 19828,
    tokensIn: 49931,
    tokensOut: 12872,
  },
} as const;

export type SanitizeDiscrepancy = {
  path: string;
  expected: unknown;
  actual: unknown;
  message: string;
};

export type HistoricalCaseSummary = {
  caseId: string;
  pipelineFailureClass: string;
  architectureStatus?: string;
  simulationStatus?: string | null;
  fieldAccuracy?: { matches: number; total: number };
  nodePresence?: {
    precision: number | null;
    recall: number | null;
    f1: number | null;
  };
  dependencyPresence?: {
    precision: number | null;
    recall: number | null;
    f1: number | null;
  };
  scenarioCompare?: {
    intentMatch: boolean;
    parameterMatch: boolean;
    overallMatch: boolean;
    expectedIntent?: string | null;
    actualIntent?: string | null;
  };
  explanationSource?: string | null;
  explanationValidationOk?: boolean | null;
  failureCategories?: string[];
  timingsMs?: Record<string, number | undefined>;
  /** Safe subset of field comparisons (presence/field kinds only; capped). */
  fieldComparisonSample?: Array<{
    path: string;
    match: boolean;
    expected: string;
    actual: string;
    kind?: string;
  }>;
};

export type HistoricalSummary = {
  disclaimer: typeof HISTORICAL_DISCLAIMER;
  id: string;
  passLabel: 'baseline' | 'remediation';
  evaluationDate: string;
  generatedAt: string;
  model: string;
  dataset: string;
  maxProviderRequests: number;
  sourceArtifact: string;
  sourceArtifactSha256: string;
  liveStatus: string;
  metrics: {
    fieldAccuracy: { matches: number; total: number; pct: number };
    node: {
      precision: number | null;
      recall: number | null;
      f1: number | null;
    };
    dependency: {
      precision: number | null;
      recall: number | null;
      f1: number | null;
    };
    quantityState: {
      knownToUnknown: number;
      unknownToKnown: number;
    };
    scenarioStructured: {
      overallOk: number;
      denominator: number;
    };
    scenarioUnsupportedNl: {
      ok: number;
      denominator: number;
    };
    explanation: {
      groundedSuccess: number;
      deterministicFallback: number;
      evaluated: number;
    };
    estimatedUsd: number | null;
    wallMs: { p50: number | null; p95: number | null; sampleSize: number };
    tokens?: { input: number; output: number };
    costProjectionsPer1000Usd?: {
      A: number | null;
      B: number | null;
      C: number | null;
    };
  };
  limitations: string[];
  cases: HistoricalCaseSummary[];
  validationMdCrossCheck: {
    ok: boolean;
    discrepancies: SanitizeDiscrepancy[];
  };
};

type RawArtifact = {
  generatedAt: string;
  model: string;
  maxProviderRequests: number;
  usage: Array<{
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number | null;
    providerRequestId?: string;
  }>;
  report: {
    architectureFieldAccuracy: { matches: number; total: number };
    scenarioStructured: {
      overallOk: number;
      denominator: number;
      intentOk?: number;
      parameterOk?: number;
    };
    scenarioUnsupportedNl: { ok: number; denominator: number };
    explanation: {
      evaluated: number;
      groundedSuccess: number;
      deterministicFallback: number;
    };
    latency: {
      totalWall: {
        p50Ms: number;
        p95Ms: number;
        sampleSize: number;
      };
    };
    cost: {
      fullAnalysis: { projectedPer1000Usd: number | null };
      persistedArchitectureAnalysis: { projectedPer1000Usd: number | null };
      earlyTerminal: { projectedPer1000Usd: number | null };
    };
    cases: Array<Record<string, unknown>>;
    liveStatus: string;
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function approxEqual(a: number, b: number, absTol: number): boolean {
  return Math.abs(a - b) <= absTol;
}

function f1(
  precision: number | null,
  recall: number | null,
): number | null {
  if (precision === null || recall === null || precision + recall === 0) {
    return null;
  }
  return (2 * precision * recall) / (precision + recall);
}

function presenceAgg(
  cases: Array<Record<string, unknown>>,
  key: 'nodePresence' | 'dependencyPresence',
): {
  precision: number | null;
  recall: number | null;
  f1: number | null;
  tp: number;
  fn: number;
  fp: number;
} {
  let tp = 0;
  let fn = 0;
  let fp = 0;
  for (const c of cases) {
    const compare = c['architectureCompare'] as
      | Record<string, unknown>
      | undefined;
    const p = compare?.[key] as
      | {
          truePositives?: number;
          falseNegatives?: number;
          falsePositives?: number;
        }
      | undefined;
    if (!p) continue;
    tp += p.truePositives ?? 0;
    fn += p.falseNegatives ?? 0;
    fp += p.falsePositives ?? 0;
  }
  const precision = tp + fp === 0 ? null : tp / (tp + fp);
  const recall = tp + fn === 0 ? null : tp / (tp + fn);
  return { precision, recall, f1: f1(precision, recall), tp, fn, fp };
}

function quantityAgg(cases: Array<Record<string, unknown>>): {
  knownToUnknown: number;
  unknownToKnown: number;
} {
  let knownToUnknown = 0;
  let unknownToKnown = 0;
  for (const c of cases) {
    const compare = c['architectureCompare'] as
      | Record<string, unknown>
      | undefined;
    const qs = compare?.['quantityState'] as
      | { knownToUnknown?: number; unknownToKnown?: number }
      | undefined;
    if (!qs) continue;
    knownToUnknown += qs.knownToUnknown ?? 0;
    unknownToKnown += qs.unknownToKnown ?? 0;
  }
  return { knownToUnknown, unknownToKnown };
}

export function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function validateRawArtifactStructure(raw: unknown): raw is RawArtifact {
  if (raw === null || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  if (typeof o['generatedAt'] !== 'string') return false;
  if (typeof o['model'] !== 'string') return false;
  if (!Array.isArray(o['usage'])) return false;
  const report = o['report'] as Record<string, unknown> | undefined;
  if (!report || typeof report !== 'object') return false;
  if (!Array.isArray(report['cases'])) return false;
  if (!report['architectureFieldAccuracy']) return false;
  if (!report['scenarioStructured']) return false;
  if (!report['scenarioUnsupportedNl']) return false;
  if (!report['explanation']) return false;
  if (!report['latency']) return false;
  if (!report['cost']) return false;
  return true;
}

function sanitizeCase(c: Record<string, unknown>): HistoricalCaseSummary {
  const compare = c['architectureCompare'] as
    | Record<string, unknown>
    | undefined;
  const fieldAccuracy = compare?.['fieldAccuracy'] as
    | { matches: number; total: number }
    | undefined;
  const nodePresence = compare?.['nodePresence'] as
    | {
        precision: number | null;
        recall: number | null;
        f1: number | null;
      }
    | undefined;
  const dependencyPresence = compare?.['dependencyPresence'] as
    | {
        precision: number | null;
        recall: number | null;
        f1: number | null;
      }
    | undefined;
  const scenarioCompare = c['scenarioCompare'] as
    | {
        intentMatch: boolean;
        parameterMatch: boolean;
        overallMatch: boolean;
        expectedIntent?: string | null;
        actualIntent?: string | null;
      }
    | undefined;
  const fieldComparisons = (compare?.['fieldComparisons'] as
    | Array<Record<string, unknown>>
    | undefined)?.slice(0, 40);

  const summary: HistoricalCaseSummary = {
    caseId: String(c['caseId']),
    pipelineFailureClass: String(c['pipelineFailureClass'] ?? 'none'),
  };
  if (typeof c['architectureStatus'] === 'string') {
    summary.architectureStatus = c['architectureStatus'];
  }
  if ('simulationStatus' in c) {
    summary.simulationStatus = (c['simulationStatus'] as string | null) ?? null;
  }
  if (fieldAccuracy) summary.fieldAccuracy = fieldAccuracy;
  if (nodePresence) {
    summary.nodePresence = {
      precision: nodePresence.precision,
      recall: nodePresence.recall,
      f1: nodePresence.f1,
    };
  }
  if (dependencyPresence) {
    summary.dependencyPresence = {
      precision: dependencyPresence.precision,
      recall: dependencyPresence.recall,
      f1: dependencyPresence.f1,
    };
  }
  if (scenarioCompare) {
    summary.scenarioCompare = {
      intentMatch: scenarioCompare.intentMatch,
      parameterMatch: scenarioCompare.parameterMatch,
      overallMatch: scenarioCompare.overallMatch,
      expectedIntent: scenarioCompare.expectedIntent ?? null,
      actualIntent: scenarioCompare.actualIntent ?? null,
    };
  }
  if ('explanationSource' in c) {
    summary.explanationSource =
      (c['explanationSource'] as string | null) ?? null;
  }
  if ('explanationValidationOk' in c) {
    summary.explanationValidationOk =
      (c['explanationValidationOk'] as boolean | null) ?? null;
  }
  if (Array.isArray(c['failureCategories'])) {
    summary.failureCategories = c['failureCategories'] as string[];
  }
  if (c['timingsMs'] && typeof c['timingsMs'] === 'object') {
    summary.timingsMs = c['timingsMs'] as Record<string, number | undefined>;
  }
  if (fieldComparisons) {
    summary.fieldComparisonSample = fieldComparisons.map((f) => ({
      path: String(f['path']),
      match: Boolean(f['match']),
      expected: String(f['expected']),
      actual: String(f['actual']),
      ...(typeof f['kind'] === 'string' ? { kind: f['kind'] } : {}),
    }));
  }
  return summary;
}

export function sanitizeHistoricalArtifact(input: {
  raw: unknown;
  sourceArtifactRelativePath: string;
  sourceBytes: Buffer;
  passLabel: 'baseline' | 'remediation';
}): {
  summary: HistoricalSummary | null;
  discrepancies: SanitizeDiscrepancy[];
  structureOk: boolean;
} {
  const discrepancies: SanitizeDiscrepancy[] = [];
  if (!validateRawArtifactStructure(input.raw)) {
    return {
      summary: null,
      structureOk: false,
      discrepancies: [
        {
          path: 'artifact',
          expected: 'live-validation-eval shape',
          actual: 'invalid',
          message: 'Artifact failed structural validation',
        },
      ],
    };
  }

  const raw = input.raw;
  const sha = sha256Hex(input.sourceBytes);
  const node = presenceAgg(raw.report.cases, 'nodePresence');
  const dep = presenceAgg(raw.report.cases, 'dependencyPresence');
  const quantity = quantityAgg(raw.report.cases);
  const usageTokens = raw.usage.reduce(
    (acc: { input: number; output: number; usd: number }, u) => ({
      input: acc.input + (u.inputTokens ?? 0),
      output: acc.output + (u.outputTokens ?? 0),
      usd:
        acc.usd +
        (typeof u.estimatedCostUsd === 'number' ? u.estimatedCostUsd : 0),
    }),
    { input: 0, output: 0, usd: 0 },
  );

  const field = raw.report.architectureFieldAccuracy;
  const pct = field.total === 0 ? 0 : round2((100 * field.matches) / field.total);
  const evaluationDate = raw.generatedAt.slice(0, 10);

  const expected =
    input.passLabel === 'baseline'
      ? VALIDATION_MD_EXPECTATIONS.baseline
      : VALIDATION_MD_EXPECTATIONS.remediation;

  const check = (
    path: string,
    expectedValue: number,
    actual: number | null,
    tol: number,
  ) => {
    if (actual === null || !approxEqual(actual, expectedValue, tol)) {
      discrepancies.push({
        path,
        expected: expectedValue,
        actual,
        message: `${path}: expected ~${expectedValue}, got ${actual}`,
      });
    }
  };

  check('field.matches', expected.fieldMatches, field.matches, 0);
  check('field.total', expected.fieldTotal, field.total, 0);
  check(
    'scenarioStructured.overallOk',
    expected.scenarioStructuredOk,
    raw.report.scenarioStructured.overallOk,
    0,
  );
  check(
    'scenarioUnsupportedNl.ok',
    expected.scenarioUnsupportedOk,
    raw.report.scenarioUnsupportedNl.ok,
    0,
  );
  check(
    'explanation.groundedSuccess',
    expected.grounded,
    raw.report.explanation.groundedSuccess,
    0,
  );
  check(
    'explanation.deterministicFallback',
    expected.fallback,
    raw.report.explanation.deterministicFallback,
    0,
  );
  check('estimatedUsd', expected.estimatedUsdApprox, usageTokens.usd, 0.001);
  check(
    'wall.p50Ms',
    expected.wallP50Approx,
    raw.report.latency.totalWall.p50Ms,
    1,
  );
  check(
    'wall.p95Ms',
    expected.wallP95Approx,
    raw.report.latency.totalWall.p95Ms,
    1,
  );

  if (input.passLabel === 'baseline') {
    const b = VALIDATION_MD_EXPECTATIONS.baseline;
    check('node.precision', b.nodePrecision, node.precision, 0.005);
    check('node.recall', b.nodeRecall, node.recall, 0.005);
    check('node.f1', b.nodeF1, node.f1, 0.005);
    check('dep.precision', b.depPrecision, dep.precision, 0.005);
    check('dep.recall', b.depRecall, dep.recall, 0.005);
    check('dep.f1', b.depF1, dep.f1, 0.005);
    check('quantity.knownToUnknown', b.knownToUnknown, quantity.knownToUnknown, 0);
    check('quantity.unknownToKnown', b.unknownToKnown, quantity.unknownToKnown, 0);
  } else {
    const r = VALIDATION_MD_EXPECTATIONS.remediation;
    check('node.f1', r.nodeF1, node.f1, 0.005);
    check('dep.f1', r.depF1, dep.f1, 0.005);
    check('tokens.input', r.tokensIn, usageTokens.input, 0);
    check('tokens.output', r.tokensOut, usageTokens.output, 0);
  }

  const summary: HistoricalSummary = {
    disclaimer: HISTORICAL_DISCLAIMER,
    id: `${input.passLabel}-${evaluationDate}`,
    passLabel: input.passLabel,
    evaluationDate,
    generatedAt: raw.generatedAt,
    model: raw.model,
    dataset: 'V01–V12',
    maxProviderRequests: raw.maxProviderRequests,
    sourceArtifact: input.sourceArtifactRelativePath,
    sourceArtifactSha256: sha,
    liveStatus: raw.report.liveStatus,
    metrics: {
      fieldAccuracy: {
        matches: field.matches,
        total: field.total,
        pct,
      },
      node: {
        precision: node.precision,
        recall: node.recall,
        f1: node.f1,
      },
      dependency: {
        precision: dep.precision,
        recall: dep.recall,
        f1: dep.f1,
      },
      quantityState: quantity,
      scenarioStructured: {
        overallOk: raw.report.scenarioStructured.overallOk,
        denominator: raw.report.scenarioStructured.denominator,
      },
      scenarioUnsupportedNl: {
        ok: raw.report.scenarioUnsupportedNl.ok,
        denominator: raw.report.scenarioUnsupportedNl.denominator,
      },
      explanation: {
        groundedSuccess: raw.report.explanation.groundedSuccess,
        deterministicFallback: raw.report.explanation.deterministicFallback,
        evaluated: raw.report.explanation.evaluated,
      },
      estimatedUsd: round2(usageTokens.usd * 1000) / 1000,
      wallMs: {
        p50: Math.round(raw.report.latency.totalWall.p50Ms),
        p95: Math.round(raw.report.latency.totalWall.p95Ms),
        sampleSize: raw.report.latency.totalWall.sampleSize,
      },
      tokens: {
        input: usageTokens.input,
        output: usageTokens.output,
      },
      costProjectionsPer1000Usd: {
        A: raw.report.cost.fullAnalysis.projectedPer1000Usd,
        B: raw.report.cost.persistedArchitectureAnalysis.projectedPer1000Usd,
        C: raw.report.cost.earlyTerminal.projectedPer1000Usd,
      },
    },
    limitations: [
      'denominator_change_between_passes',
      'formal_context_scenario_scoring',
      'small_sample_N12',
      'not_independent_generalization',
      'estimated_usd_not_invoice',
      'fake_llm_not_openai_accuracy',
    ],
    cases: raw.report.cases.map((c) => sanitizeCase(c)),
    validationMdCrossCheck: {
      ok: discrepancies.length === 0,
      discrepancies,
    },
  };

  return { summary, discrepancies, structureOk: true };
}
