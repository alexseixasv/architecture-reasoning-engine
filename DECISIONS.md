# DECISIONS.md — Architecture Reasoning Engine

**Purpose:** Defend the forks we took. Full chronology lives in [`docs/engineering/DECISION_LOG.md`](docs/engineering/DECISION_LOG.md).  
**Page-size assumption:** ~500 words/page, prose body ≈ 3.5–4 pages at standard manuscript density (this file is intentionally dense; ≤4 pages intent).

---

## 1. System architecture and boundaries

**Stack:** Node.js LTS, TypeScript (strict), NestJS HTTP API, PostgreSQL + Drizzle, Zod, Vitest, Docker Compose, Vue 3 SPA (nginx).

**Modules**

| Layer | Role | Must not |
| --- | --- | --- |
| `src/simulation` | Pure `simulate(architecture, scenario)` | Import Nest, Drizzle, HTTP, LLM SDKs |
| `src/architecture` | Schema, validate, persist, diff, OCC | Invent numbers |
| `src/llm` | Extract / classify scenario / explain | Compute architecture metrics |
| `src/analysis` | Orchestrate extract → persist path → simulate → explain | Duplicate formulas in Vue |
| `frontend/` | Thin browser client over HTTP | Recompute util/load/capacity |

**Compose:** `postgres` → `api:3000` → `web` nginx (`WEB_PORT=8080`) with same-origin `/api/` proxy (prefix stripped). Default `LLM_PROVIDER=fake`. No broad Nest CORS.

---

## 2. LLM interpretation vs deterministic computation

**Non-negotiable (REQ-010–012):** every architecture number in answers comes from typed engine code or real measurements — never from free-text LLM arithmetic.

LLM roles only:

1. Map prose → structured extraction DTO (Structured Outputs).
2. Map question → scenario DTO (`load_multiplication` | `latency_degradation` | `component_unavailable` | unsupported / needs clarification).
3. Narrate **already computed** engine evidence with citation validation; invalid claims → deterministic fallback.

**Rejected:** “Ask the model for utilization”; embedding calculators in prompts; trusting explanation numbers without grounding.

---

## 3. Formal model, Zod, provenance, unknowns

The formal model is a first-class versioned artifact (REQ-030): nodes (`service|datastore|queue`), sync/async dependencies, timeouts/retries/backoff, capacity + `capacityAggregation`, ingress traffic, assumptions, conflicts/`fieldConflicts`.

Quantities are `known | unknown` with **units** and **provenance** (`declared|user_confirmed|assumed|computed`). Missing data is never silently defaulted to zero. Contradictions keep candidates; the engine refuses conflicted capacity fields rather than picking a winner.

Validation = Zod schema + semantic findings (sync cycles, missing timeouts, retries without backoff, SPOF, graph >15). Schema ERRORs block persist; many semantic issues are WARNINGs so incomplete models remain inspectable (D-006).

---

## 4. Supported scenarios and refusals

Closed-form, steady-state, ≤15 nodes (ENG-002 / REQ-070–071). Core scenarios only (REQ-060–062): load×N, latency degradation, component unavailable.

**Computed when inputs allow:** offered load, utilization, saturation, timeout violation flags, max attempts, attempt-rate upper bound (backoff=`none` only), failure-exposure labels/paths.

**Always refused:** availability %, successful throughput, p95/p99, expected/observed attempt counts, invented E2E latency. Incomplete graphs → `NOT_ANSWERABLE` / `PARTIALLY_ANSWERED` with reason codes. Assumptions used at runtime are listed (e.g. `ASSUME_SINGLE_INGRESS`).

**Rejected:** Monte Carlo / DES (harder to hand-verify in 15h); queueing beyond utilization.

---

## 5. Persistence, versioning, OCC, Postgres

Immutable versions; `PUT` requires `expectedVersion`; conflict → HTTP 409 with expected/actual; prior versions remain readable. Semantic diff by entity id (not array index). Manual correction creates a new version without re-extracting prose (REQ-022/031).

**Postgres + Drizzle:** durable multi-version history and transactional OCC. **Rejected:** in-memory-only store for the submission (fails Compose reproducibility and interview inspection); last-write-wins updates.

---

## 6. OpenAI Structured Outputs, grounding, Fake LLM

Production path: OpenAI Responses API + JSON schema Structured Outputs (`gpt-4.1` in measured runs). Retries hardcoded to 0; timeouts configurable. Explanation packets cite engine metric IDs; validator rejects unsupported numeric claims.

**Fake provider:** deterministic offline Compose/demo/CI. Demonstrates contracts and wiring — **not** extraction accuracy on unseen prose. Live OpenAI accuracy is reported separately in `VALIDATION.md` (fixed V01–V12 set; scenario scoring used formal architecture context).

---

## 7. Vue frontend and nginx

Optional relative to the PDF (REQ-146), shipped as a **thin** workspace: extract → review/validate → explicit persist → analyze → diff → OCC conflict UX. No client-side metric math. Vite and nginx both rewrite `/api` → Nest. Secrets never baked into the web image.

**Rejected:** Next.js for the case budget; enabling broad CORS instead of same-origin proxy.

---

## 7b. Evaluation Lab (opt-in)

Deterministic allowlisted G01–G12 / V01–V12 / ADV-01–08 over HTTP (`src/evaluation`), gated by `EVAL_LAB_ENABLED` (default off). Adapters call `simulate`/schema in-process — **no** Vitest spawn, **no** OpenAI, **no** DB writes. Historical OpenAI metrics are sanitized summaries only and never affect run totals. Demo Compose override forces Fake + Lab on.

**Rejected:** Shelling `npm test` from the API; enabling Lab in base Compose; mixing historical LLM scores into deterministic pass/fail.

---

## 8. Observability tradeoff

API returns `usage` (tokens/cost when priced) and `timingsMs` per stage. Full OpenTelemetry collector/export was deferred (budget). Measured p50/p95 exist for live eval with **N=12** — request timings, not architecture latency SLOs.

---

## 9. What breaks at ~10×

| Stress | Break mode |
| --- | --- |
| Graphs ≫15 | Rejected/flagged; formulas not retuned for huge topologies |
| Missing fan-out / multi-ingress without split | Load math refuses rather than guessing |
| Stochastic availability / queues | Explicit refuse |
| Concurrent editors | OCC 409 — clients must reload; no auto-merge |
| High OpenAI latency/cost | p95 already noisy at N=12; no retries amplify spend |
| Unseen NL extraction | Field accuracy ~58% on remediation set; ID slugs and DTO omissions remain |

---

## 10. Alternatives rejected (summary)

Monte Carlo; inventing availability %; persist-on-extract; client-side simulation; last-write-wins; Fake scores as OpenAI accuracy; OTel collector in Phase 6; hardcoding V01–V12 component ids in prompts.
