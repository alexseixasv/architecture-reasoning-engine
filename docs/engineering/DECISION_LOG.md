# Decision Log

Append-only record of meaningful engineering decisions. Final submission also consolidates into `DECISIONS.md` (Phase 8).

## D-001 — Adopt NestJS / TypeScript / Postgres stack (2026-11-14)

- **Context:** PDF §8 allows any stack; production stack is TS/NestJS/Drizzle/Postgres/OTel/Next.
- **Decision:** Use NestJS + strict TypeScript + PostgreSQL + Drizzle (from Phase 2) + Vitest + Zod. No frontend.
- **Alternatives rejected:** Python/FastAPI (weaker alignment with panel stack); Express-only (less structure for interview navigation).
- **Consequences:** Faster interviewer familiarity; Nest DI must not leak into pure simulation module.

## D-002 — Closed-form analytical engine (2026-11-14)

- **Context:** PDF §4 allows closed-form, Monte Carlo, or discrete-event.
- **Decision:** Closed-form analytical formulas only for the 15h budget.
- **Alternatives rejected:** Monte Carlo / DES (harder to hand-verify in defense).
- **Consequences:** Document limits honestly in MODEL.md; refuse unsupported stochastic claims.

## D-003 — Postgres in Compose from Phase 1 (2026-11-14)

- **Context:** Persistence is Phase 2, but REQ-120 requires clean-machine Compose.
- **Decision:** Compose runs `api` + `postgres` in Phase 1; no application tables until Phase 2.
- **Consequences:** Early reproducibility proof; empty DB until migrations land.

## D-004 — Defer Ollama Compose service to Phase 5 (2026-11-14)

- **Context:** Zero-cost LLM is required later (REQ-111); model weights complicate Phase 1 bootstrap.
- **Decision:** Document LLM env placeholders in `.env.example`; do not start Ollama in Phase 1 Compose.
- **Consequences:** Phase 1 `docker compose up` stays reliable without GPU/model download.

## D-005 — Version-controlled TECHNICAL_REQUIREMENTS.md (2026-11-14)

- **Context:** PDF lives outside the repo; agents need durable requirement IDs.
- **Decision:** Extract PDF into `docs/specification/TECHNICAL_REQUIREMENTS.md` with REQ-IDs and phase mapping.
- **Consequences:** Compound Engineering can cite requirements without inventing scope.

## D-006 — Persistence validity ≠ simulation readiness (2026-11-14)

- **Context:** Anti-patterns (sync cycles, missing timeouts, SPOF) are important but still useful as stored models for correction and partial analysis.
- **Decision:** Only schema/referential ERRORs block persist. Semantic findings are WARNING; readiness gaps are MISSING_INFORMATION. Phase 3 decides scenario answerability.
- **Alternatives rejected:** Rejecting persist on any WARNING (too strict for incomplete real descriptions).
- **Consequences:** Incomplete/anti-pattern models remain inspectable; engine must not treat stored ≈ answerable.

## D-007 — Preserve contradictory candidate values (2026-11-14)

- **Context:** Real prose often conflicts (“4 replicas” vs “6 instances”).
- **Decision:** `fieldConflicts` / `document.conflicts` store multiple `Quantity` candidates with provenance; never auto-pick.
- **Alternatives rejected:** Last-write-wins; knowledge-graph reconciliation.
- **Consequences:** Manual correction is required before trusting that field in Phase 3.

## D-008 — Explicit capacityAggregation (2026-11-14)

- **Context:** DB read replicas must not inflate write capacity.
- **Decision:** Node field `capacityAggregation: sum_replicas | primary_only | unknown`. Helper `nominalCapacityRps` refuses when unspecified/unknown.
- **Alternatives rejected:** Always `replicas × capacityPerReplica`.
- **Consequences:** Phase 3 must gate capacity math on this policy.

## D-009 — Optimistic concurrency on architecture updates (2026-11-14)

- **Context:** Concurrent manual corrections could clobber versions.
- **Decision:** `PUT` requires `expectedVersion`; transactional compare-and-set on `architectures.latest_version`; unique `(architecture_id, version)`; HTTP 409 on conflict.
- **Alternatives rejected:** Last-write-wins without version check.
- **Consequences:** Clients must re-read after 409.

