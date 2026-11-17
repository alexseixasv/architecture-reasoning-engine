/**
 * Shared contextual explanations for Workspace + Evaluation Lab tooltips.
 * Source of truth: MODEL.md, VALIDATION.md, DECISIONS.md, NOT_DONE.md — no invented formulas.
 */

export type GlossaryTermId =
  | 'architectureExtraction'
  | 'formalArchitectureModel'
  | 'validation'
  | 'explicitPersistence'
  | 'architectureVersion'
  | 'expectedVersion'
  | 'optimisticConcurrency'
  | 'http409Conflict'
  | 'semanticDiff'
  | 'scenarioAnalysis'
  | 'utilization'
  | 'capacity'
  | 'replicas'
  | 'refusedMetrics'
  | 'formulaId'
  | 'tokenUsage'
  | 'requestLatency'
  | 'fakeVsOpenAi'
  | 'deterministicSimulation'
  | 'groundedExplanation'
  | 'deterministicEvaluation'
  | 'goldenCases'
  | 'formalValidation'
  | 'schemaValidation'
  | 'adversarialDeterministic'
  | 'nlIsolationCheck'
  | 'casePassed'
  | 'caseFailed'
  | 'caseSkipped'
  | 'expectedVsActual'
  | 'formulaSubstitutions'
  | 'refusalCodes'
  | 'determinismEvidence'
  | 'fieldAccuracy'
  | 'nodeF1'
  | 'dependencyF1'
  | 'scenarioStructured'
  | 'unsupportedNl'
  | 'estimatedUsd'
  | 'wallP50P95'
  | 'tokensInOut'
  | 'sourceSha256'
  | 'historicalEvaluation'
  | 'baselineVsRemediation'
  | 'methodologicalLimitations';

export type MethodologicalLimitationId =
  | 'denominator_change_between_passes'
  | 'formal_context_scenario_scoring'
  | 'small_sample_N12'
  | 'not_independent_generalization'
  | 'estimated_usd_not_invoice'
  | 'fake_llm_not_openai_accuracy';

export interface GlossaryEntry {
  /** Short title shown in the tooltip header */
  title: string;
  /** Concise explanation (≈10–20s read) */
  body: string;
}

