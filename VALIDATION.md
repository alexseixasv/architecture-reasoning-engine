# VALIDATION.md — Phase 4 mathematical correctness

**Date:** 2026-11-15  
**Scope:** Golden tests, validation dataset preparation, adversarial deterministic boundaries.  
**Not in scope:** LLM extraction, prompt-injection defenses, Phase 5+ APIs.

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
| Prepared NL extraction fixtures | Dataset ready for Phase 5/7 | Prepared only |
| Extraction accuracy | LLM field-level accuracy vs formal models | **NOT MEASURED** |

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

### Regression results (2026-11-15)

| Command | Exit | Detail |
| --- | --- | --- |
| `npm run typecheck` | 0 | |
| `npm run lint` | 0 | |
| `npm test` | 0 | 69 passed |
| `npm run test:integration` | 0 | 3 passed (Postgres via Compose) |
| `npm run build` | 0 | |


---

## Requirement coverage (Phase 4)

| REQ | Evidence |
| --- | --- |
| REQ-080 | 12 golden cases (≥8) |
| REQ-081 | `DERIVATION.md` per golden |
| REQ-082 | Offline Vitest; no live model |
| REQ-083 | `simulate(architecture, scenario)` seam; V fixtures keep NL separate |
| REQ-090–095 | Dataset prepared under `tests/validation` (measurement deferred Phase 7) |
| REQ-096 | Explicitly **NOT MEASURED** |