## D-010 — Deterministic identity-based diffs (2026-11-14)

- **Context:** JSONB array order is not semantic.
- **Decision:** Diff by stable entity ids; ignore reorder; sort changes by `(entityType, id, path, kind)`.
- **Alternatives rejected:** Index-based array diffs; third-party deep-diff dependency.
- **Consequences:** Reorders produce empty diffs; field edits remain visible.

## D-011 — Multi-path load accumulation (2026-11-15)

- **Context:** Single-edge `λ_to = λ_from * f` under-counts shared downstreams.
- **Decision:** Accumulate known sync inbound contributions; omit missing fan-out (never as zero); refuse exact node load if incomplete; async excluded; cycles refuse fixed-point.
- **Alternatives rejected:** Assign full system λ to every node; invent requestsPerParent=1.
- **Consequences:** Fixtures must declare fan-out; shared DB tests use gateway fan-out.

## D-012 — Failure exposure taxonomy (2026-11-15)

- **Context:** Reachability ≠ proven unavailability; fallback may exist off-model.
- **Decision:** Labels `unavailable` (direct only), `sync_failure_exposed`, `sync_transitively_exposed`, `async_dependent`, `unaffected` + paths + `NO_IMPLIED_FALLBACK`.
- **Alternatives rejected:** Auto-mark transitive callers degraded/down.
- **Consequences:** Honest blast-radius language for interviews.

## D-013 — Refuse E2E latency; timeout per edge only (2026-11-15)

- **Context:** Ordering/concurrency not explicit in Phase 2 model.
- **Decision:** F-LAT-001 only; refuse E2E; no concurrencyGroup inference.
- **Alternatives rejected:** Infer sequential/parallel from group ids.
- **Consequences:** Latency answers are timeout-centric.

## D-014 — Retry attempts vs attempt-rate honesty (2026-11-15)

- **Context:** Max retries are not measured RPS; backoff affects timing.
- **Decision:** Always allow `A_max` count; attempt-rate upper bound only if backoff `none` + known edge load, unit `attempts_per_s`; refuse expected/observed attempts.
- **Alternatives rejected:** Blind λ×A_max as successful RPS across the graph.
- **Consequences:** PDF-like “1240” must be framed as attempt-rate upper bound when justified.

## D-015 — Strong golden oracles independent of simulate (2026-11-15)

- **Context:** Weak “metric present” asserts can hide wrong math; copying engine output into expected.json creates circular proof.
- **Decision:** Phase 4 goldens assert complete metric sets (id/value/unit/formulaId), unexpected metrics, refusals, status, saturations, impacts/paths, and evidence. Oracles hand-derived in `DERIVATION.md` first.
- **Alternatives rejected:** Snapshot-from-simulate as source of truth; presence-only checks.
- **Consequences:** Engine defects must be fixed in Phase 3 code, not by weakening expectations.

## D-016 — Validation pairs prepare NL without claiming extraction accuracy (2026-11-15)

- **Context:** REQ-090–096 need a dataset, but LLM arrives in Phase 5.
- **Decision:** Ship V01–V12 with NL + formal model + expected scenario/sim or documented unsupported-NL outcome; mark extraction accuracy **NOT MEASURED** in `VALIDATION.md`.
- **Alternatives rejected:** Fabricating accuracy %; inventing unsupported scenario schema types for availability%/p95.
- **Consequences:** Phase 7 can measure extraction against the same fixtures.

## D-017 — OpenAI as primary LLM provider (2026-11-15)

- **Context:** ENG-004 preferred Ollama zero-cost default; product choice for this case is OpenAI with a local API key.
- **Decision:** Primary live provider is OpenAI via official SDK Responses API + Structured Outputs; default model `gpt-4.1` (`OPENAI_MODEL`). Offline/CI uses `LLM_PROVIDER=fake`. Client `maxRetries: 0`.
- **Alternatives rejected:** Ollama-first for Phase 5 demos; Chat Completions JSON mode without Structured Outputs; uncontrolled SDK retries.
- **Consequences:** REQ-111 satisfied by Fake provider for zero-cost CI; live eval is opt-in (`RUN_LIVE_OPENAI=1`).

