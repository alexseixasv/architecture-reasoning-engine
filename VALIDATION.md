# VALIDATION.md — Mathematical correctness & LLM evaluation status

**Date:** 2026-11-15  
**Scope:** Phase 4 golden/validation/adversarial + Phase 5 LLM offline seams.  
**Not in scope yet:** Public HTTP API (Phase 6); live accuracy tables until opt-in eval runs.

---

## Validation methodology

1. **Independent oracles.** Each golden `expected.json` was hand-authored from `docs/engineering/MODEL.md` formulas *before* trusting engine output. `DERIVATION.md` records the arithmetic.
2. **Strong assertions.** The golden runner compares the **complete** numerical metric set (id, value, unit, formulaId), detects unexpected metrics, checks required refusal reason codes, answerability status, saturations, impacts/paths, evidence presence, and determinism/immutability.
3. **No oracle cloning.** Expected values were not copied from `simulate()` dumps to make tests pass.
4. **Tolerances.** Absolute tolerance defaults to `0` (exact IEEE values for these fixtures). No unjustified floating epsilon.
5. **Validation pairs.** V01–V12 include NL architecture + NL question + hand formal model + expected structured scenario/simulation *or* documented unsupported-NL outcome. Formal models are schema-validated. Extraction accuracy is **not measured**.

### Separation of evidence classes

| Class | What it proves | Status this phase |
| --- | --- | --- |
| Executed engine tests | Deterministic math/refusals match hand oracles | Measured below |
| Prepared NL extraction fixtures | Dataset ready for Phase 5/7 | Prepared |
| Offline LLM seam tests (Fake provider) | Extraction/scenario/explain contracts | Measured (unit) |
| Live extraction accuracy (OpenAI) | Field-level vs `formal_model.json` | **NOT MEASURED — live eval NOT RUN** |

Never fabricate accuracy percentages.

---

## Golden test inventory (G01–G12)

| ID | Theme | Status expected | Key hand result |
| --- | --- | --- | --- |
| G01 | Capacity `sum_replicas` | ANSWERED | `C=320`, `U=0.25` |
| G02 | Datastore `primary_only` | ANSWERED | `C_db=50` (not 150), `U_db=0.8` |
| G03 | Load ×2 unsaturated | ANSWERED | `λ'=200`, `U=0.4` |
| G04 | Load ×3 Pricing saturated | ANSWERED | `600` reaches Pricing via `f=1`; `C=320`; `U=1.875`; saturated |
| G05 | Shared downstream accumulation | ANSWERED | Inventory `100+50=150` |
| G06 | Failure exposure + retry bound | ANSWERED | direct/transitive/unaffected; `α_max=200` |
| G07 | Timeout + retry | ANSWERED | `3000>2000`; `A_max=4`; `α_max=200` |
| G08 | Missing baseline traffic | NOT_ANSWERABLE | `MISSING_BASELINE_TRAFFIC` |
| G09 | Incomplete inbound | PARTIALLY_ANSWERED | refuse Shared total/util |
| G10 | Timeout equality `L=T` | ANSWERED | violated=`0`; no amp metrics |
| G11 | Fixed backoff | PARTIALLY_ANSWERED | `BACKOFF_PREVENTS_INSTANT_RATE` |
| G12 | Conflicting replicas | PARTIALLY_ANSWERED | `CONFLICTING_CAPACITY_FIELDS` |

Location: `tests/golden/G##_*/{architecture,scenario,expected}.json` + `DERIVATION.md`.

### Hand-derived calculations (summary)

Full arithmetic is in each `DERIVATION.md`. Highlights:

- **G04:** ingress=`checkout`; `λ'=200×3=600`; `λ_e=600×1=600`; `C_pricing=4×80=320`; `U=600/320=1.875`; `saturated=(U≥1)=true`.
- **G05:** gateway `50` → orders `100`, catalog `50` → inventory `150`.
- **G10:** `violated=(L>T)` strict; equality is healthy (no retry amplification metrics).

