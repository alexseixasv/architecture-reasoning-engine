# Technical Requirements — Architecture Reasoning Engine

**Source:** `Technical Case: Architecture Reasoning Engine` (PDF, hiring case).  
**Extracted:** 2026-11-14.  
**Status:** Authoritative requirements from the PDF. Engineering decisions that go beyond the PDF are listed separately at the end and must not be treated as case mandates.

**Classification legend**

| Class | Meaning |
| --- | --- |
| MANDATORY | Explicitly required by the PDF |
| OPTIONAL | Allowed or encouraged; not required |
| OUT_OF_SCOPE | Explicitly excluded by the PDF |

**Phase legend:** 1 Foundation · 2 Formal model & persistence · 3 Simulation engine · 4 Golden tests · 5 LLM integration · 6 API & observability · 7 Validation & benchmarking · 8 Documentation & interview prep

---

## 1. Problem statement and expected behavior

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-001 | Build a service that answers architecture “what happens if” questions with computed numbers, ending intuition-only review arguments. | §1 | MANDATORY | 6–8 | End-to-end analysis endpoint returns computed metrics from the deterministic engine for a supported scenario. |
| REQ-002 | Input is a plain-text architecture description; output answers scenario questions backed by computed numbers. | §1 | MANDATORY | 5–6 | API accepts free-text architecture + question and returns structured results including engine-computed quantities. |
| REQ-003 | Expected answer shape includes timeout violations, retry amplification, saturation/capacity effects, availability vs target, blast radius, and visible assumptions (as illustrated by the checkout/pricing example). | §1 | MANDATORY | 3, 6 | For supported scenarios of that shape, simulation result exposes those categories when inputs allow; assumptions list is non-empty when assumptions were applied. |

### Open questions (ambiguities)

| ID | Ambiguity | Notes |
| --- | --- | --- |
| OQ-001 | Example shows “Checkout availability drops to X%” without defining the availability formula. | Formula must be stated in MODEL.md; if undefined inputs block it, refuse rather than invent. |
| OQ-002 | Example blast radius “2 of 4 services, invoicing continues degraded” mixes sync and async paths without a formal definition of “degraded.” | Define blast-radius terms in MODEL.md; do not invent PDF-unstated semantics. |

---

## 2. Non-negotiable LLM vs deterministic computation boundary

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-010 | No number in any output may be produced by a language model. | §2 | MANDATORY | 3–6 | Code review + tests prove numeric fields in API responses originate from typed engine/measurement code, not LLM free text. |
| REQ-011 | Quantities, availability figures, saturation points, latency estimates, and blast radius counts must come from hand-verifiable code. | §2 | MANDATORY | 3–4 | Golden tests compare engine output to independently hand-derived expected values. |
| REQ-012 | The model may translate ambiguous prose into a formal model and explain results in natural language; it is not the calculator. | §2 | MANDATORY | 5–6 | Extraction/explanation adapters have no numeric calculation APIs; explanation inserts engine values by reference. |

---

## 3. Functional requirements

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-020 | Extract a formal model from free text: services, dependencies, call type (sync/async), timeouts, retry policy, replica counts, capacity, data stores, declared targets. | §3.1 | MANDATORY | 5 | Extraction returns a schema-validated formal model covering those entity kinds when present in text. |
| REQ-021 | Answer scenario questions by translating the question into a simulation over the formal model, running it in code, and explaining the result. | §3.4 | MANDATORY | 3, 5–6 | Simulation path runs without LLM for structured inputs; explanation is optional and grounded. |
| REQ-022 | Support direct use of a corrected formal model without re-running text extraction. | §5.3 | MANDATORY | 2, 6 | Manual update/create endpoints accept structured model JSON and persist a new immutable version. |

---

