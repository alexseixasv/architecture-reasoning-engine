# Phases

Eight stop-gated phases. Mark requirements complete only with implementation + verification evidence.

| Phase | Name | Status |
| --- | --- | --- |
| 1 | Foundation and engineering rules | complete |
| 2 | Formal model and persistence | complete |
| 3 | Deterministic simulation engine | complete |
| 4 | Golden tests, validation dataset & mathematical correctness | complete |
| 5 | OpenAI LLM integration, structured extraction & grounded reasoning | complete |
| 6 | API and observability | complete |
| 7 | Validation and benchmarking | complete (pending human review of live results) |
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


### Limitations

- Live smoke proves one V01 E2E path; full extraction accuracy (REQ-096 denominators) **NOT MEASURED**.
- Ollama Compose service still not started.

## Phase 6 — API and observability

### Goals

- HTTP orchestration: extract (no auto-persist) → review → persist → analyze exact version.
- Reuse Phase 2 persistence/OCC/diff and Phase 3–5 simulate/LLM libraries.
- Request-scoped usage accounting; domain outcomes on HTTP 200; provider infra → 503.
- Structured stage timings + usage in responses; no external OTel collector.

### Requirement IDs

| ID | Intent | Complete? |
| --- | --- | --- |
| REQ-001 | E2E analysis endpoint with engine metrics | yes — `POST .../analyze` |
| REQ-002 | Free-text + question path | yes — extract + analyze |
| REQ-021 | Question → simulate → explain | yes — HTTP |
| REQ-022 / 030 / 031 | Corrected formal model without re-NL | yes — existing CRUD + analyze by version |
| REQ-051 / 052 | Assumptions + NOT_ANSWERABLE visible | yes — simulation payload on 200 |
| REQ-110 | Per-request stage latency / usage | yes — `timingsMs` + `usage` (no OTel collector) |
| REQ-112 | Tokens per analysis | yes — response `usage` |
| REQ-120 / 130 | Compose API runnable | yes — `/health` + new routes; `LLM_PROVIDER=fake` default |

### Verification evidence

Recorded 2026-11-15:

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | exit 0 — **120** passed |
| `npm run test:integration` | exit 0 — repo **3** + HTTP **9** |
| `npm run test:http` | exit 0 — **9** passed (Fake LLM) |
| `npm run build` | exit 0 |
| Live OpenAI via HTTP | **NOT RUN** (CI/default Fake only) |
| `docker compose up -d --build` + HTTP acceptance | **PASS** — `LLM_PROVIDER=fake`, `OPENAI_API_KEY` unset in api; extract→persist→analyze v1; OCC v2 then re-analyze v1 still `architectureVersion=1`; 404/400/UNSUPPORTED domain 200; details in `VALIDATION.md` |


### Limitations

- No auth, multitenancy, UI, RAG, or external observability stack.
- `changeSource` is client-declared metadata only (not proof of human approval).
- Compose Fake uses built-in demo handlers via `createLlmProvider` (tests that use `new FakeLlmProvider()` remain fail-closed).
- REQ-096 dataset-scale accuracy still **NOT MEASURED** (Phase 7).

## Phase 7 — Validation and benchmarking

**Status: COMPLETE** (closed 2026-11-15 after README modernization + regression verification).

### Goals

- Semantic architecture/scenario scoring with explicit denominators.
- Golden G01–G12 consolidation report (offline).
- Cost projections A/B/C and latency p50/p95 methodology.
- Opt-in live OpenAI runner (cap 34) with measured baseline + remediation regression artifacts.

### Requirement IDs

| ID | Intent | Complete? |
| --- | --- | --- |
| REQ-090–095 | Dataset V01–V12 prepared + tagged | yes (offline) |
| REQ-096 | Extraction accuracy measured | **yes (dataset)** — baseline 120/235; remediation regression 141/244 (denom. caveat); scen 10/10; unsup 2/2 |
| REQ-097 | Answer correctness | yes offline + live sim OK when scenario OK |
| REQ-098 | Failure analysis | yes — baseline + 2nd-pass diagnostics (DTO missing, V10 fixed, V12 fieldConflicts, V07 fallback code) |
| REQ-113–114 | Cost/1k + p50/p95 | **measured** two passes (see VALIDATION.md) |

### Verification evidence

Recorded 2026-11-15:

| Check | Result |
| --- | --- |
| `npm run typecheck` / `lint` / `build` | exit 0 |
| `npm test` | exit 0 — **138** passed (includes eval unit + golden summary) |
| `npm run test:integration` | exit 0 — **12** |
| Live OpenAI V01–V12 eval (1 pass) | **34/34** calls; arch field 120/235; scen 10/10 + unsup 1/2; explain 9/10 grounded; est. **~$0.186**; wall p50/p95 **7.97s/11.0s** (N=12); artifact gitignored |


### Limitations

- Scenario live scoring used **formal** architecture context — not end-to-end extract→scenario chaining.
- Architecture field accuracy remains weak (id extras + known→unknown).
- p95 with N=12 is statistically weak.
- Estimated USD ≠ invoice.
- Live baseline frozen; second pass is remediation regression on the same dataset (not a generalization benchmark).

### Remediation after live diagnosis (offline, 2026-11-15)

| Check | Result |
| --- | --- |
| Baseline artifact overwritten? | **No** — `run-2026-11-15T13-40-00-172Z.json` preserved |
| Live OpenAI this step | **NOT RUN** (offline only) |
| `npm test` | exit 0 — **157** passed (Fake LLM only) |
| Prompt / mapper / diagnostics / tests | Implemented (see VALIDATION.md) |

### Second live pass — remediation regression (2026-11-15)

| Check | Result |
| --- | --- |
| Baseline SHA256 unchanged | **yes** `2D1CA9C7…CAADBA` |
| Provider calls | **34/34** · model `gpt-4.1` · timeout 60000 · retries 0 |
| Arch field (directional) | **141/244** vs baseline 120/235 (denom. methodology caveat) |
| Node / Dep F1 | **0.86 / 0.84** (baseline 0.83 / 0.74) |
| Unsupported NL | **2/2** (baseline 1/2; V10 fixed) |
| Supported scen | **10/10** |
| Explain grounded | **9/10** (V07 fallback `CLAIM_KIND_MISSING_REFS`) |
| Est. USD / wall p50/p95 | **~$0.203** / **7.6s / 19.8s** (N=12) |
| New artifact | `run-2026-11-15T13-55-04-443Z.json` |
| `npm test` after live | exit 0 — **157** (Fake only; no OpenAI in default tests) |


### Final closure verification (2026-11-15)

| Check | Result |
| --- | --- |
| Root `README.md` modernized for Phases 1–7 | **yes** |
| Doc links / API examples / commands | verified against controllers + `.env.example` + Compose |
| `npm run typecheck` / `lint` / `build` | exit 0 |
| `npm test` | exit 0 — **157** (Fake LLM) |
| `npm run test:integration` | exit 0 — **12** |
| Live OpenAI this step | **NOT RUN** |
| Compose Fake smoke (`compose-http-acceptance.ts`) | **PASS** — extract→persist→analyze; OCC; 404/400/UNSUPPORTED; `openaiCalls: none` |
| Baseline + remediation eval evidence | preserved in `VALIDATION.md` + gitignored artifacts |

### Phase 7 closed

REQ-090–098 and REQ-113–114 have measured evidence. Residual limitations (ID slugs, DTO quantity omissions, V07 explain refs, formal-context scenario scoring, small dataset) remain documented — not reopen blockers. Phase 8 requires explicit approval.


## Phase 8 — Documentation and interview preparation

Primary REQs: REQ-099, REQ-131–135, REQ-150–153, REQ-160–165, REQ-172.

### Phase 8.1 — Frontend foundation

Vue 3 + Vite workspace: extract → review/validate → explicit persist → analyze. Fake demo fixtures. No client-side metric math. Vite `/api` proxy.

### Phase 8.2 — Integration, versioning, Compose web (2026-11-15)

| Check | Result |
| --- | --- |
| Frontend typecheck / lint / build | exit 0 |
| Frontend unit tests | exit 0 — **12** |
| Backend typecheck / lint / build | exit 0 |
| Backend `npm test` | exit 0 — **157** |
| Backend `npm run test:integration` | exit 0 — **12** |
| Compose + nginx Fake acceptance | **PASS** (`compose-frontend-acceptance.ts`) |
| Browser Fake acceptance | **verified** |
| Live OpenAI | **NOT RUN** |

### Phase 8.3 — Final documentation & defense (2026-11-15)

