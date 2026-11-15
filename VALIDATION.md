# VALIDATION.md — Mathematical correctness & LLM evaluation status

**Date:** 2026-11-15  
**Scope:** Phase 4–7 — goldens, V01–V12 dataset, adversarial, HTTP Fake, Phase 7 semantic eval harness.  
**Live OpenAI dataset eval:** **MEASURED** 2026-11-15 — baseline pass + remediation regression pass (artifacts gitignored under `artifacts/eval/`).

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
| Live extraction accuracy (OpenAI) | Field-level vs `formal_model.json` | **MEASURED** 2026-11-15 (120/235 fields; see Phase 7 table) |

Never fabricate accuracy percentages. Never claim Fake LLM scores as real OpenAI accuracy.

---

## Phase 7 — Evaluation methodology (offline harness ready)

### Evidence classes

| Class | Source | Status |
| --- | --- | --- |
| Schema validity | Zod + formal fixtures | Measured offline |
| Deterministic math | G01–G12 / V formal `simulate` | Measured offline |
| Fake LLM contracts | Unit/HTTP Fake | Measured offline |
| Real LLM accuracy | `scripts/live-validation-eval.ts` | **MEASURED** (one pass; scenario uses formal context) |

### Architecture semantic scoring

Implementation: [`src/llm/eval/compare-architecture.ts`](src/llm/eval/compare-architecture.ts)

- Order-insensitive match by node/dep id.
- Field accuracy = matches / total comparisons (**extras included** in denominator).
- Node/dependency **precision, recall, F1** from TP/FN/FP.
- Tracks known→unknown and unknown→known quantity flips.
- Ingress ids + incoming traffic compared.
- Conflict scoring separates **field-level** preservation, **document-level** preservation, and **extra/mis-leveled** conflicts (do not conflate extras with failed preservation).

### Scenario semantic scoring

Implementation: [`src/llm/eval/compare-scenario.ts`](src/llm/eval/compare-scenario.ts)

| Denominator | Value |
| --- | --- |
| Structured supported intents | **10** (V01–V09, V12) |
| Unsupported NL questions | **2** (V10, V11) |

- Intent accuracy separate from parameter accuracy.
- Invented structured scenario on unsupported NL → **fail**.

### Cost methodology (estimated API charges ≠ invoice)

[`src/llm/eval/cost-projections.ts`](src/llm/eval/cost-projections.ts)

| Bucket | Operations | Projection |
| --- | --- | --- |
| A full analysis | extract_architecture + extract_scenario + explain | mean sum × 1000 |
| B persisted architecture | extract_scenario + explain | mean sum × 1000 |
| C early-terminal | extract_scenario only | mean × 1000 |

Incomplete/unknown pricing → `null` (never fabricate $0).

### Latency methodology (request timings, not architecture latency)

[`src/llm/eval/percentiles.ts`](src/llm/eval/percentiles.ts)

- Wall clock via `performance.now()`.
- Stages: extract architecture, extract scenario, simulate, explain, total wall.
- p50/p95: linear interpolation inclusive; report **N**.

### Explanation quality metrics

Grounded success rate, deterministic fallback rate, invalid reference count, unsupported numeric claim rejections — collected by live runner when executed.

### Live runner safety

| Control | Value |
| --- | --- |
| Gate | `RUN_LIVE_OPENAI=1` |
| Cap | **34** provider requests |
| Model | `gpt-4.1` |
| Timeout / retries | 60000 ms / 0 |
| Persist | none |
| Artifact | `artifacts/eval/run-*.json` (gitignored) |
| Status | **MEASURED** (baseline + remediation regression) |

Command executed (approved once):

```powershell
$env:RUN_LIVE_OPENAI='1'
$env:LLM_PROVIDER='openai'
node --env-file=.env --import tsx scripts/live-validation-eval.ts
```

### Live V01–V12 results (2026-11-15) — measured

**Methodology note:** Scenario extraction used the **hand formal model** as architecture context (not the extracted document). Architecture field accuracy and scenario accuracy are therefore **separate** evidence classes — not a single end-to-end extraction score.