## 4. Formal model requirements

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-030 | Formal model is a first-class artifact: persisted, versioned, inspectable, and diffable. | §5.3 | MANDATORY | 2, 6 | CRUD + version list + inspect + diff APIs operate on stored versions. |
| REQ-031 | User can correct the formal model directly without going through natural-language text. | §5.3 | MANDATORY | 2, 6 | Manual correction creates a new version; prior versions remain readable. |
| REQ-032 | Modeling approach is chosen by the implementer; closed-form analytical formulas are acceptable; Monte Carlo / discrete-event are acceptable if justified. | §4 | OPTIONAL | 3 | MODEL.md states chosen approach and justification. |
| REQ-033 | Math must be stated, defensible, and testable; model limits stated in writing. | §4 | MANDATORY | 3, 8 | MODEL.md documents formulas, units, assumptions, invalidity conditions. |

---

## 5. Structural and semantic validation requirements

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-040 | Validate with schema validation plus semantic checks. | §3.2 | MANDATORY | 2 | Validator returns typed findings for schema and semantic classes. |
| REQ-041 | Flag structural problems including: cycles in synchronous call paths, retries without backoff, dependencies with no timeout, single points of failure. | §3.2 | MANDATORY | 2 | Each listed condition produces a finding when present in fixtures. |
| REQ-042 | Flag what is missing from the model relative to answering needs. | §3.2 | MANDATORY | 2–3 | Missing fields appear as findings / missing-information entries. |

---

## 6. Missing information and refusal policies

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-050 | Handle incomplete input by deciding whether to ask, assume, or refuse. | §3.3 | MANDATORY | 2–3 | Policy returns ASK / ASSUME / REFUSE with visible rationale. |
| REQ-051 | Every assumption used must be visible in the output. | §3.3 | MANDATORY | 3, 6 | Simulation/API responses include an assumptions array when assumptions applied. |
| REQ-052 | When the model cannot support a question, return explicit not-answerable with what is missing—not a plausible number. | §3.5 | MANDATORY | 3, 6 | Unsupported/out-of-scope questions yield NOT_ANSWERABLE (or equivalent) without fabricated metrics. |

---

## 7. Required scenario types

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-060 | Support: a component becomes unavailable. | §3 | MANDATORY | 3–4 | Golden + API scenario type covered with hand derivation. |
| REQ-061 | Support: a component degrades in latency. | §3 | MANDATORY | 3–4 | Same as REQ-060 for latency degradation. |
| REQ-062 | Support: incoming load multiplies by N. | §3 | MANDATORY | 3–4 | Same as REQ-060 for load multiplication. |
| REQ-063 | Add further scenario types only if the core three are solid. | §3 | OPTIONAL | 3+ | Extra scenarios documented only after core golden coverage passes. |

---

## 8. Mathematical constraints and simulation scope

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-070 | Assume architecture graphs of at most 15 nodes. | §4 | MANDATORY | 2–3 | Validation rejects or flags graphs above 15 nodes per documented policy. |
| REQ-071 | Assume steady-state behavior. | §4 | MANDATORY | 3, 8 | MODEL.md states steady-state assumption; engine does not claim transient backlog dynamics without inputs. |
| REQ-072 | Queueing theory beyond utilization and saturation is not required. | §4 | OPTIONAL | 3 | Engine may stop at utilization/saturation; any deeper queueing is documented and justified. |
| REQ-073 | Prefer a simple model with honest boundaries over an elaborate model that quietly lies. | §4 | MANDATORY | 3, 8 | NOT_DONE.md / MODEL.md list omitted capabilities honestly. |

---

## 9. Golden test requirements

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-080 | At least 8 golden cases where the correct answer is analytically derivable by hand. | §5.1 | MANDATORY | 4 | ≥8 golden fixtures with expected results. |
| REQ-081 | Hand derivation written in the repository for each golden case. | §5.1 | MANDATORY | 4 | Each golden case has a derivation document or section. |
| REQ-082 | Deterministic test suite passes with no live model calls. | §5.2 | MANDATORY | 4–5 | CI/local `npm test` succeeds offline without provider network. |
| REQ-083 | Design a clear seam between extraction and computation. | §5.2 | MANDATORY | 3–5 | Simulation accepts structured architecture + scenario without calling LLM. |