---

## Validation dataset inventory (V01–V12)

| ID | Execution | Tags (selected) | Notes |
| --- | --- | --- | --- |
| V01 | simulate | capacity | Mirrors G01 |
| V02 | simulate | primary_only | Mirrors G02 |
| V03 | simulate | slack-style | Informal prose (REQ-093 prep) |
| V04 | simulate | counterintuitive | Checkout OK, Pricing saturates (REQ-095 prep) |
| V05 | simulate | multi-path | Shared accumulation |
| V06 | simulate | failure | Exposure taxonomy |
| V07 | simulate | timeout/retry | Latency scenario |
| V08 | simulate | incomplete | Missing traffic (REQ-091 prep) |
| V09 | simulate | incomplete-inbound | Partial load |
| V10 | schema_only | unsupported-nl | Availability % — documented refusal, no invented scenario schema |
| V11 | schema_only | unsupported-nl | E2E p95 — documented refusal |
| V12 | simulate | contradiction | Conflicting replicas (REQ-092 prep) |

Location: `tests/validation/V##_*/`.

**Extraction accuracy: NOT MEASURED** (no LLM in Phase 4).

---

## Numerical correctness results

Denominator = golden cases with expected numerical metrics that were executed.

| Metric | Result |
| --- | --- |
| Golden cases executed | **12 / 12** |
| Golden cases matching hand oracle (strong assert) | **12 / 12** |
| Validation pairs schema-validated | **12 / 12** |
| Validation pairs with supported scenario simulated | **10 / 10** (V01–V09, V12) |
| Unsupported-NL pairs documented (schema only) | **2 / 2** (V10–V11) |

---

## Answerability and refusal correctness

| Check | Result |
| --- | --- |
| Standing fabrication refusals present when simulate runs | **12 / 12** goldens require `NO_AVAILABILITY_MODEL`, `NO_THROUGHPUT_MODEL`, `NO_LATENCY_DISTRIBUTION` (where applicable) |
| G08 `NOT_ANSWERABLE` + `MISSING_BASELINE_TRAFFIC` | **1 / 1** |
| G09 incomplete inbound refusals | **1 / 1** |
| G10 no amplification metrics when `L=T` | **1 / 1** |
| G11 backoff rate refusal | **1 / 1** |
| G12 conflict refuses utilization | **1 / 1** |
| Forbidden numerical metrics absent | asserted per case |

---

## Adversarial test results

| ID | Result |
| --- | --- |
| ADV-01 forced numbers in description ignored | PASS |
| ADV-02 unsupported scenario type | PASS |
| ADV-03 malformed numbers schema reject | PASS |
| ADV-04 contradictory capacity | PASS |
| ADV-05 misleading units schema reject | PASS |
| ADV-06 reordered arrays identical simulate | PASS |
| ADV-07 `NO_IMPLIED_FALLBACK` semantics | PASS |
| ADV-08 stored NL injection unused by simulate | PASS |

**Adversarial: 8 / 8 passed.**

Clarification recorded in `tests/adversarial/README.md` and `MODEL.md`: `NO_IMPLIED_FALLBACK` = no fallback inferred, not “fallback assumed absent”.

---

## Determinism and immutability

Every golden and simulate validation pair asserts:

- `simulate(a,s) === simulate(a,s)` (deep equality)
- Architecture JSON string unchanged after simulate (no mutation)

ADV-06 additionally proves node-array reorder invariance of results.

---

## Mathematical defects found and corrected

**None in Phase 4.** Independent goldens matched Phase 3 behavior; no expected-value weakening and no engine patches required this phase.

---

## Known limitations

