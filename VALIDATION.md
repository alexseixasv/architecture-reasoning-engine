# VALIDATION.md — Evidence for correctness, extraction, and operations

**Date finalized:** 2026-11-15 (Phase 8.3 documentation closure)  
**Scope:** Phases 4–8 verification. **No new paid OpenAI runs** in Phase 8.3.

### Mandatory caveats (read first)

1. **Denominator change:** field accuracy baseline **120/235** vs remediation **141/244** — conflict-scoring rows and better ID alignment changed comparisons; treat field **%** as directional; prefer Node/Dep F1 and scenario metrics for comparison.
2. **Same dataset reused** after remediation — second live pass is **not** an independent generalization benchmark.
3. **Scenario live scoring used hand formal architecture context**, not the extracted document — **full extract→scenario accuracy was not measured**.
4. **Extraction omissions remain significant** (DTO `missing_in_dto` dominant on remediation diagnostics).
5. **Small-sample latency percentiles (N=12)** are request timings, **not** production SLO evidence.
6. **Fake LLM ≠ OpenAI accuracy.** Fake proves contracts/wiring; OpenAI numbers below are measured on fixed V01–V12 only.
7. **Estimated USD ≠ invoice.** Incomplete pricing → `null`, never fabricated `$0`.

Coverage of REQ IDs: [`docs/engineering/REQUIREMENTS_COVERAGE.md`](docs/engineering/REQUIREMENTS_COVERAGE.md).

---

## A. Deterministic golden tests

| Item | Result |
| --- | --- |
| Cases | **G01–G12** under `tests/golden/G##_*/` + `DERIVATION.md` each |
| Match hand oracle | **12 / 12** |
| Determinism / immutability | Asserted (repeat equality; architecture not mutated) |
| Offline suite | `npm test` includes goldens — **no live model** |