---

## 10. Validation dataset and accuracy requirements

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-090 | Build a validation set of at least 12 architecture descriptions with paired questions (no dataset is provided). | §6 | MANDATORY | 7 | ≥12 paired items under `tests/validation` (or documented path). |
| REQ-091 | Include a deliberately incomplete description that blocks the asked question. | §6 | MANDATORY | 7 | At least one fixture tagged incomplete/blocking. |
| REQ-092 | Include a description with an internal contradiction. | §6 | MANDATORY | 7 | At least one contradiction fixture. |
| REQ-093 | Include a poorly written Slack-style description. | §6 | MANDATORY | 7 | At least one informal-prose fixture. |
| REQ-094 | Include an out-of-scope question where correct behavior is refusal. | §6 | MANDATORY | 7 | Fixture expects refusal / NOT_ANSWERABLE. |
| REQ-095 | Include a case where intuition is wrong and computation is right. | §6 | MANDATORY | 7 | Fixture documents counterintuitive expected result. |
| REQ-096 | Report extraction accuracy against hand-built formal models. | §6 | MANDATORY | 7 | VALIDATION.md reports field-level (or documented) extraction accuracy from measured runs. |
| REQ-097 | Report answer correctness against golden derivations. | §6 | MANDATORY | 7 | VALIDATION.md reports measured answer correctness. |
| REQ-098 | Analyze failures in writing. | §6 | MANDATORY | 7 | VALIDATION.md includes genuine failure analysis. |
| REQ-099 | System will be run live on unseen architectures during defense. | §6 | MANDATORY | 8 | Demo path documented; service runnable for live panel input. |

---

## 11. Security and prompt injection requirements

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-100 | Architecture descriptions are untrusted input; the service must not be steerable by its own input. | §5.4 | MANDATORY | 5–6 | Injection fixtures cannot force bypass of validation/simulation boundary or fabricate engine numbers. |

### Open questions

| ID | Ambiguity | Notes |
| --- | --- | --- |
| OQ-003 | PDF states non-steerability but does not prescribe concrete controls. | Engineering decisions (schema validation, instruction/data separation, size limits) are ours; document in DECISION_LOG. |

---

## 12. Observability, token usage, and cost requirements

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-110 | Per-request trace with each step, latency, token usage, and cost — real measured numbers. | §5.5 | MANDATORY | 6–7 | Traces/spans cover pipeline stages; measured latencies and provider usage recorded when available. |
| REQ-111 | Model choice is free; exercise should cost nothing (free tiers / local / trial). | §5.7 | OPTIONAL | 5 | Provider abstraction supports a zero-cost development path (e.g. Ollama or fixture). |
| REQ-112 | Report tokens consumed per analysis. | §5.7 | MANDATORY | 6–7 | Analysis response or observability export includes token counts when provider reports them; otherwise marked unavailable. |
| REQ-113 | Project cost per 1,000 analyses using the production model you would actually run; if different from build-time model, say so and explain what would change. | §5.7 | MANDATORY | 7–8 | Cost table documents measured vs projected assumptions. |
| REQ-114 | Submit cost and latency table with measured p50 and p95, tokens per analysis, projected cost per 1,000 analyses. | §9.6 | MANDATORY | 7–8 | Table present in VALIDATION.md (or linked deliverable) with measured values. |

---

## 13. Reproducibility and Docker requirements

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-120 | Service starts via `docker compose up` on a clean machine. | §5.6, §9.1 | MANDATORY | 1, 6 | Documented compose stack brings up runnable API (+ dependencies). |
| REQ-121 | Include `.env.example`. | §5.6 | MANDATORY | 1 | `.env.example` committed with documented defaults. |
| REQ-122 | Stack is free choice; production stack TS/NestJS/Drizzle/Postgres/OpenTelemetry/Next.js is an advantage, not a requirement. | §8 | OPTIONAL | 1 | Chosen stack documented in DECISIONS / DECISION_LOG. |
| REQ-123 | Any model provider is fine, including free tiers and locally hosted models. | §8 | OPTIONAL | 5 | Provider interface allows swap without engine changes. |
| REQ-124 | AI coding assistants are allowed and encouraged. | §8 | OPTIONAL | — | Process documented; not a runtime feature. |