export const GLOSSARY: Record<GlossaryTermId, GlossaryEntry> = {
  architectureExtraction: {
    title: 'Architecture extraction',
    body: 'Maps natural-language architecture prose into a typed document via the LLM (Structured Outputs). The result is proposed only — it is never auto-persisted. Numbers used later still come from the deterministic engine, not from free-text LLM arithmetic.',
  },
  formalArchitectureModel: {
    title: 'Formal architecture model',
    body: 'Versioned typed document: nodes (service/datastore/queue), sync/async dependencies, capacity with aggregation, ingress traffic, assumptions, and conflicts. Quantities are known|unknown with units and provenance. Missing data is never silently defaulted to zero.',
  },
  validation: {
    title: 'Validation',
    body: 'Zod schema checks plus semantic findings (cycles, missing timeouts, retries without backoff, SPOF, graph size). Schema ERRORs block persist; many semantic issues are WARNINGs so incomplete models remain inspectable.',
  },
  explicitPersistence: {
    title: 'Explicit persistence',
    body: 'Saving creates an immutable architecture version in PostgreSQL only when you click Save. Extraction and validation do not write. Later corrections create a new version without re-extracting prose.',
  },
  architectureVersion: {
    title: 'Architecture version',
    body: 'Immutable snapshot of the formal model. Analyze always pins an exact version number — the API does not silently substitute “latest.” Prior versions remain readable after updates.',
  },
  expectedVersion: {
    title: 'expectedVersion',
    body: 'OCC token sent on PUT: the version you began editing. If the server’s latest version differs, the write is rejected with HTTP 409. The UI never bumps expectedVersion and retries automatically.',
  },
  optimisticConcurrency: {
    title: 'Optimistic concurrency control',
    body: 'Version-based update protection. A write with an outdated expectedVersion is rejected with HTTP 409 instead of silently overwriting newer changes. Clients must reload or reconcile deliberately.',
  },
  http409Conflict: {
    title: 'HTTP 409 conflict',
    body: 'OCC failure: expectedVersion no longer matches the server’s latest. Unsaved editor drafts are preserved. Reloading latest replaces the editor with the server document — it does not auto-merge or auto-retry.',
  },
  semanticDiff: {
    title: 'Semantic diff',
    body: 'Backend comparison of two persisted versions by entity id (not array index). Surfaces structural/field changes without a graph editor.',
  },
  scenarioAnalysis: {
    title: 'Scenario analysis',
    body: 'Interprets a natural-language question into one of three supported scenarios (load×N, latency degradation, component unavailable) or an explicit unsupported/refusal path, then runs pure simulate() on the pinned architecture version.',
  },
  utilization: {
    title: 'Utilization',
    body: 'Steady-state load over capacity for a node: U = λ / C when inputs allow (formula F-UTIL-001). Values come only from deterministic simulation — never from the LLM. Saturation is the boolean U ≥ 1.',
  },
  capacity: {
    title: 'Capacity',
    body: 'Offered service capacity used by the engine (often replicas × capacityPerReplica with the node’s capacityAggregation). Conflicted or unknown capacity fields cause refusals rather than invented numbers.',
  },
  replicas: {
    title: 'Replicas',
    body: 'Replica count on a node when known. With sum_replicas aggregation, capacity scales with replicas × per-replica capacity. Conflicting replica values are kept as candidates and may refuse capacity metrics.',
  },
  refusedMetrics: {
    title: 'Refused metrics',
    body: 'Metrics the engine will not invent: availability %, successful throughput, p95/p99 latency distributions, and other unsupported claims. Each refusal carries a reasonCode (e.g. NO_AVAILABILITY_MODEL).',
  },
  formulaId: {
    title: 'Formula ID',
    body: 'Stable identifier of the deterministic formula that produced a metric (e.g. F-UTIL-001). Lets you trace the value to MODEL.md / DERIVATION.md without trusting narrative text.',
  },
  tokenUsage: {
    title: 'Token usage',
    body: 'Provider-reported input/output tokens for extract/scenario/explain stages. Fake LLM demos may show tokens with estimated USD null when pricing is incomplete — values are never fabricated as $0.',
  },
  requestLatency: {
    title: 'Request timings',
    body: 'Stage timings (extractScenario, simulate, explain, total) for the HTTP request path. These are observability numbers — not architecture end-to-end latency SLOs or p95 product claims.',
  },
  fakeVsOpenAi: {
    title: 'Fake vs OpenAI',
    body: 'Fake is deterministic offline wiring for Compose/demo/CI, including the known checkout-pricing live Path B fixture — not extraction accuracy on arbitrary unseen prose. OpenAI accuracy is measured separately on the fixed V01–V12 historical set in VALIDATION.md / the Lab historical panel.',
  },
  deterministicSimulation: {
    title: 'Deterministic simulation',
    body: 'The same validated architecture and scenario produce the same numerical result. simulate() is pure TypeScript with no Nest, DB, or LLM imports — LLMs never compute architecture metrics.',
  },
  groundedExplanation: {
    title: 'Grounded explanation',
    body: 'LLM narrative that may only cite numbers already present in engine evidence. Unsupported numeric claims or missing refs trigger a deterministic_fallback explanation instead of invented figures.',
  },
  deterministicEvaluation: {
    title: 'Deterministic evaluation',
    body: 'Allowlisted G/V/ADV fixtures executed in-process via Evaluation Lab HTTP adapters. No OpenAI, no Vitest spawn, no DB writes. Pass/fail totals are for the current run only — separate from historical OpenAI metrics.',
  },
  goldenCases: {
    title: 'Golden cases',
    body: 'G01–G12 hand-oracle simulation fixtures under tests/golden. They prove engine metrics and refusals match documented derivations offline — not LLM extraction quality.',
  },
  formalValidation: {
    title: 'Formal validation',
    body: 'V01–V09/V12 Lab path: structured formal architecture + scenario run through schema/simulate adapters. Distinct from historical natural-language scenario classification scores.',
  },
  schemaValidation: {
    title: 'Schema validation',
    body: 'V10/V11 Lab checkKind schema_validation: verifies schema accept/reject behavior only. A pass here is not NL scenario-classification success and does not run simulation for that check.',
  },
  adversarialDeterministic: {
    title: 'Adversarial deterministic checks',
    body: 'ADV-01–07 style boundaries: forced numbers ignored, unsupported scenarios, malformed/contradictory inputs, reorder invariance, NO_IMPLIED_FALLBACK. Deterministic only — not a full LLM security suite.',
  },
  nlIsolationCheck: {
    title: 'NL isolation check',
    body: 'ADV-08: stored natural-language injection text must not affect simulate(). This is an isolation check, not proof of LLM prompt-injection resistance.',
  },
  casePassed: {
    title: 'Passed',
    body: 'Allowlisted case matched its expected outcome under the Lab adapter (simulation, schema, or adversarial check). Counts come from the current deterministic run response.',
  },
  caseFailed: {
    title: 'Failed',
    body: 'Actual outcome disagreed with the expected oracle/check for this allowlisted case. Open the case detail for mismatches and evidence — failures do not change historical OpenAI tables.',
  },
  caseSkipped: {
    title: 'Skipped',
    body: 'Case was not executed in this run (suite subset or adapter skip). Skipped cases are excluded from pass/fail success criteria for that execution.',
  },
  expectedVsActual: {
    title: 'Expected vs actual',
    body: 'Expected is the fixture oracle or check outcome; actual is what the engine/adapters produced. Compare in the results table or case detail — the UI never recomputes utilization/load in the browser.',
  },
  formulaSubstitutions: {
    title: 'Formula substitutions',
    body: 'Concrete inputs substituted into a formula for a metric (from engine evidence). Used to hand-verify the numeric result against MODEL.md / DERIVATION.md.',
  },
  refusalCodes: {
    title: 'Refusal codes',
    body: 'Machine-stable reason codes for refused or partial answers (e.g. MISSING_BASELINE_TRAFFIC, NO_AVAILABILITY_MODEL). Prefer codes over free-text when diagnosing engine honesty boundaries.',
  },
  determinismEvidence: {
    title: 'Determinism evidence',
    body: 'Lab evidence that repeating simulate on the same inputs yields equal results (and architecture objects are not mutated). Supports interview defense of closed-form reproducibility.',
  },
  fieldAccuracy: {
    title: 'Field accuracy',
    body: 'Share of evaluated structured fields matching the reference on the historical OpenAI set: correct ÷ evaluated. Not a generalization estimate. Baseline used 120/235 and remediation 141/244 — denominators differ; treat % as directional.',
  },
  nodeF1: {
    title: 'Node F1',
    body: 'Harmonic mean of precision and recall for architecture node identification on the historical OpenAI evaluation. Higher values mean better correspondence with the reference model. Historical only — not produced by the deterministic Run button.',
  },
  dependencyF1: {
    title: 'Dependency F1',
    body: 'Harmonic mean of precision and recall for extracted architecture dependencies on the historical OpenAI set. Prefer F1 over field-% when comparing baseline vs remediation because field denominators shifted.',
  },
  scenarioStructured: {
    title: 'Scenario structured',
    body: 'Historical count of supported structured scenario intents classified correctly (denominator 10 on V01–V09/V12). Live scoring used formal architecture context — full extract→scenario chaining was not measured.',
  },
  unsupportedNl: {
    title: 'Unsupported NL',
    body: 'Historical count of unsupported natural-language scenarios correctly recognized (e.g. availability %, E2E p95). Does not establish universal refusal accuracy outside the fixed V01–V12 set.',
  },
  estimatedUsd: {
    title: 'Estimated USD',
    body: 'Published-pricing estimate of provider spend for the historical run (or per-request usage). Incomplete pricing yields null — never a fabricated $0. Estimated USD is not an invoice.',
  },
  wallP50P95: {
    title: 'Wall p50–p95',
    body: 'Request wall-clock percentiles for the historical evaluation sample (N=12). Observability of provider latency — not architecture product latency SLOs. Small-N percentiles are statistically weak.',
  },
  tokensInOut: {
    title: 'Tokens in/out',
    body: 'Aggregate input/output tokens recorded on the historical OpenAI artifact for that pass. Used with cost projections; Fake demos may omit priced totals.',
  },
  sourceSha256: {
    title: 'Source SHA-256',
    body: 'Hash of the gitignored raw evaluation artifact from which the sanitized historical summary was generated. Proves the summary tracks a frozen measured run without re-calling OpenAI.',
  },
  historicalEvaluation: {
    title: 'Historical OpenAI evaluation',
    body: 'Sanitized Phase 7 measured evidence served when the Lab is enabled. Metrics were recorded previously and are not executed by the current deterministic run. They never alter run pass/fail totals.',
  },
  baselineVsRemediation: {
    title: 'Baseline vs remediation',
    body: 'Two historical passes on the same V01–V12 dataset: first measured baseline, then an offline-prompt remediation regression. Same-dataset reuse means the second pass is not an independent generalization benchmark.',
  },
  methodologicalLimitations: {
    title: 'Methodological limitations',
    body: 'Documented caveats attached to historical OpenAI evidence (denominator shifts, formal-context scenario scoring, small N, estimated USD, Fake≠OpenAI). They limit how strongly you may interpret the tables.',
  },
};

