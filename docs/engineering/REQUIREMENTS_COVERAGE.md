# Requirements coverage matrix (Phases 1–9)

**Source of truth:** [`docs/specification/TECHNICAL_REQUIREMENTS.md`](../specification/TECHNICAL_REQUIREMENTS.md)  
**Rule:** Complete only with implementation **and** verification evidence. Mentions in docs alone do not count.

**Legend:** FULL · PARTIAL · UNSUPPORTED (by design) · OUT_OF_SCOPE · PROCESS

| ID | Status | Evidence / notes |
| --- | --- | --- |
| REQ-001 | FULL | `POST .../analyze` returns engine metrics (`AnalysisService` + golden/HTTP Fake) |
| REQ-002 | FULL | Extract + analyze accept free text; Fake Compose + browser verified |
| REQ-003 | PARTIAL | Timeout, saturation/util, retry bounds, assumptions: yes. **Availability % vs target:** refused (`NO_AVAILABILITY_MODEL`). **Blast radius:** qualitative exposure labels/paths only — not “N of M degraded” counts |
| REQ-010–012 | FULL | Pure `simulate()`; LLM extract/explain only; golden oracles; explain grounding |
| REQ-020 | FULL | Extraction DTO → architecture document (schema-validated) |
| REQ-021 | FULL | Scenario → simulate → grounded explain |
| REQ-022 | FULL | `POST/PUT /architectures` with structured document |
| REQ-030–031 | FULL | Persist, version list, get version, semantic diff |
| REQ-032 | FULL (OPTIONAL) | Closed-form documented in `MODEL.md` |
| REQ-033 | FULL | Root `MODEL.md` formulas + limits |
| REQ-040–042 | FULL | Zod + semantic findings + missing-info findings |
| REQ-050 | PARTIAL | ASK via completeness; ASSUME only explicit runtime assumptions; REFUSE via refused metrics. Completeness helper never recommends ASSUME |
| REQ-051 | FULL | `assumptions[]` on simulation/API when applied |
| REQ-052 | FULL | `NOT_ANSWERABLE` / `UNSUPPORTED` / refused metrics — no fabricated numbers |
| REQ-060–062 | FULL | Golden G01–G12 + API scenarios for unavailable / latency / load×N |
| REQ-063 | UNSUPPORTED | No extra scenario types beyond core three |
| REQ-070–073 | FULL | Max 15 nodes; steady-state; util/saturation stop; honest limits in MODEL/NOT_DONE |
| REQ-080–083 | FULL | ≥12 goldens + DERIVATION; offline `npm test`; clear LLM/engine seam |
| REQ-090–095 | FULL | V01–V12 inventory (incomplete, contradiction, Slack-style, unsupported, counterintuitive) |
| REQ-096 | FULL | Live field accuracy measured (baseline + remediation) |
| REQ-097 | FULL | Golden 12/12; live simulate path when scenario OK 10/10 |
| REQ-098 | FULL | Failure analysis in `VALIDATION.md` |
| REQ-099 | FULL | Compose + browser demo path; Evaluation Lab deterministic 32-case path (`docker-compose.demo.yml`); service runnable on panel input (**OpenAI accuracy on unseen text is not proven by Fake demo**) |
| REQ-100 | FULL | ADV injection fixtures; schema/SO boundary; untrusted delimiters |
| REQ-110 | PARTIAL | Per-request `timingsMs` + `usage` in API/logs. **No** OpenTelemetry collector/spans export |
| REQ-111 | FULL (OPTIONAL) | `LLM_PROVIDER=fake` zero-cost path |
| REQ-112–114 | FULL | Tokens when reported; cost/latency tables in VALIDATION (estimated ≠ invoice; N=12) |
| REQ-120–121 | FULL | Compose + `.env.example` |
| REQ-122–124 | OPTIONAL | Stack documented; assistants used |
| REQ-130–135 | FULL | Deliverables present after Phase 8.3; Evaluation Lab + historical packaging in Phase 9 |
| REQ-140–145 | OUT_OF_SCOPE | Not implemented (correct) |
| REQ-146 | OPTIONAL | Vue SPA shipped as thin UI (beyond PDF minimum; still no polished product UI) |
| REQ-150–153 | FULL | Defense docs: PRESENTATION, DEMO, QA, LIVE_CHANGES |
| REQ-160–165 | FULL | Boundary tests + MODEL/NOT_DONE/DECISIONS honesty |
| REQ-170–174 | PROCESS | Budget/privacy constraints for candidate |

## Critical compliance notes

1. **REQ-003** is intentionally incomplete on availability % and quantitative blast radius — refuse rather than invent (aligns with REQ-073 / OQ-001 / OQ-002).
2. **REQ-110** is satisfied for measured stage latency/tokens in responses, not for a full OTel pipeline.
3. **REQ-099** readiness ≠ generalization: Fake Compose demo proves wiring; live OpenAI on V01–V12 proves measured extraction quality on a **fixed** set. Panel-unseen architectures are supported operationally; accuracy is not guaranteed.
4. No silent feature expansion was made solely to green this checklist.