---

## 14. Required deliverables and documentation

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-130 | Running service via Docker Compose. | §9.1 | MANDATORY | 1, 6 | Compose health verified. |
| REQ-131 | `DECISIONS.md`, maximum 4 pages: architecture, forks taken, modeling approach and limits, what breaks at 10x. | §9.2 | MANDATORY | 8 | File exists and respects length intent. |
| REQ-132 | `MODEL.md`: formal model schema and math; verifiable from the document alone. | §9.3 | MANDATORY | 3, 8 | File documents schema + formulas. |
| REQ-133 | `VALIDATION.md`: validation set, results, error analysis, wrong cases. | §9.4 | MANDATORY | 7–8 | File exists with measured results. |
| REQ-134 | `NOT_DONE.md`, maximum 1 page: omissions and why (not penalized). | §9.5 | MANDATORY | 8 | File exists, ≤1 page intent. |
| REQ-135 | Cost and latency table (p50/p95, tokens, projected cost/1k). | §9.6 | MANDATORY | 7–8 | Present in submission docs. |

---

## 15. Explicitly excluded features

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-140 | No authentication. | §7 | OUT_OF_SCOPE | — | Not implemented. |
| REQ-141 | No multi-tenancy. | §7 | OUT_OF_SCOPE | — | Not implemented. |
| REQ-142 | No diagram rendering. | §7 | OUT_OF_SCOPE | — | Not implemented. |
| REQ-143 | No diagram image input. | §7 | OUT_OF_SCOPE | — | Not implemented. |
| REQ-144 | No CI/CD. | §7 | OUT_OF_SCOPE | — | Not required for submission. |
| REQ-145 | No Kubernetes manifests. | §7 | OUT_OF_SCOPE | — | Not implemented. |
| REQ-146 | No polished UI; minimal UI welcome only if under one hour. | §7 | OUT_OF_SCOPE / OPTIONAL | — | Default: no UI. |

---

## 16. Interview presentation and live defense requirements

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-150 | 60-minute remote session with screen share throughout. | §10 | MANDATORY | 8 | Prep checklist covers live environment. |
| REQ-151 | First 30 minutes: presentation covering problem/non-goals, architecture + LLM boundary, formal model/math/limits, live run, validation including failures. | §10 | MANDATORY | 8 | Interview outline exists; live demo rehearsed. |
| REQ-152 | Live run of the system (not recording/screenshots). | §10 | MANDATORY | 8 | Demo script uses running Compose stack. |
| REQ-153 | Last 30 minutes: questions including a live code change while watched. | §10 | MANDATORY | 8 | Repo navigable; env running; tooling ready. |
| REQ-154 | Slides optional and not evaluated. | §10 | OPTIONAL | 8 | — |

---

## 17. Evaluation criteria

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-160 | Boundary between what the model decides and what code computes. | §11 | MANDATORY | all | Architecture and tests make boundary explicit. |
| REQ-161 | Formal model is a real abstraction, not merely a JSON blob. | §11 | MANDATORY | 2 | Typed schema, provenance, validation semantics. |
| REQ-162 | Honesty about math limits. | §11 | MANDATORY | 3, 8 | MODEL.md / NOT_DONE.md state limits. |
| REQ-163 | Handling of incomplete, contradictory, and adversarial input. | §11 | MANDATORY | 2, 5, 7 | Fixtures cover these classes. |
| REQ-164 | Ability to defend decisions not taken. | §11 | MANDATORY | 8 | DECISIONS.md records rejected alternatives. |
| REQ-165 | Understanding of own code; narrow sharp system beats broad shallow one. | §11 | MANDATORY | all | Prefer minimal correct scope. |

---

## 18. Submission constraints