## D-018 — Extraction DTO + provenance excerpts (2026-11-15)

- **Context:** Domain `ArchitectureDocument` is too strict / policy-rich for direct LLM emission; invented “declared” values are unsafe.
- **Decision:** LLM emits a dedicated extraction DTO; mapper builds the domain document. Every declared numeric quantity requires a `sourceExcerpt` that must appear verbatim in the source text or the value is downgraded to `unknown` with `PROVENANCE_UNVERIFIED`.
- **Alternatives rejected:** Direct ArchitectureDocument Structured Outputs; trusting LLM provenance without verification.
- **Consequences:** Conflicts keep independent candidates; silent invention is harder.

## D-019 — Grounded explanation by ID references, not digit-scan (2026-11-15)

- **Context:** Regex digit-scanning is brittle and still allows wrong qualitative claims.
- **Decision:** LLM returns qualitative statements that reference metric/component/refusal IDs from a deterministic evidence packet; application code alone renders numeric values/units/formulas. Invalid refs or forbidden claim patterns → deterministic Markdown fallback.
- **Alternatives rejected:** Primary digit-scan guards; letting the LLM author numeric result fields.
- **Consequences:** Reference validation constrains claims but does not prove every qualitative sentence true.

## D-020 — Live smoke must exercise true E2E, not fixture substitution (2026-11-15)

- **Context:** First smoke simulated/explained using formal+expected scenario even when live scenario extraction failed, hiding E2E breaks.
- **Decision:** E2E success requires A=PROPOSED and B=OK; simulate+explain use extracted artifacts. On B failure, mark E2E failed; optional formal baseline explain is labeled diagnostic-only.
- **Consequences:** Exit code 3 on E2E failure; sanitized rejection reasons printed.

## D-021 — Separate calculated vs refused metric references in ExplanationDto (2026-11-15)

- **Context:** Smoke #2 explanation failed validation because the model put refused output ids (`availability_percent`, `throughput`, `latency_p95_p99`) into `metricIds`. Those ids are on `SimulationResult.refused[].metricId`, not `metrics[]`. Reason codes are a distinct field (`reasonCode`).
- **Decision:** Add `refusedMetricIds` to each explanation statement. Trusted catalog exposes `availableMetrics` / `refusedOutputs` / `availableComponents` separately. Validator rejects refused ids in `metricIds` and validates `refusedMetricIds` and `refusalCodes` against their own sets. Do not weaken validation or disable deterministic fallback.
- **Alternatives rejected:** Accepting refused ids as calculated metrics; collapsing metricId and reasonCode into one field.
- **Consequences:** Prompt and DTO roles are unambiguous; live re-smoke still required to confirm the model follows the new contract.

## D-022 — HTTP domain outcomes vs provider infrastructure (2026-11-15)

- **Context:** Phase 6 must expose extract/analyze without treating ASK/REFUSE/UNSUPPORTED as server faults.
- **Decision:** `NEEDS_CLARIFICATION`, `UNSUPPORTED`, `NOT_ANSWERABLE`, `PARTIALLY_ANSWERED`, and explanation `deterministic_fallback` return **HTTP 200** with explicit domain fields. Provider timeout/unavailable/config → **503**. Oversized/invalid request → **400**. OCC → **409**. Extract never auto-persists. Analyze loads the exact path version only.
- **Alternatives rejected:** Mapping domain refusals to 4xx/5xx; silent latest-version substitution; global mutable usage for HTTP.
- **Consequences:** Clients must read `scenarioExtraction.status` / `simulation.status` / `explanation.source`, not only HTTP codes.

## D-023 — Request-scoped UsageCollector for HTTP (2026-11-15)

- **Context:** Process-global usage array mixes concurrent requests.
- **Decision:** HTTP orchestration creates a `UsageCollector` per request and passes it into extract/scenario/explain. Scripts/tests may still use the global fallback via `recordUsage` without a collector.
- **Alternatives rejected:** Shared global buffer for Nest handlers; full OpenTelemetry collector dependency for Phase 6.
- **Consequences:** Response `usage` + `timingsMs` satisfy REQ-110/112 without external observability infra.

## D-024 — Fake demo handlers only via createLlmProvider (2026-11-15)

