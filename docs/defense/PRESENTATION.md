# PRESENTATION.md — 30-minute technical defense script

**Audience:** senior/architect interview panel · **Mode:** screen share · **Slides:** optional (REQ-154)  
**Runtime:** Compose Fake demo at http://127.0.0.1:8080 (see [`DEMO.md`](DEMO.md))  
**Live proof of record:** Path B checkout-pricing (not only the short API util demo). Preflight: `npx tsx scripts/smoke-live-checkout.ts`

---

## 1. Problem and constraints — 2 min

**Explain**

- Architecture reviews stall on intuition (“will it hold at 3×?”).
- Case non-negotiable: **no LLM-produced architecture numbers** (REQ-010–012).
- Budget ~15h; prefer narrow correct engine over broad inaccurate one (REQ-073/165).
- Explicit OUT_OF_SCOPE: auth, multi-tenant, diagrams, K8s (REQ-140–145).

**Show:** README opening + `NOT_DONE.md` one-pager.

**Refs:** `docs/specification/TECHNICAL_REQUIREMENTS.md` §1–2, §7; `NOT_DONE.md`.

**Transition:** “Here is the boundary architecture that enforces that rule.”

---

## 2. Architecture overview — 3 min

**Explain**

- Nest API + Postgres/Drizzle + pure `src/simulation` + LLM adapters + Vue thin client.
- Compose: postgres → api → nginx web; same-origin `/api` proxy.
- Extract never persists; analyze pins exact version.

**Show:** README mermaid; `docker compose ps`; open SPA header.

**Refs:** `README.md`; `docker-compose.yml`; `frontend/nginx.conf`; `src/main.ts`.

**Transition:** “Where does the LLM stop and the calculator start?”

---

## 3. LLM / deterministic boundary — 3 min

**Explain**

- LLM: extract DTO, classify scenario, explain with citations.
- Code: Zod/provenance, `simulate()`, refusals, usage/timings.
- Structured Outputs + grounded explanation validator → fallback on bad claims.
- Fake proves wiring; OpenAI accuracy is a separate measured class.

**Show:** `src/simulation/simulate.ts` import graph (no Nest); `src/llm/extraction/*` vs `src/analysis/analysis.service.ts` orchestration.

**Refs:** `DECISIONS.md` §2; `AGENTS.md` invariants; `src/llm/explain/*` grounding.

**Transition:** “The shared language is the typed formal model.”

---

## 4. Formal model, versioning, OCC — 3 min

**Explain**

- Known/unknown quantities, units, provenance, conflicts kept as candidates.
- Persist = new immutable version; `expectedVersion` → 409.
- Semantic diff by entity id.

**Show:** Zod schema snippet; Version panel in UI; mention PUT body.

**Refs:** `MODEL.md`; `src/architecture/domain/schema.ts`; `architecture.repository.ts` OCC; `frontend` VersionPanel.

**Transition:** “Given a version + scenario, what math do we actually trust?”

---

## 5. Simulation formulas and refusals — 4 min

**Explain**

- Steady-state; ≤15 nodes; core three scenarios only.
- Walk F-LOAD-001 → F-UTIL-001 (\(U=\lambda/C\)); saturation boolean.
- Retry rate only with backoff=`none`; timeout \(L>T\).
- Always refuse availability %, throughput, p95/p99.
- Blast radius = exposure labels, not invented %.

**Show:** `MODEL.md` formula table; a golden `DERIVATION.md` (e.g. G04); standing refusals in a prior analyze result if already on screen.

**Refs:** `MODEL.md`; `src/simulation/load_graph.ts`; `capacity.ts`; `retries.ts`; `unavailability.ts`.

**Transition:** “Now we prove the running system with Fake LLM — not OpenAI spend.”

---

## 6. Live browser demonstration — 5–7 min

### Honest failure note (say this out loud)

An earlier defense path **failed a live multi-service paste**: Fake only extracted a single `api` node, findings required a manual Validate click, and a trailing “Postgres +2s” question was swallowed into architecture text. That meant the panel could not evaluate the **real case in real time** under Compose Fake. That gap is fixed for the checkout-pricing path below — still Fake/deterministic, still **not** OpenAI generalization.

### Primary live case (must work)

**Follow [`DEMO.md`](DEMO.md) Path B (checkout-pricing).**

1. Click **Load checkout-pricing demo** (or paste the checkout/pricing/Postgres prose).
2. **Extract** → graph with `checkout`, `pricing`, `postgres`, queue/invoicing.
3. **Validation findings appear live** (SPOF, RETRY_WITHOUT_BACKOFF, SYNC_MISSING_TIMEOUT) — no click required.
4. **Save v1** → **Demo: Postgres +2s** → **Analyze**.
5. Expect `latency_degradation` on `postgres` @ 2000 ms; engine refuses invented availability % (“95% actual” is not an answer).

### Optional short path (time-box)

[`DEMO.md`](DEMO.md) Path A §§1–8: simple API util@1x + availability% refuse + OCC/diff.

Emphasize verbally: Fake handlers are regex/deterministic for **known** defense fixtures — **not** evidence of OpenAI on unseen prose. For arbitrary new text, use `LLM_PROVIDER=openai` with a key.

**Refs:** `frontend/src/lib/demoFixtures.ts`; `src/llm/provider/fake-demo-handlers.ts`; `frontend/src/lib/peelQuestion.ts`.

**Transition:** “Next: prove the engine with the Evaluation Lab, then show historical OpenAI separately.”

---

## 6b. Evaluation Lab — 6 min (within the 30)

**Requires** `docker-compose.demo.yml`. **Follow [`DEMO.md`](DEMO.md) §12.**

**Explain**

- Lab = allowlisted domain evaluation over HTTP — not Vitest-as-a-service, not OpenAI.
- 32 cases: golden / formal validation / adversarial; V10 schema-only; ADV-08 NL isolation only.
- Historical panel loads sanitized Phase 7 summaries; Run button did **not** produce those numbers.

**Show:** `/evaluation` → Run → G01 formulas → V10/ADV-08 labels → historical disclaimer + F1/field tables → Export JSON.

**Refs:** `src/evaluation/*`; `VALIDATION.md` §I; `scripts/compose-evaluation-acceptance.ts`.

**Transition:** “Limitations stay explicit.”

---

## 7. Validation evidence and limitations — 2 min

**Explain**

- Goldens 12/12; adversarial 8/8; Fake Compose + Evaluation acceptance green.
- Live OpenAI: baseline + remediation; latest 141/244 directional, F1 0.86/0.84.
- Caveats: denom change, same dataset, formal-context scenarios, DTO omissions, N=12 latency.

**Show:** `VALIDATION.md` caveats; PARTIAL REQ-003 / REQ-110 if asked.

**Refs:** `VALIDATION.md` D–G / I; `docs/engineering/REQUIREMENTS_COVERAGE.md`.

**Transition:** “Close with the tradeoffs we would defend under pressure.”

---

## 8. Final tradeoffs — 1 min

**Explain**

- Chose closed-form + refuse over stochastic theater.
- Chose OCC + immutable versions over last-write-wins.
- Chose Fake default + measured OpenAI opt-in over always-on spend.
- Chose Vue thin UI after API correctness — presentation only.
- At 10×: missing fan-out and availability questions still refuse; extraction quality remains the hard problem.

**Show:** `DECISIONS.md` §9–10; `NOT_DONE.md`.

**Stop.** Invite questions / live code change ([`QA.md`](QA.md), [`LIVE_CHANGES.md`](LIVE_CHANGES.md)).