| ID | Requirement | PDF section | Class | Phase | Acceptance criterion |
| --- | --- | --- | --- | --- | --- |
| REQ-170 | Time budget: ~3 calendar days / ~15 hours effort. | Header | MANDATORY | — | Scope fits budget; NOT_DONE captures cuts. |
| REQ-171 | Submit by deadline (day 0 receive → day 4 09:00); nothing pushed after deadline. | §10 | MANDATORY | — | Process constraint for candidate. |
| REQ-172 | Keep repository private until the defense session. | §12 | MANDATORY | — | Remote visibility restricted until session. |
| REQ-173 | Code ownership remains with the candidate; publication after session is allowed. | §12 | OPTIONAL | — | Informational. |
| REQ-174 | Assumptions without asking are fine if written down; asking good questions counts favorably. | §13 | OPTIONAL | all | Assumptions recorded in outputs and decision logs. |

---

## Traceability matrix (requirements → phases → verification evidence)

| Phase | Requirement IDs | Planned verification evidence |
| --- | --- | --- |
| 1 Foundation | REQ-120, REQ-121, REQ-122, REQ-130 (partial) | `docker compose up`, health check, `.env.example`, lockfile, typecheck/test/lint |
| 2 Formal model & persistence | REQ-022, REQ-030, REQ-031, REQ-040–042, REQ-070, REQ-161 | Schema/Zod tests, persistence/version/diff tests, semantic validation fixtures |
| 3 Simulation engine | REQ-003, REQ-010–012 (engine side), REQ-021, REQ-050–052, REQ-060–062, REQ-071–073, REQ-083, REQ-132 (draft) | Pure `simulate()` unit tests, MODEL.md draft formulas |
| 4 Golden tests | REQ-011, REQ-080–083, REQ-060–062 | ≥8 golden cases with hand derivations; offline suite green |
| 5 LLM integration | REQ-012, REQ-020, REQ-100, REQ-111, REQ-123 | Fixture provider tests, injection fixtures, schema rejection tests |
| 6 API & observability | REQ-001–002, REQ-021–022, REQ-051–052, REQ-110, REQ-112, REQ-120, REQ-130 | Curl/HTTP collection, span assertions, measured stage latency |
| 7 Validation & benchmarking | REQ-090–098, REQ-113–114 | Validation dataset + measured accuracy/cost/latency tables |
| 8 Docs & interview prep | REQ-099, REQ-131–135, REQ-150–153, REQ-160–165, REQ-172 | Final docs present; demo checklist; private-repo note |

---

## Engineering decisions (not PDF mandates)

These are **our** choices. They support the PDF but are not quoted requirements.

| Decision ID | Decision | Rationale |
| --- | --- | --- |
| ENG-001 | Use TypeScript + NestJS + Drizzle + PostgreSQL + OpenTelemetry + Zod + Vitest. | Aligns with case production stack (§8) within 15h. |
| ENG-002 | Prefer closed-form analytical simulation over Monte Carlo / DES. | PDF §4 suggests closed-form is probably right for 3 days. |
| ENG-003 | No frontend. | PDF §7 allows skipping UI; REST + curl is enough. |
| ENG-004 | Ollama-compatible local inference as default zero-cost provider, with OpenAI-compatible abstraction. | Satisfies REQ-111 without spend. |
| ENG-005 | Compound Engineering memory: `AGENTS.md`, `docs/engineering/*`, and this specification. | Process discipline for interview-ready traceability. |
| ENG-006 | Eight implementation phases with stop-gates. | Budget control; PDF does not prescribe phases. |
| ENG-007 | Typed provenance / ASK·ASSUME·REFUSE / result status enums. | Makes REQ-050–052 objectively testable. |

---

## Requirement completion rule

A requirement may be marked complete in `docs/engineering/PHASES.md` **only** when:

1. Implementation exists in the repository, and  
2. Verification evidence is recorded (commands, test names, or measured outputs).

Do not mark requirements complete from plans or intention alone.
