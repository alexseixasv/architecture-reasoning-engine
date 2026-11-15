# Learnings

Discoveries, mistakes, fixes, and reusable patterns. Update after each phase.

## L-001 — Greenfield repo; PDF outside workspace (2026-11-14)

- Hiring PDF was in Downloads, not in the git repo.
- Extracting `TECHNICAL_REQUIREMENTS.md` into version control prevents silent drift from the case and gives stable REQ-IDs for phase gates.
- Pattern: treat external PDFs as inputs; commit a structured extraction, not a binary (unless explicitly requested).

## L-002 — Separate PDF mandates from engineering decisions (2026-11-14)

- Stack choice, analytical engine, no UI, and eight phases are ENG decisions, not PDF mandates.
- Recording them separately avoids claiming the case required choices it only preferred.

## L-003 — exactOptionalPropertyTypes and optional clears (2026-11-14)

- Assigning `fieldConflicts: undefined` fails under `exactOptionalPropertyTypes`.
- Pattern: destructure-omit the property when clearing optional fields in updates/tests.

## L-004 — Semantic warnings must remain persistable (2026-11-14)

- Treating sync cycles / SPOF as persist-blocking ERRORs would prevent storing the very models the interview needs to correct and discuss.
- Split findingClass (`schema` | `referential` | `semantic` | `simulation_readiness`) made the policy testable and explainable.

## L-005 — OCC tests must race, not serialize (2026-11-14)

- A sequential “update then update again with stale version” only proves stale rejection, not mutual exclusion under concurrency.
- Use `Promise.allSettled` on two updates with the same `expectedVersion` and assert exactly one fulfilled + one `VersionConflictError`.

## L-006 — Multiple ingress without split invents load (2026-11-15)

- Applying full `λ'` to each of several ingress nodes double-counts boundary traffic.
- Prefer a single ingress (or gateway) with explicit `requestsPerParent` fan-out; refuse `MULTIPLE_INGRESS_REQUIRES_SPLIT` otherwise.

## L-007 — Standing refusals vs material partials (2026-11-15)

- Always-on refusals (availability %, throughput, E2E, expected attempts) should not alone force `NOT_ANSWERABLE`.
- Filter “standing” reason codes when deriving ANSWERED vs PARTIALLY_ANSWERED from primary metrics.

## L-008 — Shared accumulation needs an explicit single ingress (2026-11-15)

- Two “root” services as `ingressNodeIds` triggers `MULTIPLE_INGRESS_REQUIRES_SPLIT`.
- Model shared downstream with a gateway ingress and declared `requestsPerParent` fan-out so 100+50=150 is constructive, not coincidental.

## L-009 — `NO_IMPLIED_FALLBACK` is easy to misread (2026-11-15)

- Correct reading: do not infer fallback behavior from silence.
- Incorrect reading: assume fallback is absent / proven missing.
- Documented in MODEL.md + adversarial ADV-07.

## L-010 — PowerShell `Set-Content -Encoding utf8` writes BOM (2026-11-15)

- BOM breaks `JSON.parse` on Windows-created fixture metas.
- Prefer UTF-8 without BOM for test fixtures; strip `\uFEFF` defensively in loaders.

## L-011 — Structured Outputs need a flatter DTO than the domain schema (2026-11-15)

- OpenAI strict JSON Schema + domain `.strict()` Quantity unions fight each other.
- Pattern: LLM-facing DTO with explicit `presence` enums → deterministic mapper → domain Zod + semantic validate.

## L-012 — Complete analysis cost ≠ single LLM call (2026-11-15)

- A full NL→answer path may bill architecture extraction + scenario extraction + explanation.
- Project $/1000 analyses as the sum of mean costs of those three operations; unknown model pricing → `null`, never `$0`.

## L-013 — Provenance excerpts stop fabricated “declared” evidence (2026-11-15)

- Requiring the excerpt to be a contiguous substring of the user text catches invented citations.
- Unverified excerpts become `unknown` + `PROVENANCE_UNVERIFIED` rather than trusted declarations.

## L-014 — “Don’t compute metrics” ≠ utilization questions unsupported (2026-11-15)

- Live smoke: V01 “baseline 1x … utilization?” was classified `UNSUPPORTED` despite being `load_multiplication` ×1.
- Prompt must separate classifier non-computation from supported load scenarios that yield engine utilization.

## L-015 — Explanation guards must not reject refusal discussion (2026-11-15)

- Banning bare `p95`/`p99` tokens false-positives explanations that correctly cite `NO_LATENCY_DISTRIBUTION`.
- Reject numeric percentile/availability claims; allow naming refused metric classes with refusalCodes.

## L-016 — Refused metric ids ≠ calculated metric ids (2026-11-15)

- Smoke #2: model put `availability_percent` / `throughput` / `latency_p95_p99` in `metricIds`.
- Those ids live on `SimulationResult.refused[].metricId`, not `metrics[]`.
- DTO now has `refusedMetricIds`; catalog separates `availableMetrics` vs `refusedOutputs`; validator rejects refused ids in `metricIds`.