| Deliverable | Status |
| --- | --- |
| Root `DECISIONS.md` | created (≤4 pages intent) |
| Root `MODEL.md` | finalized vs Zod + `simulate()` |
| Root `VALIDATION.md` | restructured A–H; live evidence preserved |
| Root `NOT_DONE.md` | created (≤1 page intent) |
| Root `README.md` | complete app + Compose web |
| Coverage matrix | `docs/engineering/REQUIREMENTS_COVERAGE.md` |
| Defense pack | `docs/defense/{PRESENTATION,DEMO,QA,LIVE_CHANGES}.md` |
| Live OpenAI this phase | **NOT RUN** |

#### Critical REQ honesty

- **REQ-003 PARTIAL** (availability % + quantitative blast radius refused by design) — documented, not silently “fixed.”
- **REQ-110 PARTIAL** (timings/usage without OTel collector) — documented.
- No mandatory deliverable missing; no critical blocker for defense readiness.

### Final verification (Phase 8.3)

| Check | Result |
| --- | --- |
| Backend typecheck / lint / build | exit 0 |
| Backend `npm test` | exit 0 — **157** |
| Backend `npm run test:integration` | exit 0 — **12** |
| Frontend typecheck / lint / build | exit 0 |
| Frontend `npm test` | exit 0 — **12** |
| Compose rebuild + frontend acceptance | **PASS** (nginx `/api`, OCC 409, UNSUPPORTED, diff) |
| Compose API Fake acceptance | **PASS** |
| Live OpenAI | **NOT RUN** |
| Starbucks leftovers | **0** |
| Secrets / `dist` / `node_modules` staged? | **no** (gitignored; `.env` local only) |
| Page-limit intent | `DECISIONS.md` ~802 words (~1.6 pp @500 w/pp); `NOT_DONE.md` ~259 words (~0.5 pp) |

### Phase 8 closed

Mandatory docs + defense scripts verified; Compose Fake path remains the live-demo baseline. Residual PARTIAL requirements are intentional and recorded in coverage / NOT_DONE.


## Phase 9 — Evaluation Lab (2026-11-15)

Primary REQs: demonstration/validation transparency (REQ-080–098 evidence reuse; REQ-099 demo path).

### Phase 9.1 — Backend deterministic runner + historical summaries

| Deliverable | Status |
| --- | --- |
| Pure `compareGoldenResult` + Vitest delegation | done |
| Allowlisted adapters (G12 + V12 + ADV8 = 32) | done |
| `GET/POST /evaluation/*` gated by `EVAL_LAB_ENABLED` | done |
| Sanitized historical summaries (baseline + remediation) | done |
| Backend unit tests | **177** green |

### Phase 9.2 — Frontend Evaluation Lab

| Deliverable | Status |
| --- | --- |
| vue-router Workspace \| Evaluation Lab | done |
| Real `POST /evaluation/runs` report UI | done |
| Historical panel (disclaimer separated from run totals) | done |
| JSON export + print CSS | done |
| Frontend unit tests | **24** green |
| Browser verify (Vite + Nest with Lab gate) | 32/32 passed |

### Phase 9.3 — Docker packaging, acceptance, docs (2026-11-15)

| Check | Result |
| --- | --- |
| API image copies `tests/golden|validation|adversarial` fixtures | **yes** |
| Historical `*.summary.json` in `dist/evaluation/historical` | **yes** |
| Raw `artifacts/eval/run-*.json` | **not** in image (dockerignore) |
| Base `docker-compose.yml` Lab default | **off** (`EVAL_LAB_ENABLED` unset/0) |
| Demo override `docker-compose.demo.yml` | `EVAL_LAB_ENABLED=1` + `LLM_PROVIDER=fake` |
| Backend typecheck / lint / build | exit 0 |
| Backend `npm test` | exit 0 — **177** |
| Backend `npm run test:integration` | exit 0 — **12** |
| Frontend typecheck / lint / build | exit 0 |
| Frontend `npm test` | exit 0 — **24** |
| Compose clean rebuild (demo override) | **PASS** |
| `compose-http-acceptance` | **PASS** |
| `compose-frontend-acceptance` | **PASS** |
| `compose-evaluation-acceptance` | **PASS** (32/32; G01 `F-UTIL-001`; V10 schema; ADV-08 isolation; historical 120/235 & 141/244) |
| Browser at http://127.0.0.1:8080/evaluation | **verified** (run 32/32, G01 evidence, Workspace nav, deep-link refresh) |
| Live OpenAI | **NOT RUN** |

### Phase 9 closed

Evaluation Lab is reproducible under Compose Fake + demo override. Deterministic domain evaluation is distinct from Vitest CI and from historical OpenAI evidence.