- **Context:** Compose with `LLM_PROVIDER=fake` must exercise extract/analyze HTTP without OpenAI; bare `FakeLlmProvider` fail-closed breaks Compose acceptance.
- **Decision:** `createLlmProvider('fake')` installs deterministic demo handlers. Unit/HTTP tests that need fail-closed or custom fixtures use `new FakeLlmProvider()` / overrides.
- **Alternatives rejected:** Requiring OpenAI for Compose smoke; changing default bare Fake to always succeed.
- **Consequences:** Zero-cost Compose path works; offline tests remain explicit.

## D-025 — Semantic eval denominators and live cap (2026-11-15)

- **Context:** REQ-096/113/114 need measured evidence without JSON-equality scoring or unbounded spend.
- **Decision:** Field-level architecture compare counts extras in the denominator; scenario scoring separates intent vs parameters (10 structured + 2 unsupported). Live eval hard-capped at **34** provider calls with preflight USD estimate. Cost buckets A (full), B (persisted), C (early-terminal). Wrong extracted scenario is classified as extraction failure, never engine defect.
- **Alternatives rejected:** Raw document JSON equality as primary metric; running live eval without approval; inventing $0 when pricing missing.
- **Consequences:** Offline harness ships first; live tables remain NOT MEASURED until approved run.

## D-026 — Latency percentiles are request timings (2026-11-15)

- **Context:** REQ-114 asks for p50/p95; architecture model also refuses p95 metrics.
- **Decision:** Report application/provider wall-clock percentiles from `performance.now()` samples; never label them as modeled architecture latency.
- **Consequences:** VALIDATION.md must state sample size N and linear-interpolation method.

## D-027 — Post-live remediation without claiming new accuracy (2026-11-15)

- **Context:** First V01–V12 live pass measured 120/235 field accuracy; diagnosis approved remediation of prompts/diagnostics only.
- **Decision:** Keep the original live artifact and baseline numbers unchanged. Improve prompts, conflict-level scoring, and sanitized A/B/C/D diagnostics offline. Do not hardcode V01–V12 ids. Do not suppress legitimate conflicts to match fixtures. Do not run a second live pass or claim improved accuracy until explicitly approved and remeasured.
- **Alternatives rejected:** Overwriting the baseline artifact; changing expected fixtures/denominators to raise scores; fuzzy id matching that hides invented components.
- **Consequences:** Second controlled live evaluation is required to measure remediation impact.

## D-028 — Second live pass is remediation regression, not generalization (2026-11-15)

- **Context:** Offline remediation completed; one additional approved V01–V12 live pass executed (34 calls).
- **Decision:** Treat the second artifact as a **same-dataset remediation regression**. Preserve baseline metrics and artifact forever. When conflict-scoring rows change the field-accuracy denominator, disclose the caveat and lean on P/R/F1, quantity-state, scenario/unsupported, and conflict-level metrics for comparison.
- **Alternatives rejected:** Replacing baseline numbers; presenting the second pass as a new independent benchmark; further live retries without approval.
- **Consequences:** VALIDATION.md carries both tables; Phase 7 can close with documented residual limitations.

## D-029 — Phase 7 closed with honest README (2026-11-15)

- **Context:** Closure approved subject to README modernization and regression verification.
- **Decision:** Rewrite root README from implemented controllers/Compose/env/eval evidence only. Link existing docs (`DECISION_LOG`, not a missing `DECISIONS.md`). Do not invent `NOT_DONE.md`. Mark Phase 7 complete after Fake Compose smoke + offline suite green.
- **Alternatives rejected:** Marketing accuracy claims; dead doc links; starting Phase 8 without approval.
- **Consequences:** Evaluators can run Fake Compose and understand measured live caveats from README → VALIDATION.md.

## D-030 — Compose web via nginx same-origin /api (2026-11-15)

- **Context:** Phase 8.2 needs a browser-served SPA without enabling broad Nest CORS or baking LLM secrets into the frontend image.
- **Decision:** Multi-stage `frontend/Dockerfile` (Vite build → nginx). nginx serves the SPA (`try_files`), proxies `/api/` → `api:3000/` (strip prefix), and forwards `/health`. Default `WEB_PORT=8080`. Demo remains `LLM_PROVIDER=fake`.
- **Alternatives rejected:** Browser CORS to `:3000`; embedding OpenAI keys in the web image; client-side metric math.
- **Consequences:** Acceptance can exercise the real nginx path; Vite keeps a matching `/api` rewrite for local dev.