| Case | Arch | Field | Extra nodes | Scenario intent | Param OK | Overall scen | Sim status | Explain | Pipeline fail |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V01 | PROPOSED | 1/4 | 1 | load_multiplication | yes | yes | ANSWERED | grounded | none |
| V02 | PROPOSED | 6/11 | 1 | load_multiplication | yes | yes | ANSWERED | grounded | none |
| V03 | PROPOSED | 1/4 | 1 | load_multiplication | yes | yes | ANSWERED | grounded | none |
| V04 | PROPOSED | 10/17 | 0 | load_multiplication | yes | yes | ANSWERED | grounded | none |
| V05 | PROPOSED | 24/42 | 0 | load_multiplication | yes | yes | ANSWERED | grounded | none |
| V06 | PROPOSED | 12/35 | 1 | component_unavailable | yes | yes | ANSWERED | grounded | none |
| V07 | PROPOSED | 9/17 | 0 | latency_degradation | yes | yes | ANSWERED | **fallback** | none |
| V08 | PROPOSED | 2/7 | 0 | load_multiplication | yes | yes | NOT_ANSWERABLE | grounded | none |
| V09 | PROPOSED | 20/42 | 0 | load_multiplication | yes | yes | PARTIALLY_ANSWERED | grounded | none |
| V10 | PROPOSED | 20/31 | 2 | **component_unavailable** (invented) | no | **no** | — | — | scenario_extraction |
| V11 | PROPOSED | 10/17 | 0 | UNSUPPORTED | yes | yes | — | — | none |
| V12 | PROPOSED | 5/8 | 0 | load_multiplication | yes | yes | PARTIALLY_ANSWERED | grounded | none |

#### Architecture extraction (A)

| Metric | Value |
| --- | --- |
| Field accuracy | **120 / 235** (51.1%) |
| Node P / R / F1 | **0.80 / 0.86 / 0.83** (TP=24, FN=4, FP=6) |
| Dependency P / R / F1 | **0.70 / 0.78 / 0.74** (TP=14, FN=4, FP=6) |
| Hallucinated nodes / deps | **6 / 6** |
| known→unknown / unknown→known | **61 / 0** |
| Conflict preservation | **0 / 1** (V12) |
| Provider errors (arch) | 0 |

#### Scenario classification (B/C) — formal-model context

| Metric | Value |
| --- | --- |
| Supported intent accuracy | **10 / 10** |
| Supported parameter accuracy | **10 / 10** |
| Unsupported NL classification | **1 / 2** (V11 OK; V10 invented `component_unavailable`) |

#### Simulation (D)

| Metric | Value |
| --- | --- |
| Cases with correct scenario then simulate | **10 / 10** (status path consistent with expected answerability class) |
| Engine blamed for wrong scenario | **0** (V10 marked `scenario_extraction`) |

#### Explanation (E)

| Metric | Value |
| --- | --- |
| Evaluated | 10 |
| Grounded success | **9 / 10** (90%) |
| Deterministic fallback | **1 / 10** (10%) — V07 |
| Invalid reference count | 1 |
| Unsupported numeric claim rejections | 0 |

#### Provider / cost / latency (measured)

| Item | Value |
| --- | --- |
| Provider calls | **34 / 34** |
| Provider error records | **0** |
| Tokens | arch 26775/7596; scenario 6718/741; explain 9754/4068 (in/out) |
| Estimated USD this run | **~$0.1857** (pricing table; ≠ invoice) |
| A full / 1000 | **~$16.35** (N means from ops; sampleCount=10 complete triplets) |
| B persisted / 1000 | **~$6.82** |
| C early-terminal / 1000 | **~$1.61** |
| Wall p50 / p95 | **7972 ms / 10980 ms** (N=12, linear interpolation inclusive) |
| Extract arch p50/p95 | 3685 / 5837 ms (N=12) |
| Extract scenario p50/p95 | 1331 / 1751 ms (N=12) |
| Simulate p50/p95 | 0.6 / 8.4 ms (N=10) |
| Explain p50/p95 | 2924 / 4294 ms (N=10) |

