# Phases

Eight stop-gated phases. Mark requirements complete only with implementation + verification evidence.

| Phase | Name | Status |
| --- | --- | --- |
| 1 | Foundation and engineering rules | complete |
| 2 | Formal model and persistence | complete |
| 3 | Deterministic simulation engine | complete |
| 4 | Golden tests, validation dataset & mathematical correctness | complete |
| 5 | OpenAI LLM integration, structured extraction & grounded reasoning | complete (pending human review) |
| 6 | API and observability | pending |
| 7 | Validation and benchmarking | pending |
| 8 | Documentation and interview preparation | pending |

---

## Phase 1 — Foundation and engineering rules

### Goals

- Extract and version case requirements.
- Bootable NestJS API + PostgreSQL via Docker Compose.
- Strict TypeScript, Vitest, lint, `.env.example`, lockfile.
- Compound Engineering memory (`AGENTS.md`, engineering docs).

### Requirement IDs

| ID | Intent in Phase 1 | Complete? |
| --- | --- | --- |
| REQ-120 | Compose starts on clean machine (foundation) | yes — evidence below |
| REQ-121 | `.env.example` present | yes — file committed |
| REQ-122 | Stack choice documented | yes — DECISION_LOG D-001 / TECH_REQ ENG-001 |
| REQ-130 | Service runnable via Compose (partial; full API later) | yes (partial) — `/health` via Compose |

Related process (not PDF): ENG-001–ENG-007, AGENTS Compound Engineering rules.

### Acceptance criteria

1. `docs/specification/TECHNICAL_REQUIREMENTS.md` exists with REQ-IDs and traceability matrix.
2. `AGENTS.md` requires reading the spec and updating engineering memory each phase.
3. `npm run build`, `typecheck`, `test`, and `lint` succeed.
4. `docker compose up --build` starts API + Postgres; `GET /health` succeeds.
5. No formal model schema, simulation, or LLM integration code beyond placeholders env docs.

### Verification evidence

Recorded 2026-11-14 (local Windows + Docker Desktop 27.3.1 / Compose v2.29.7):

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | exit 0 — 1 passed (`tests/unit/health.controller.spec.ts`) |
| `npm run build` | exit 0 |
| `docker compose up --build -d` | exit 0 — `api` Up, `postgres` healthy |
| `curl http://localhost:3000/health` | `{"status":"ok","service":"architecture-reasoning-engine","version":"0.1.0",...}` |

Notes:

- Application tables / Drizzle migrations: not in Phase 1 (Postgres only proves connectivity readiness).
- `npm audit` during image `npm ci` reported transitive advisories in the full install set; runtime image after `npm prune --omit=dev` reported 0 vulnerabilities.
- `.env` created locally from `.env.example` for Compose; not committed.

### Suggested commit

`chore: bootstrap foundation with requirements spec and nestjs compose`

---

## Phase 2 — Formal model and persistence

### Goals

- Versioned `ArchitectureDocument` with units, provenance, conflicts, capacity aggregation.
- Schema + referential ERROR vs semantic WARNING vs simulation-readiness MISSING_INFORMATION.
- Immutable Postgres versions (Drizzle JSONB), OCC via `expectedVersion`, deterministic diffs.
- Manual create/update/validate/inspect/diff APIs without LLM.

### Requirement IDs

| ID | Intent in Phase 2 | Complete? |
| --- | --- | --- |
| REQ-022 / REQ-031 | Manual structured create/update without NL extraction | yes — evidence below |
| REQ-030 | Persist, version, inspect, diff | yes |
| REQ-040–042 | Schema + semantic + missing-info findings | yes |
| REQ-070 | Max 15 nodes | yes — ERROR `GRAPH_TOO_LARGE` |
| REQ-050 (partial) | Completeness gaps ASK hints; scenario answerability deferred | yes (partial) |
| REQ-161 | Typed abstraction with provenance/units | yes |

### Acceptance criteria

1. Malformed schema / duplicate IDs / bad refs / >15 nodes reject persist.
2. Sync cycle, missing timeout, retry without backoff, SPOF are WARNING and still persist.
3. Field/document conflicts preserved without auto-resolution.
4. `capacityAggregation` explicit; `nominalCapacityRps` respects `primary_only` vs `sum_replicas`.
5. Updates require `expectedVersion`; conflicts return HTTP 409 / `VersionConflictError`.
6. Diffs ignore array reorder; field changes deterministic.
7. Unit + Postgres integration tests green; Compose create curl succeeds.

### Verification evidence

Recorded 2026-11-14:

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 (0 errors) |
| `npm test` (unit) | 17 passed |
| `DATABASE_URL=... npm run test:integration` | 3 passed (immutability, semantic persist, concurrent OCC) |
| `npm run build` | exit 0 |
| `docker compose up --build -d` | api Up, postgres healthy |
| `POST /architectures` with checkout-pricing fixture | HTTP 201; findings include CONTRADICTION_PRESENT, RETRY_WITHOUT_BACKOFF, SPOF |

### Suggested commit

`feat: add versioned architecture model with validation and drizzle persistence`

### Limitations carried forward

- Scenario-specific answerability (Phase 3).
- No availability formula yet (OQ-001).
- Extraction change_source arrives in Phase 5.

## Phase 3 — Deterministic simulation engine

### Goals

- Pure `simulate(architecture, scenario)` with evidence, refusals, exposure taxonomy.
- Multi-path load accumulation; timeout checks; honest retry attempt metrics.
- Additive schema: `requestsPerParent`, `ingressNodeIds`.

### Requirement IDs