| ID | Theme | Status | Key hand result |
| --- | --- | --- | --- |
| G01 | `sum_replicas` | ANSWERED | \(C=320\), \(U=0.25\) |
| G02 | `primary_only` | ANSWERED | \(C_{db}=50\), \(U=0.8\) |
| G03 | Load ×2 | ANSWERED | \(\lambda'=200\), \(U=0.4\) |
| G04 | Load ×3 saturate Pricing | ANSWERED | \(U=1.875\), saturated |
| G05 | Multi-path accumulation | ANSWERED | Inventory \(150\) |
| G06 | Failure exposure + retry bound | ANSWERED | labels + \(\alpha_{max}=200\) |
| G07 | Timeout + retry | ANSWERED | \(3000>2000\); \(A_{max}=4\) |
| G08 | Missing traffic | NOT_ANSWERABLE | `MISSING_BASELINE_TRAFFIC` |
| G09 | Incomplete inbound | PARTIALLY_ANSWERED | refuse shared total/util |
| G10 | \(L=T\) | ANSWERED | violated=`0` |
| G11 | Fixed backoff | PARTIALLY_ANSWERED | `BACKOFF_PREVENTS_INSTANT_RATE` |
| G12 | Conflicting replicas | PARTIALLY_ANSWERED | `CONFLICTING_CAPACITY_FIELDS` |

Standing refusals on simulate: `NO_AVAILABILITY_MODEL`, `NO_THROUGHPUT_MODEL`, `NO_LATENCY_DISTRIBUTION` where fixtures require them.

---

## B. Model validation and adversarial testing

### V01–V12 dataset (`tests/validation/`)

| ID | Tags | Notes |
| --- | --- | --- |
| V01–V02 | capacity / primary_only | Mirror G01–G02 |
| V03 | slack-style | REQ-093 |
| V04 | counterintuitive | REQ-095 |
| V05–V07 | multi-path / failure / timeout | |
| V08–V09 | incomplete | REQ-091 |
| V10–V11 | unsupported-nl | REQ-094 (availability %, E2E p95) |
| V12 | contradiction | REQ-092 |

Offline: schema **12/12**; supported formal simulate **10/10**; unsupported NL documented **2/2**.

### Adversarial (`tests/adversarial/`) — **8 / 8 PASS**

ADV-01 forced numbers ignored · ADV-02 unsupported scenario · ADV-03 malformed reject · ADV-04 contradictory capacity · ADV-05 unit reject · ADV-06 reorder invariance · ADV-07 `NO_IMPLIED_FALLBACK` · ADV-08 stored injection unused by simulate.

---

## C. Fake LLM contract testing

| Check | Result |
| --- | --- |
| Unit Fake extract/scenario/explain | Included in offline `npm test` (**157** as of Phase 8.2) |
| HTTP Fake integration | `npm run test:integration` / `test:http` — OCC, version pin, UNSUPPORTED |
| Compose API Fake | `scripts/compose-http-acceptance.ts` — extract non-persist → persist → analyze → OCC → 404/400/UNSUPPORTED |
| Compose nginx Fake | `scripts/compose-frontend-acceptance.ts` — SPA + `/api` proxy + 409 + diff |
| Frontend Vitest | **12** tests (mocked client; no network) |
| OpenAI calls in default tests/Compose Fake | **none** |

---

## D. Real OpenAI architecture extraction

**Gate:** `RUN_LIVE_OPENAI=1` · Cap **34** · Model `gpt-4.1` · timeout 60000 · retries **0** · persist **none**  
Artifacts (gitignored):  
`artifacts/eval/run-2026-11-15T13-40-00-172Z.json` (**baseline frozen**)  
`artifacts/eval/run-2026-11-15T13-55-04-443Z.json` (remediation regression)

### Baseline (first measured)

| Metric | Value |
| --- | --- |
| Field accuracy | **120 / 235 (51.1%)** |
| Node P/R/F1 | **0.80 / 0.86 / 0.83** |
| Dependency P/R/F1 | **0.70 / 0.78 / 0.74** |
| known→unknown / unknown→known | **61 / 0** |
| Unsupported NL | **1 / 2** (V10 invented scenario) |
| Est. USD / wall p50/p95 | **~$0.186** / **7972 / 10980 ms** (N=12) |

### Remediation regression (same dataset — latest headline numbers)

| Metric | Value |
| --- | --- |
| Field accuracy | **141 / 244 (57.8%)** — **denominator methodology shifted** |
| Node F1 | **0.86** |
| Dependency F1 | **0.84** |
| Unsupported NL | **2 / 2** (V10 fixed) |
| Field-level conflicts (V12) | **1 / 1** preserved |
| Quantity diagnostics | **75** `missing_in_dto`; **0** provenance reject; **1** unit mismatch |
| Est. USD / wall p50/p95 | **~$0.203** / **7575 / 19828 ms** (N=12) |

**Do not replace baseline with second-pass numbers when citing “first measured.”** Prefer F1 and scenario metrics when comparing passes.

Live smokes #1–#3 (V01, 3 calls each) documented historically: #3 achieved grounded E2E (`e2eSuccess=true`, ~$0.014). Full V01–V12 via HTTP/browser OpenAI: **NOT RUN**.

---

## E. Scenario classification

| Denominator | Value |
| --- | --- |
| Supported structured intents | **10** (V01–V09, V12) |
| Unsupported NL | **2** (V10, V11) |

| Pass | Supported intent+params | Unsupported |
| --- | ---: | ---: |
| Baseline | **10 / 10** | **1 / 2** |
| Remediation | **10 / 10** | **2 / 2** |

When scenario OK, simulate status path **10 / 10**; engine never blamed for wrong scenario extraction.

---

## F. Grounded explanation validation

Rules: qualitative LLM text; numbers only via deterministic rendering of engine evidence; invalid refs / unsupported numeric claims → `deterministic_fallback` with codes.

| Pass | Grounded | Fallback |
| --- | ---: | ---: |
| Baseline | **9 / 10** | **1 / 10** (V07) |
| Remediation | **9 / 10** | **1 / 10** (V07 `CLAIM_KIND_MISSING_REFS`) |

Smoke #2 failed validation (refused IDs cited as metrics); smoke #3 succeeded after catalog/prompt fix (D-021).

---

## G. Cost and latency measurements

**Buckets** ([`src/llm/eval/cost-projections.ts`](src/llm/eval/cost-projections.ts)):  
A = extract_architecture + extract_scenario + explain · B = scenario + explain · C = scenario only.

| Pass | Est. USD run | A / 1k | B / 1k | C / 1k | Wall p50/p95 | Notes |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Baseline | ~$0.186 | ~$16.35 | ~$6.82 | ~$1.61 | 7972 / 10980 ms | N=12; tokens reported in artifact |
| Remediation | ~$0.203 | ~$17.79 | ~$7.35 | ~$2.05 | 7575 / 19828 ms | Tokens in/out **49931 / 12872** |

Simulate stage remains sub-10 ms p95 when scenario OK. Production model for projections = `gpt-4.1` (same as measured). Fake provider costs often `null` / `pricingIncomplete`.

---

## H. Frontend and Docker Compose verification

| Check | Result (Phase 8.2; re-verified in 8.3) |
| --- | --- |
| `docker compose up -d --build` | postgres + api + web (`WEB_PORT=8080`) |
| `GET /health` (direct + via nginx) | 200 |
| SPA `http://127.0.0.1:8080` | served; deep-route refresh OK |
| nginx `/api/*` | strip prefix → Nest |
| Fake E2E HTTP | extract → validate path → persist v1 → analyze → UNSUPPORTED → v2 → diff → OCC **409** |
| Browser Fake acceptance | verified in Phase 8.2 (Cursor browser) |
| Live OpenAI via UI | **NOT RUN** |

Frontend: typecheck / lint / unit (**12**) / production build — exit 0.  
Backend: typecheck / lint / unit (**157**) / integration (**12**) / build — exit 0.

---

## Reproduction commands (offline)

```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run test:integration   # requires DATABASE_URL / Compose postgres
cd frontend && npm ci && npm run typecheck && npm run lint && npm test && npm run build
docker compose up -d --build
npx tsx scripts/compose-http-acceptance.ts
npx tsx scripts/compose-frontend-acceptance.ts
```

Live OpenAI (opt-in only; **do not run for Phase 8.3 closure**):

```powershell
$env:RUN_LIVE_OPENAI='1'; $env:LLM_PROVIDER='openai'
node --env-file=.env --import tsx scripts/live-validation-eval.ts
```

---

## Failure analysis (honest)

1. Architecture extraction misses are dominated by **omitted quantities in the DTO**, not provenance rejections after remediation.
2. Component **ID slug extras** (`api-service` vs `api`) still hurt field/F1 denominators.
3. Scenario-on-formal overstates end-to-end NL pipeline quality.
4. V07 explanation can still fall back when claims lack evidence refs.
5. Availability % and similar claims are correctly **unsupported** after mixed-intent prompt fix (V10).

---

## Requirement mapping (selected)

| REQ | Evidence section |
| --- | --- |
| REQ-080–083 | A |
| REQ-090–095 | B |
| REQ-096–098 | D–F |
| REQ-100 | B adversarial |
| REQ-110, 112–114 | G (+ API `timingsMs`/`usage`; no OTel collector) |
| REQ-120, 130 | H |
| REQ-099 | H + [`docs/defense/DEMO.md`](docs/defense/DEMO.md) |