**Main failure patterns:** (1) architecture field accuracy dragged by known→unknown and id/extra-node mismatches; (2) V10 over-accepts availability% as `component_unavailable`; (3) V12 conflict headline was misleading (see remediation); (4) occasional explanation fallback (V07).

Artifact: `artifacts/eval/run-2026-11-15T13-40-00-172Z.json` (gitignored). **Do not overwrite** — this is the frozen baseline.

### Post-evaluation remediation (offline, 2026-11-15) — not a second live pass

**Baseline preserved (original live artifact unchanged):**

| Metric | Baseline |
| --- | --- |
| Architecture field accuracy | **120/235 (51.1%)** |
| Node F1 | **0.83** |
| Dependency F1 | **0.74** |
| Supported scenarios | **10/10** |
| Unsupported classification | **1/2** |
| Grounded explanations | **9/10** |

Expected fixtures and denominators were **not** changed to improve scores. No live OpenAI requests in this remediation.

#### Diagnosed failure categories

| Category | Meaning |
| --- | --- |
| A Missing in DTO | Quantity absent/omitted in structured LLM response |
| B Provenance rejection | Declared value downgraded — excerpt not contiguous in source |
| C Mapper transform | Unit mismatch / mapping downgrade (not inventing numbers) |
| D Comparator mismatch | Mapped document differs from formal fixture (ids, values, extras) |

Original artifact lacked A/B/C/D detail for most known→unknown (~53 omitted in DTO; ~7 inconclusive). Identity renames cascaded dependency misses. V10 mixed-intent invented `component_unavailable`. V07 fallback lacked `validationErrorCodes` in the artifact.

#### Why the V12 headline was misleading

V12 expected conflict is **node `fieldConflicts`** (`replicas` 4 vs 6), with **`document.conflicts: []`**. The live summary “Conflict preservation **0/1**” scored `document.conflicts` extras / mis-leveling as failed preservation of an expected document conflict. Field-level conflict preservation and extra/mis-leveled document conflicts are now reported **separately** in the comparator. Legitimate document-level conflicts are still preserved — never discarded to match a fixture.

#### Changes introduced (offline)

- Stronger architecture extraction prompt: replicas, capacity+units, traffic, timeouts, retries, fan-out, aggregation, ingress; exact contiguous `sourceExcerpt`; stable ids from described components (**no V01–V12 hardcoding**).
- Scenario prompt: mixed-intent rule — availability %, nines, uptime probability, E2E p95/p99 → `UNSUPPORTED` even when an outage is also mentioned.
- Conflict scoring: `conflictPreservation` distinguishes field-level vs document-level vs extras.
- Live artifact diagnostics: DTO summary, quantity loss causes A–D, finding codes, explanation `validationErrors` + `validationErrorCodes`, per-case `failureCategories`.
- Explanation validator emits stable error codes; grounding / numeric-claim rules unchanged.
- Offline regressions: non-dataset identity, mixed-intent scenarios, conflicting replicas, diagnostics classification.

#### Remaining inconclusive before second live pass

- Whether prompt fixes reduce known→unknown and id extras on real OpenAI output was then **unmeasured**.
- Whether V10 mixed-intent classifies as UNSUPPORTED was then **unmeasured**.
- Whether V07 fallback codes are informative was then **unmeasured**.

### Live V01–V12 remediation regression (second pass, 2026-11-15) — measured

**Role:** Same-dataset remediation regression evaluation after offline prompt/diagnostics fixes — **not** an independent generalization benchmark. Historical baseline above remains authoritative for “first measured” numbers.

| Item | Value |
| --- | --- |
| Artifact | `artifacts/eval/run-2026-11-15T13-55-04-443Z.json` (gitignored) |
| Baseline artifact | `run-2026-11-15T13-40-00-172Z.json` — **unchanged** (SHA256 `2D1CA9C7…CAADBA`) |
| Model / cap / timeout / retries | `gpt-4.1` / **34** / 60000 ms / **0** |
| Provider calls | **34 / 34** |
| Persist | none |

