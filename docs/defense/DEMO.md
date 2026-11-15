# DEMO.md — Reproducible Fake LLM browser demonstration

**Provider:** `LLM_PROVIDER=fake` only — **no paid API calls**.  
Fake handlers: [`src/llm/provider/fake-demo-handlers.ts`](../../src/llm/provider/fake-demo-handlers.ts).  
UI fixtures: [`frontend/src/lib/demoFixtures.ts`](../../frontend/src/lib/demoFixtures.ts).

**Important:** This proves Compose wiring, OCC, refusals, and engine math on a **known** Fake architecture. It does **not** prove OpenAI extraction on unseen prose.

---

## 0. Environment startup

**Workspace-only (Lab API disabled):**

```bash
cp .env.example .env    # confirm LLM_PROVIDER=fake
docker compose up -d --build
docker compose ps       # postgres healthy; api Up; web Up on 8080
```

**Full defense demo including Evaluation Lab** (forces Fake + `EVAL_LAB_ENABLED=1`):

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
```

### Health

```bash
curl -s http://127.0.0.1:8080/health
# expect: {"status":"ok", ...}
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/
# expect: 200
```

Optional automated path: `npx tsx scripts/compose-frontend-acceptance.ts`

**Browser URL:** http://127.0.0.1:8080

---

## 1. Demo architecture text

Click **Load Fake demo text** or paste exactly:

```text
The API service runs 4 replicas, each handling 80 requests per second. Capacity is the sum across replicas. Baseline ingress traffic is 80 rps into the API.
```

Fake extraction regexes require: `\d+ replicas`, `\d+ requests per second`, `\d+ rps`.

---

## 2. Extract (must not persist)

1. Click **Extract architecture**.
2. Banner: “Proposed architecture ready for review” / “Not persisted”.
3. Components show `api` · replicas **4** · capacity **80 rps**.
4. **Available versions** still empty / “Persist…”.
5. Observability may show `extract_architecture · fake-demo` with cost **n/a**.

---

## 3. Review and validate

1. Inspect JSON editor (document present).
2. Click **Validate with API** → success / `canPersist` message.
3. Do **not** invent fields; optional tiny comment-free edit later for v2.

---

## 4. Explicit persistence (v1)

1. Click **Save architecture (create v1)**.
2. Note `architectureId` and **version 1**.
3. Versions list: `v1 · approved_extraction`.
4. Save button becomes **Save as new version (OCC expected=1)**.

---

## 5. Supported scenario analysis

1. Click **Demo: utilization @1x**  
   Question: `At the current baseline load (1x), what is the API utilization?`
2. Click **Analyze version**.
3. Expect scenario **OK**, simulation **ANSWERED**.
4. Metrics include `utilization:api` **0.25** ratio · `F-UTIL-001` (also load metrics with formula IDs).
5. Standing refusals still list availability/throughput/p95-style metrics.

Hand check: \(C = 4 \times 80 = 320\), \(\lambda = 80\), \(U = 80/320 = 0.25\).

---

## 6. Unsupported availability question

1. Click **Demo: availability %**  
   Question: `What is the availability % if the API fails?`
2. Analyze → scenario **UNSUPPORTED** (Fake regex `availability\s*%`).
3. UI: explicit refusal copy — **no invented percentage**.

---

## 7. Version update (v2)

1. In JSON, change `"name": "demo"` → `"name": "demo-v2"` (keep valid JSON).
2. **Save as new version (OCC expected=1)**.
3. Expect **v2** · `user_corrected`; OCC expected becomes **2**.
4. v1 remains listed (**Open**).

---

## 8. Semantic diff

1. From **v1**, To **v2** → **Compare**.
2. Expect change like `changed · meta · name` before `demo` after `demo-v2`.
3. No graph editor.

---

## 9. HTTP 409 conflict

Goal: stale `expectedVersion` while preserving unsaved edits.

1. With editor on v2, set `"name": "conflict-draft-KEEP"` (unsaved).
2. In another terminal, create a newer version (example):

```bash
# Replace ARCH_ID; fetch v2 document first, then PUT with expectedVersion=2
curl -s http://127.0.0.1:8080/api/architectures/ARCH_ID/versions/2 > /tmp/v2.json
# edit name to server-v3 in document, then:
curl -s -X PUT http://127.0.0.1:8080/api/architectures/ARCH_ID \
  -H 'content-type: application/json' \
  -d '{"expectedVersion":2,"document":{...},"changeSource":"user_corrected"}'
```

3. In browser, **Save as new version (OCC expected=2)**.
4. Expect **HTTP 409**; draft still contains `conflict-draft-KEEP`; expected/actual shown; **no** auto-retry.
5. Optional: **Reload latest** only if you accept discarding the draft.

---

## 10. Usage and latency

After analyze, Observability shows tokens / provider ms; Fake **estimated USD n/a**.  
Request timings are **not** architecture latency.

---

## 11. SPA refresh

Navigate to http://127.0.0.1:8080/some/deep/spa/route — SPA shell must load (nginx `try_files`).

---

## 12. Evaluation Lab (≈5–7 min — requires demo Compose override)

**URL:** http://127.0.0.1:8080/evaluation

1. Explain: **deterministic Lab ≠ Vitest ≠ historical OpenAI**. Run button never calls OpenAI.
2. Click **Run evaluation suite** (`deterministic_full`).
3. Expect **32 passed** (12 golden / 12 validation / 8 adversarial) with real duration.
4. Open **G01** → show `F-UTIL-001`, substitutions, determinism.
5. Filter/open **V10** → `schema_validation` (not NL classification success).
6. Open **ADV-08** → `nl_isolation_check` disclaimer (not LLM injection proof).
7. Scroll to **Historical OpenAI evaluation — not executed in this run** → baseline 120/235 vs remediation 141/244; note denominator caveat; optional per-case drill-down.
8. **Export JSON** / mention print CSS. Totals of the current run stay 32 — historical denominators are separate.

Automated check: `npx tsx scripts/compose-evaluation-acceptance.ts`

---

## Recovery if a step fails

| Symptom | Fix |
| --- | --- |
| web unhealthy / blank | `docker compose logs web api`; rebuild `docker compose up -d --build` |
| Extract fails / empty doc | Confirm exact demo text; `LLM_PROVIDER=fake` in api container env |
| Analyze disabled | Persist v1 first |
| Utilization ≠ 0.25 | Document capacity/traffic wrong — re-load demo text and re-extract |
| UNSUPPORTED not firing | Question must contain `availability %` style text |
| 409 not firing | Confirm concurrent PUT actually created a newer version |
| `/api` 502 | Wait for api start; check `docker compose logs api` |
| Evaluation 403 / “Lab disabled” | Use `docker-compose.demo.yml`; confirm `EVAL_LAB_ENABLED=1` on api |
| API crash mentioning OPENAI_API_KEY | Demo override forces `LLM_PROVIDER=fake`; avoid ambient `.env` openai without key |

---

## What to say to the panel

> “This Fake path is for reproducibility. The Evaluation Lab re-runs allowlisted deterministic fixtures against the real engine. Measured OpenAI extraction quality is historical evidence in VALIDATION.md / the Lab’s historical panel — never produced by the Run button.”