## D-031 — OCC 409 never auto-retries (2026-11-15)

- **Context:** Optimistic concurrency must preserve reviewer edits and never silently overwrite.
- **Decision:** UI tracks `expectedVersion` as the version the user began editing. On HTTP 409, keep the editor draft, surface conflict metadata (`expectedVersion` / `actualVersion`), and offer an explicit “reload latest” that discards the draft. Never retry PUT with a bumped `expectedVersion`.
- **Alternatives rejected:** Auto-merge; silent overwrite; automatic retry with latest version.
- **Consequences:** Stale saves fail loudly; immutable prior versions remain intact.

## D-032 — Phase 8.3 closes with honest PARTIAL REQs (2026-11-15)

- **Context:** Final docs must not pretend availability % or OTel collectors exist.
- **Decision:** Ship root `DECISIONS.md` / `MODEL.md` / `VALIDATION.md` / `NOT_DONE.md` + defense pack. Mark REQ-003 and REQ-110 as PARTIAL in the coverage matrix. Preserve both live OpenAI artifacts’ numbers without new paid runs. Canonical formulas live only in root `MODEL.md`.
- **Alternatives rejected:** Inventing availability math to green REQ-003; re-running live eval for prettier tables; duplicate conflicting MODEL drafts.
- **Consequences:** Phase 8 can close for defense readiness while remaining honest about limits.

## D-033 — Evaluation Lab is opt-in, in-process, allowlisted (2026-11-15)

- **Context:** Interviewers need a live deterministic evaluation report without shelling out to Vitest or calling OpenAI from HTTP.
- **Decision:** Nest `EvaluationModule` invokes `simulate`/schema adapters over a fixed suite catalog. Gate with `EVAL_LAB_ENABLED=1` (default off; Dockerfile sets `0`). Synchronous HTTP only; no DB writes, no `child_process`, no user-supplied paths. Extract Vitest-free `compareGoldenResult` for shared semantics. Ship sanitized historical summaries under `src/evaluation/historical/` (raw `artifacts/` stay gitignored).
- **Alternatives rejected:** Running `npm test` from the API; WebSockets/queues/run persistence; enabling Lab in base Compose; mixing historical LLM metrics into run pass/fail totals; claiming ADV-08 proves LLM prompt-injection resistance.
- **Consequences:** Demo Compose override turns Lab on safely; production images stay gated even if the SPA still shows the nav link.

## D-034 — Demo Compose override forces Fake + Lab (2026-11-15)

- **Context:** A local `.env` with `LLM_PROVIDER=openai` broke Compose API startup during Phase 9.3 verification.
- **Decision:** Keep base `docker-compose.yml` without Lab and with `${LLM_PROVIDER:-fake}`. Add `docker-compose.demo.yml` that sets `EVAL_LAB_ENABLED=1` **and** `LLM_PROVIDER=fake` so demos ignore accidental OpenAI env. Document both start commands in README/DEMO.
- **Alternatives rejected:** Enabling Lab in the base compose file; relying on operator memory to unset OpenAI; broad Nest CORS for the Lab.
- **Consequences:** `docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build` is the Evaluation Lab demo path; default compose remains Lab-disabled.

## D-035 — Live checkout-pricing Fake path + honest presentation note (2026-11-16)

- **Context:** Live defense paste of checkout/pricing/Postgres + “Postgres latency +2s” failed under Compose Fake (hollow `api`-only extract; no live findings; question mixed into architecture text).
- **Decision:** Extend Fake handlers for that fixture; FE peels trailing questions, seeds extract findings, debounces `POST /architectures/validate`; document the prior live failure and required Path B in `PRESENTATION.md` / `DEMO.md`. Pass `OPENAI_API_KEY` through Compose; lengthen nginx `/api` timeouts.
- **Alternatives rejected:** Pretending the short API demo was enough for live proof; inventing availability % from “95% actual”.
- **Consequences:** Rebuild `api` + `web` for the fix; Fake still ≠ OpenAI generalization.