**Methodology caveat (field-accuracy denominators):** Offline remediation changed conflict scoring rows (field-level vs document-level vs extras). Matched-node field comparisons also expand when IDs align better. Field match **rates** are therefore **not fully apples-to-apples** with the baseline 120/235 denominator. Prefer Node/Dep P/R/F1, quantity-state flips, scenario/unsupported, and conflict-level metrics for direct comparison; treat field % as directional only.

#### Per-case (second pass)

| Case | Field | Extra nodes | Scenario | Explain | Notes |
| --- | --- | --- | --- | --- | --- |
| V01 | 1/4 | 1 (`api-service`) | load×1 OK | grounded | ID slug mismatch |
| V02 | 6/11 | 1 | load OK | grounded | |
| V03 | 1/4 | 1 (`api-svc`) | load OK | grounded | ID slug mismatch |
| V04 | 12/17 | 0 | load OK | grounded | |
| V05 | 28/42 | 0 | load OK | grounded | |
| V06 | 28/44 | 0 | component_unavailable OK | grounded | |
| V07 | 9/17 | 0 | latency_degradation OK | **fallback** `CLAIM_KIND_MISSING_REFS` | |
| V08 | 2/7 | 0 | load OK | grounded | |
| V09 | 20/42 | 0 | load OK | grounded | 1× `UNIT_MISMATCH` |
| V10 | 19/31 | 2 | **UNSUPPORTED OK** | — | mixed-intent fixed |
| V11 | 10/17 | 0 | UNSUPPORTED OK | — | |
| V12 | 5/8 | 0 | load OK | grounded | **fieldConflicts preserved** |

#### Side-by-side vs frozen baseline

| Metric | Baseline | Second | Δ absolute | Δ pp / note |
| --- | --- | --- | ---: | --- |
| Arch field matches/total | 120/235 (51.1%) | 141/244 (57.8%) | +21 / +9 | **+6.7 pp** (denominator methodology shifted — see caveat) |
| Node P / R / F1 | 0.80 / 0.86 / 0.83 | 0.83 / 0.89 / 0.86 | TP 24→25, FN 4→3, FP 6→5 | F1 **+0.03** |
| Dep P / R / F1 | 0.70 / 0.78 / 0.74 | 0.80 / 0.89 / 0.84 | TP 14→16, FN 4→2, FP 6→4 | F1 **+0.10** |
| known→unknown | 61 | 57 | −4 | |
| unknown→known | 0 | 0 | 0 | no numeric hallucination |
| Extra nodes / deps | 6 / 6 | 5 / 4 | −1 / −2 | |
| Field-level conflict preserved | (not separated; V12 misleading 0/1 doc headline) | **1/1** (V12) | — | confirmed fieldConflicts |
| Document-level conflict preserved | n/a (expected 0) | n/a (expected 0; extras 0) | — | |
| Supported intent / params | 10/10 / 10/10 | 10/10 / 10/10 | 0 | |
| Unsupported NL | **1/2** | **2/2** | +1 | **+50 pp** |
| Grounded explain / fallback | 9/10 / 1/10 | 9/10 / 1/10 | 0 | V07 still fallback |

#### Diagnostic summary (second artifact only)

| Cause bucket (quantity diagnostics) | Count |
| --- | --- |
| A `missing_in_dto` | **75** |
| B provenance rejection | **0** |
| C `mapper_unit_or_transform` | **1** (V09 `UNIT_MISMATCH`) |
| D `comparator_only` (declared+mapped known; fixture compare separate) | **36** |

Per-case `failureCategories` (non-exclusive): `arch_missing_in_dto`×10, `arch_comparator_mismatch`×10, `arch_id_or_extra_nodes`×4, `arch_mapper_transform`×1, `explanation_fallback`×1.

**Confirmed:** V10 unsupported classification fixed; V12 field-level conflict preserved; residual field misses dominated by **missing quantities in DTO** (not provenance); ID slug extras remain (V01/V03/V10); V07 explain fallback is `CLAIM_KIND_MISSING_REFS` (statement without evidence refs). **No** unknown→known numeric inventions.