- No LLM extraction; V\* NL texts are fixtures only.
- Extraction accuracy / end-to-end answer correctness via NL pipeline: **NOT MEASURED**.
- No Nest simulate HTTP route yet (Phase 6).
- No availability %, throughput, E2E latency, p95/p99 (by design).
- Multiple ingress without traffic split still refused (by design).
- Attempt-rate bounds require `backoff: none`.

---

## Exact reproduction commands

```bash
npm run typecheck
npm run lint
npm test
# with Compose Postgres:
docker compose up -d postgres
# set DATABASE_URL as in .env.example, then:
npm run test:integration
npm run build

# focused suites:
npm run test:golden
npm run test:validation
npm run test:adversarial
```

### Regression results

| When | Command | Exit | Detail |
| --- | --- | --- | --- |
| Phase 4 | `npm test` | 0 | 69 passed |
| Phase 5 | `npm run typecheck` | 0 | |
| Phase 5 | `npm run lint` | 0 | |
| Phase 5 | `npm test` | 0 | **110** passed (offline; includes Fake LLM + smoke #2 explanation regression) |
| Phase 5 | `npm run test:integration` | 0 | 3 passed (Postgres via Compose) |
| Phase 5 | `npm run build` | 0 | |
| Phase 5 | `npm run llm:live-eval` | — | **NOT RUN** |
| Phase 5 | `npm run llm:live-smoke` | 0 | smoke #3: **3** OpenAI calls; **e2eSuccess=true** (see below) |

---

## Phase 5 — LLM integration notes

- **Primary provider:** OpenAI (`gpt-4.1` default) via Responses API + Structured Outputs; `maxRetries: 0`.
- **Offline provider:** `LLM_PROVIDER=fake` (default for tests).
- **Provenance:** declared quantities require verified `sourceExcerpt` substrings.
- **Explanation:** LLM qualitative refs only; numbers rendered deterministically; fallback on validation/provider failure.
- **Cost:** usage recorder separates measured tokens vs estimated USD (pricing table dated **2026-11-15**); unknown models → cost `null`. Complete analysis = extract architecture + extract scenario + explain.
- **Live smoke:** #1/#2 partial; **#3 (2026-11-15) full E2E success** — see evidence tables below.
- **Live full eval:** `npm run llm:live-eval` — up to ~24 calls on V01–V12. **Status: NOT RUN.**

### Live smoke #1 (V01, 2026-11-15) — partial / pre-fix

| Step | Result |
| --- | --- |
| Calls | 3/3 |
| A | PROPOSED (1 node) |
| B | **UNSUPPORTED** (intent miss vs `load_multiplication`×1) |
| C | deterministic_fallback (E2E not honest yet) |
| Est. USD | ~$0.013 |

### Offline corrections after smoke #1

| Issue | Fix |
| --- | --- |
| Scenario over-refuse utilization@1x | Prompt clarifies baseline utilization → `load_multiplication` |
| Explanation p95 false positive | Reject only numeric percentile claims |
| Smoke fixture substitution | True E2E; exit 3 on failure; print rejection reasons |

### Live smoke #2 (V01, 2026-11-15) — after corrections

Command: `RUN_LIVE_OPENAI=1 node --env-file=.env --import tsx scripts/live-smoke.ts`  
Model: `gpt-4.1` · Timeout: `60000` · Cap: **3** · Persist: none · `e2eSuccess: false` (exit 3)

| Step | Result |
| --- | --- |
| Provider requests attempted | **3 / 3** |
| A Architecture extraction | **PROPOSED** — 1 node, 0 findings, `canPersist=true` |
| B Scenario extraction | **OK** — `load_multiplication`, **multiplier=1** (matches fixture) |
| C Deterministic simulation (from B) | **ANSWERED** — 3 metrics, 3 standing refusals |
| D/E Grounded explanation | OpenAI returned Structured Output but **validation failed** → **`deterministic_fallback`** |
| Sanitized rejection reasons | `unknown metricId "availability_percent"`; `unknown metricId "latency_p95_p99"`; `unknown metricId "throughput"` (LLM put refused metric names in `metricIds` instead of `refusalCodes`) |
| Schema/provider hard failures | None |
| Estimated USD | **~$0.0123** |
| Wall duration | **~8.8 s** (provider ms sum ≈ 6.6 s) |
| Final `e2eSuccess` | **false** |

Token usage (actual, smoke #2):

| Operation | Input | Output | Total | Duration ms | Est. USD | Request id prefix |
| --- | --- | --- | ---: | ---: | ---: | --- |
| extract_architecture | 2230 | 342 | 2572 | 3029 | 0.007196 | `resp_04aecc…` |
| extract_scenario | 552 | 64 | 616 | 1071 | 0.001616 | `resp_0c22d9…` |
| explain | 651 | 279 | 930 | 2522 | 0.003534 | `resp_054dd0…` |

**Smoke #2 verdict:** A+B+simulate succeeded on the true E2E path; explanation still fails validation (refused metric IDs mis-cited as computed `metricIds`). **Not full success.**

### Offline correction after smoke #2 (D-021)

| Issue | Fix |
| --- | --- |
| Refused metric ids in `metricIds` | `refusedMetricIds` field; separated trusted catalog; strict validator; prompt example |

### Live smoke #3 (V01, 2026-11-15) — post D-021

Command: `RUN_LIVE_OPENAI=1 node --env-file=.env --import tsx scripts/live-smoke.ts`  
Model: `gpt-4.1` · Timeout: `60000` · Cap: **3** · Persist: none · `e2eSuccess: true` (exit 0)

| Step | Result |
| --- | --- |
| Provider requests attempted | **3 / 3** |
| A Architecture extraction | **PROPOSED** — 1 node, 0 findings, `canPersist=true` |
| B Scenario extraction | **OK** — `load_multiplication`, **multiplier=1** (matches fixture) |
| C Deterministic simulation (from A+B) | **ANSWERED** — 3 metrics, 3 standing refusals |
| D/E Grounded explanation | **`llm+deterministic`** — **fallback=false** |
| Sanitized rejection reasons | none |
| Schema/provider hard failures | None |
| Estimated USD | **~$0.01422** |
| Wall duration | **~10.2 s** (provider ms sum ≈ 7.6 s) |
| Final `e2eSuccess` | **true** |

Token usage (actual, smoke #3):

| Operation | Input | Output | Total | Duration ms | Est. USD | Request id prefix |
| --- | --- | --- | ---: | ---: | ---: | --- |
| extract_architecture | 2230 | 318 | 2548 | 3334 | 0.007004 | `resp_01ffbe…` |
| extract_scenario | 553 | 70 | 623 | 1546 | 0.001666 | `resp_0f35cf…` |
| explain | 859 | 479 | 1338 | 2745 | 0.005550 | `resp_0b2a80…` |

**Smoke #3 verdict:** Full E2E path succeeded (extract → validate → scenario → simulate → grounded explain without fallback). Numbers remain deterministic-renderer-only. **Live smoke success.**

### Extraction accuracy (REQ-096)

**NOT MEASURED** at dataset scale (V01–V12 full live eval **NOT RUN**).  
Smoke only demonstrates a single architecture extraction success, not field-level accuracy denominators.

---

## Requirement coverage (Phase 4–5)

| REQ | Evidence |
| --- | --- |
| REQ-080 | 12 golden cases (≥8) |
| REQ-081 | `DERIVATION.md` per golden |
| REQ-082 | Offline Vitest; no live model in `npm test` |
| REQ-083 | `simulate(architecture, scenario)` seam; V fixtures keep NL separate |
| REQ-012 / REQ-020 / REQ-100 / REQ-111 / REQ-123 | `src/llm/**` + Fake unit tests |
| REQ-090–095 | Dataset under `tests/validation` |
| REQ-096 | Explicitly **NOT MEASURED** (live tooling present, not executed) |