| ID | Intent | Complete? |
| --- | --- | --- |
| REQ-010–012 | Engine-only numbers + evidence | yes — unit tests |
| REQ-021 / REQ-083 | Structured simulate seam | yes |
| REQ-050–052 | Partial/refuse + assumptions | yes |
| REQ-060–062 | Three scenarios | yes |
| REQ-003 | Timeout/retry/sat/blast; no fake avail % | yes (partial shape) |
| REQ-071–073 | Steady-state closed-form honesty | yes — MODEL.md |
| REQ-032–033 | Formulas documented | yes — draft MODEL.md |

### Verification evidence

Recorded 2026-11-15:

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | 35 passed (incl. 17 simulation; review added incomplete-inbound + healthy-no-amp) |
| `npm run test:integration` | 3 passed (Postgres) |
| `npm run build` | exit 0 |

### Suggested commit

`feat: add deterministic simulation engine for unavailable latency and load scenarios`

### Limitations

- No E2E latency; no availability %; no throughput; golden suite docs → Phase 4; no Nest simulate route yet.

## Phase 4 — Golden tests, validation dataset & mathematical correctness

### Goals

- Strong golden suite G01–G12 with independent hand oracles (`DERIVATION.md`).
- Executable validation pairs V01–V12 (schema + simulate where supported).
- Adversarial ADV-01–08 deterministic boundaries.
- Root `VALIDATION.md` with denominators; extraction accuracy explicitly NOT MEASURED.

### Requirement IDs

| ID | Intent | Complete? |
| --- | --- | --- |
| REQ-080 | ≥8 hand-derivable goldens | yes — 12 cases |
| REQ-081 | Hand derivation in repo | yes — per-case `DERIVATION.md` |
| REQ-082 | Offline deterministic suite | yes — Vitest, no live LLM |
| REQ-083 | Extraction/computation seam | yes — NL fixtures separate from `simulate()` |
| REQ-090–095 | Validation dataset prep | yes (prepared); measured accuracy deferred to Phase 7 |
| REQ-096 | Extraction accuracy report | deferred — documented NOT MEASURED |

### Verification evidence

Recorded 2026-11-15 — see root `VALIDATION.md` for full tables.

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | exit 0 — **69** passed (unit 35 + golden 13 + validation 13 + adversarial 8) |
| `npm run test:integration` | exit 0 — **3** passed (Compose Postgres) |
| `npm run build` | exit 0 |

### Suggested commit

`test: add golden validation and adversarial suites for simulation correctness`

### Limitations

- No LLM; extraction accuracy NOT MEASURED.
- Phase 5+ not started.

## Phase 5 — OpenAI LLM integration, structured extraction & grounded reasoning

### Goals

- OpenAI Responses API + Structured Outputs behind `LlmProvider` (`openai` | `fake`).
- Architecture/scenario extraction DTOs → domain Zod + validate; provenance excerpt verification.
- Grounded explanation via evidence IDs + deterministic numeric rendering + fallback.
- Offline FakeLlmProvider tests; opt-in live V01–V12 eval (not run in CI).

### Requirement IDs

| ID | Intent | Complete? |
| --- | --- | --- |
| REQ-012 | LLM extracts/explains; does not calculate | yes — offline tests |
| REQ-020 | Formal model from free text | yes — extract pipeline |
| REQ-021 (partial) | Question → scenario → simulate → explain | yes (library; HTTP Phase 6) |
| REQ-010/011 | No LLM numbers in answers | yes — evidence renderer |
| REQ-100 | Untrusted architecture/questions | yes — delimiters + ADV-style tests |
| REQ-111 | Zero-cost path | yes — `LLM_PROVIDER=fake` |
| REQ-123 | Provider abstraction | yes — `LlmProvider` |
| REQ-096 | Extraction accuracy | partial — live smoke only; full V01–V12 **NOT MEASURED** |

### Verification evidence

Recorded 2026-11-15:

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | exit 0 — **110** passed (includes smoke #2 explanation regression A–E) |
| `npm run test:integration` | exit 0 — **3** passed |
| `npm run build` | exit 0 |
| Live OpenAI smoke #1 (V01, 3 calls) | partial — A OK; B intent miss; C fallback (pre-fix) |
| Live OpenAI smoke #2 (V01, 3 calls, post-fix) | A **PROPOSED**; B **`load_multiplication`×1 OK**; sim **ANSWERED**; explain **fallback** (refused ids in `metricIds`); `e2eSuccess=false`; est. **~$0.012**; details in `VALIDATION.md` |
| Offline explanation contract fix (D-021) | DTO `refusedMetricIds` + separated catalog + strict validator; smoke #2 misclassification reproduced offline |
| Live OpenAI smoke #3 (V01, 3 calls, post D-021) | A **PROPOSED** (1 node); B **`load_multiplication`×1 OK**; sim **ANSWERED** (3 metrics, 3 refusals); explain **`llm+deterministic`**, **fallback=false**; **`e2eSuccess=true`**; est. **~$0.01422**; wall **~10.2 s**; details in `VALIDATION.md` |
| Live full V01–V12 eval | **NOT RUN** |

### Suggested commit

`fix: separate refused vs calculated metric refs in grounded explanation`

### Limitations

- No public HTTP extract/simulate/explain routes (Phase 6).
- Live smoke proves one V01 E2E path; full extraction accuracy (REQ-096 denominators) **NOT MEASURED**.
- Ollama Compose service still not started.

## Phase 6 — API and observability

Pending. Primary REQs: REQ-001–002, REQ-110, REQ-112, REQ-130.

## Phase 7 — Validation and benchmarking

Pending. Primary REQs: REQ-090–098, REQ-113–114.

## Phase 8 — Documentation and interview preparation

Pending. Primary REQs: REQ-131–135, REQ-150–153, REQ-172.