#### Cost / latency (second pass; estimated ≠ invoice)

| Item | Value |
| --- | --- |
| Tokens in/out | **49931 / 12872** (arch 30855/7945; scen 9322/742; explain 9754/4185) |
| Estimated USD this run | **~$0.203** |
| A full / 1000 | **~$17.79** (sampleCount=10) |
| B persisted / 1000 | **~$7.35** |
| C early-terminal / 1000 | **~$2.05** |
| Wall p50 / p95 | **7575 / 19828 ms** (N=12) |
| Extract arch p50/p95 | 4132 / 15113 ms (N=12) |
| Extract scenario p50/p95 | 1366 / 1633 ms (N=12) |
| Simulate p50/p95 | 0.8 / 9.7 ms (N=10) |
| Explain p50/p95 | 2564 / 3860 ms (N=10) |
| Process wall (runner) | **~117 s** |

### Golden consolidation (offline, measured)

`tests/eval/golden-summary.ts` + unit test: **12/12 passed**, deterministic repeatability true, formula IDs collected from metrics, standing refusals asserted via expected fixtures.

### Adversarial (offline)

ADV-01–ADV-08 remain the adversarial suite (prompt injection text, contradictions, unsupported scenario type, units, order independence, etc.). No expansion required for Phase 7 offline.

### V10/V11 tags

Corrected `requirementIds` to include **REQ-094** (out-of-scope refusal).

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
| Phase 6 | `npm run typecheck` / `lint` / `test` / `build` | 0 | **120** offline unit/golden/validation tests |
| Phase 6 | `npm run test:integration` | 0 | repo **3** + HTTP **9** (Fake LLM) |
| Phase 6 | `npm run test:http` | 0 | extract/analyze/OCC/version-pin/fallback |
| Phase 6 | `docker compose up -d --build` + `scripts/compose-http-acceptance.ts` | 0 | Fresh image; Fake LLM; full HTTP workflow **PASS** (see below) |
| Phase 7 | `npm test` | 0 | **138** passed (semantic scorers, percentiles, cost A/B/C, live gates, golden summary) |
| Phase 7 | `npm run llm:live-eval` | 0 | **MEASURED** — 34 calls; ~$0.186 est.; see live results table |

---

## Phase 6 — HTTP API

### Endpoints

| Method | Path | Persists? |
| --- | --- | --- |
| `POST` | `/architectures/extract` | **No** |
| `POST` | `/architectures` | Yes (approved document) |
| `PUT` | `/architectures/:id` | Yes (OCC `expectedVersion`) |
| `GET` | `/architectures/:id` / `.../versions` / `.../versions/:version` / `.../diff` | No |
| `POST` | `/architectures/:id/versions/:version/analyze` | No |

### Example curl

```bash
# Extract (never persists)
curl -s -X POST http://localhost:3000/architectures/extract \
  -H 'content-type: application/json' \
  -d '{"architectureText":"API has 4 replicas at 80 rps each. Ingress 80 rps."}'

# Persist after review
curl -s -X POST http://localhost:3000/architectures \
  -H 'content-type: application/json' \
  -d '{"document":{...},"changeSource":"approved_extraction"}'

# Analyze exact version
curl -s -X POST http://localhost:3000/architectures/$ID/versions/1/analyze \
  -H 'content-type: application/json' \
  -d '{"question":"What is utilization at baseline load?"}'
```

### Error / outcome mapping

| Condition | HTTP | Notes |
| --- | --- | --- |
| Invalid / oversized body | 400 | `INPUT_TOO_LARGE` when applicable |
| Persist validation reject | 400 | `findings` |
| Missing id/version | 404 | |
| OCC conflict | 409 | |
| Provider timeout/unavailable/config | 503 | sanitized `errorClass` |
| `NEEDS_CLARIFICATION` / `UNSUPPORTED` / `NOT_ANSWERABLE` / explain fallback | **200** | domain fields; simulation kept on fallback |
| Unexpected | 500 | sanitized |

