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

## L-017 — Vitest/esbuild needs explicit @Inject for Nest (2026-11-15)

- Vitest does not emit `design:paramtypes`; constructor type-only DI resolves as `undefined`.
- Prefer `@Inject(Token)` on Nest controllers/services used under Vitest HTTP tests.

## L-018 — Domain HTTP 200 ≠ success of the question (2026-11-15)

- Clarification/unsupported/not-answerable are successful transport responses with unsuccessful domain status.
- Clients and curl demos must inspect payload status fields.

## L-019 — Compose acceptance needs a rebuilt image (2026-11-15)

- A long-running Compose `api` container can stay on a pre-Phase-6 image after code lands.
- Always `docker compose up -d --build` before claiming HTTP acceptance against Compose.

## L-020 — Extra nodes must hurt the score (2026-11-15)

- If hallucinated nodes/deps are omitted from the denominator, inventing extras looks “free”.
- Presence precision/recall/F1 + explicit `extra` field comparisons keep hallucinations visible.

## L-021 — Scenario JSON equality is brittle (2026-11-15)

- Prefer semantic type+parameter compare; keep intent accuracy separate from parameter accuracy.
- Invented structured scenarios on unsupported NL must score as failures.

## L-022 — Live V01–V12 failure patterns (2026-11-15)

- Architecture field score (~51%) dominated by known→unknown and hallucinated/renamed nodes — not by engine math.
- Availability%-style questions can be over-mapped to `component_unavailable` (V10) instead of UNSUPPORTED.
- Scenario eval against formal context can look strong while architecture extraction remains weak — report separately.

## L-023 — Conflict headlines need field vs document split (2026-11-15)

- V12 stores replica contradictions on `node.fieldConflicts` with empty `document.conflicts`.
- Scoring only `document.conflicts.count` made “0/1 preserved” look like a missed expected conflict when the model emitted an extra/mis-leveled document conflict.
- Report field-level preservation, document-level preservation, and extras separately.

## L-024 — Eval artifacts need A/B/C/D loss causes (2026-11-15)

- known→unknown alone does not say whether the LLM omitted the field, provenance failed, or the mapper transformed it.
- Persist sanitized DTO presence + finding codes + mapped state in the live artifact (no raw secrets / unnecessary NL duplication).
- Explanation fallbacks need `validationErrorCodes`, not only opaque string counts.

## L-025 — Second-pass diagnostics: DTO omission dominates (2026-11-15)

- After remediation: **0** provenance rejections on quantities; **75** `missing_in_dto`; **1** unit mismatch; unknown→known still **0**.
- Mixed-intent prompt fixed V10 (unsupported **2/2**); V12 fieldConflicts preserved **1/1**.
- Residual ID extras are slug variants (`api-service` / `api-svc` vs fixture `api`) — prompt guidance helps but does not guarantee fixture id equality without hardcoding.
- V07 fallback was `CLAIM_KIND_MISSING_REFS`, not a numeric invention — codes make the next fix targeted.

## L-026 — Frontend OCC and nginx path must match Nest contracts (2026-11-15)

- Capture `isUpdate` / `expectedVersion` before async persist; post-success `isUpdate` already reflects the new version.
- HTTP 409 bodies expose `expectedVersion` + `actualVersion` — surface them; never bump and retry.
- Compose acceptance must hit `:8080/api/...` (nginx strip), not only `:3000`, or proxy regressions stay invisible.
- Unit tests with an injected `ApiClient` stay Fake/deterministic; browser verification is separate from HTTP acceptance.

## L-027 — Evaluation Lab needs fixtures in the image, not bind mounts (2026-11-15)

- Local Lab worked with `tests/` on disk; Compose API previously dockerignored all of `tests/` → empty catalog in the container.
- Copy only golden/validation/adversarial fixture trees into the runtime image; keep `*.spec.ts` and unit/integration trees out.
- Historical evidence must be Git-tracked sanitized JSON under `src/evaluation/historical/` (nest assets → `dist`); never ship raw `artifacts/eval/run-*.json`.

## L-028 — Compose env inheritance can silently select OpenAI (2026-11-15)

- `${LLM_PROVIDER:-fake}` still picks up a host `.env` value of `openai`, crashing the API without a key.
- Demo override should **force** `LLM_PROVIDER=fake` (and Lab enablement) rather than trusting ambient env for defense demos.
- Browser Lab calls must stay same-origin `/api/...` through nginx — cross-origin `VITE_API_BASE_URL` without CORS fails fetch.

## L-029 — Domain evaluation ≠ Vitest ≠ historical OpenAI (2026-11-15)

- Vitest proves CI regression; Evaluation Lab proves allowlisted domain adapters via HTTP with structured evidence.
- V10/V11 Lab status is `schema_validation`, not NL scenario classification success.
- ADV-08 is `nl_isolation_check` — never market as LLM injection resistance.
- Historical OpenAI metrics belong in a separately labeled panel and must not alter deterministic run totals.