export const METHODOLOGICAL_LIMITATIONS: Record<
  MethodologicalLimitationId,
  GlossaryEntry
> = {
  denominator_change_between_passes: {
    title: 'Denominator change between passes',
    body: 'Field-accuracy totals shifted (235 → 244) because conflict-scoring rows and ID alignment changed comparisons. Treat field % as directional; prefer Node/Dep F1 and scenario metrics when comparing passes.',
  },
  formal_context_scenario_scoring: {
    title: 'Formal-context scenario scoring',
    body: 'Historical scenario success used hand formal architecture context, not the extracted document. Full extract→scenario end-to-end accuracy was not measured.',
  },
  small_sample_N12: {
    title: 'Small sample (N=12)',
    body: 'Latency percentiles and similar aggregates use twelve cases. They are request timings for the eval set — not production SLO evidence.',
  },
  not_independent_generalization: {
    title: 'Not independent generalization',
    body: 'Remediation reused the same V01–V12 dataset. Improvement is a same-set regression signal, not a held-out generalization claim for panel-unseen architectures.',
  },
  estimated_usd_not_invoice: {
    title: 'Estimated USD ≠ invoice',
    body: 'Dollar figures use published model pricing estimates. Incomplete pricing yields null. Do not treat estimates as billed charges.',
  },
  fake_llm_not_openai_accuracy: {
    title: 'Fake LLM ≠ OpenAI accuracy',
    body: 'Fake demos prove contracts, Compose wiring, and known fixtures (including checkout-pricing Path B). They do not measure extraction quality on arbitrary unseen prose; OpenAI numbers live only in historical evidence.',
  },
};

export function getGlossaryEntry(term: GlossaryTermId): GlossaryEntry {
  return GLOSSARY[term];
}

export function explainMethodologicalLimitation(
  id: string,
): GlossaryEntry | null {
  if (id in METHODOLOGICAL_LIMITATIONS) {
    return METHODOLOGICAL_LIMITATIONS[id as MethodologicalLimitationId];
  }
  return null;
}

export function isGlossaryTermId(value: string): value is GlossaryTermId {
  return value in GLOSSARY;
}