### Version consistency

- Analyze calls `getVersion(id, version)` only — never substitutes latest.
- Response always includes `architectureId` + `architectureVersion`.
- `changeSource` is informational client metadata (`manual` \| `user_corrected` \| `approved_extraction`), not proof of human approval.

### Known limitations

- Default Compose uses `LLM_PROVIDER=fake`; OpenAI requires explicit env + key (server-side only).
- No authentication; no OTel collector (timings/usage in JSON + structured logs).
- Full V01–V12 live HTTP eval **NOT RUN**.

### Compose HTTP acceptance (2026-11-15) — measured

Command: `LLM_PROVIDER=fake docker compose up -d --build` then `npx tsx scripts/compose-http-acceptance.ts`

| Check | Result |
| --- | --- |
| Compose build/start | exit 0 — api recreated on Phase 6 image; postgres healthy |
| Container `LLM_PROVIDER` | `fake` |
| Container `OPENAI_API_KEY` | unset |
| OpenAI API calls | **none** |
| `GET /health` | **200** `status=ok` |
| A `POST /architectures/extract` | **200** `PROPOSED` `canPersist=true` (no auto-persist) |
| B `POST /architectures` | **201** version **1** `changeSource=approved_extraction` |
| C `POST .../versions/1/analyze` | **200** scenario **OK**; sim **ANSWERED**; metrics **3**; refused **3**; explain **`llm+deterministic`** (fake-demo); `architectureVersion=1` |
| C usage / timings | present (`usage.totals`, `timingsMs`; USD `null` / `pricingIncomplete=true` for `fake-demo` model) |
| D OCC → v2 then analyze v1 | update **200** version **2**; re-analyze **200** still **`architectureVersion=1`** (no silent substitution) |
| E missing / invalid / unsupported | **404** / **400** / **200** `UNSUPPORTED` |

---

## Phase 5 — LLM integration notes

- **Primary provider:** OpenAI (`gpt-4.1` default) via Responses API + Structured Outputs; `maxRetries: 0`.
- **Offline provider:** `LLM_PROVIDER=fake` (default for tests).
- **Provenance:** declared quantities require verified `sourceExcerpt` substrings.
- **Explanation:** LLM qualitative refs only; numbers rendered deterministically; fallback on validation/provider failure.
- **Cost:** usage recorder separates measured tokens vs estimated USD (pricing table dated **2026-11-15**); unknown models → cost `null`. Complete analysis = extract architecture + extract scenario + explain.
- **Live smoke:** #1/#2 partial; **#3 (2026-11-15) full E2E success** — see evidence tables below.
- **Live full eval:** `npm run llm:live-eval` — **MEASURED** 2026-11-15 (34 calls; see Phase 7 live table).

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

**MEASURED** at dataset scale (2026-11-15):

- **Baseline** (frozen): field **120/235**; scenario (formal context) **10/10** + unsupported **1/2**.
- **Remediation regression** (same dataset): field **141/244** (denom. caveat); scenario **10/10** + unsupported **2/2**.

Do not conflate scenario-on-formal with end-to-end extract→scenario accuracy. Do not replace baseline numbers with the second pass.

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
| REQ-001 / 002 / 021 / 022 / 051 / 052 / 110 / 112 / 120 / 130 | Phase 6 HTTP extract/analyze + Fake HTTP suite |
| REQ-090–095 | V01–V12 dataset + tags (V10/V11 → REQ-094) |
| REQ-096 | Baseline live field **120/235**; remediation regression **141/244** (denom. caveat); scenario 10/10; unsupported **2/2** (2nd pass) |
| REQ-097 | Offline goldens 12/12; live sim path OK when scenario OK |
| REQ-098 | Baseline + remediation diagnosis (DTO missing dominant; V10 fixed; V12 fieldConflicts; V07 CLAIM_KIND_MISSING_REFS) |
| REQ-113 / 114 | Two measured passes; cost A/B/C + wall/stage p50/p95 (N noted); est. ≠ invoice |
