# QA.md — Technical defense Q&A (20–25)

Concise answers grounded in this repository. **Do not claim features that do not exist.**

---

### 1. Why use an LLM at all?
Prose → typed facts and scenario classification is ambiguous; explanation needs language. The LLM never computes architecture metrics (`src/llm/**` vs `src/simulation/**`).

### 2. Why deterministic simulation?
Hand-verifiable, golden-testable, interview-defensible (REQ-010–011). Closed-form fits the ~15h budget (`DECISIONS.md`, ENG-002).

### 3. What are the core mathematical assumptions?
Steady-state; graphs ≤15; offered load ≠ successful throughput; \(U=\lambda/C\); saturation \(U\ge1\); sync-only load edges; no invented fan-out (`MODEL.md`).

### 4. How do you handle missing data?
ASK recommendations via completeness; ASSUME only when listed on the result; REFUSE with `reasonCode` — never silent zeros (`completeness.ts`, `simulate.ts`).

### 5. When do you refuse?
Unsupported scenario types; missing traffic/capacity/fan-out; sync cycles for load; backoff preventing instantaneous retry rate; always availability %, throughput, p95/p99.

### 6. How do you prevent prompt injection from steering numbers?
Untrusted delimiters; Structured Outputs schema; Zod + provenance; `simulate` ignores NL; ADV-01/ADV-08 (`tests/adversarial`).

### 7. What is provenance?
Declared quantities need verified `sourceExcerpt` substrings; provenance enum on quantities (`declared|user_confirmed|assumed|computed`). Provenance reject ≠ invent.

### 8. How accurate is extraction?
Measured on fixed V01–V12 OpenAI: remediation **141/244** field (directional), Node F1 **0.86**, Dep F1 **0.84**. Omissions remain. Fake demos ≠ accuracy (`VALIDATION.md`).

### 9. Why not claim end-to-end NL accuracy?
Live scenario scoring used **formal** architecture context. Extract→scenario chaining was **not** measured.

### 10. What do golden tests prove?
Engine metrics/refusals match hand oracles G01–G12 + `DERIVATION.md` — offline, no LLM (`tests/golden`).

### 11. What are evaluation limitations?
Small fixed set; same-dataset remediation; denom shift; N=12 latency; estimated USD ≠ invoice; no held-out generalization claim.

### 12. How does versioning work?
Immutable rows per version; list/get by id+version; corrections create new versions (`architecture.repository.ts`).

### 13. How does OCC work?
`PUT` requires `expectedVersion`; transactional CAS on `latest_version`; HTTP **409** with expected/actual; UI never auto-retries (`useArchitectureSession.ts`).

### 14. Why PostgreSQL + Drizzle?
Durable multi-version history + transactional OCC for Compose reproducibility. Rejected in-memory-only for submission.

### 15. What are the API boundaries?
Extract (no persist) · validate · create/update · get/list/diff · analyze exact version. Analysis never silently substitutes latest.

### 16. What does the frontend do / not do?
Thin Vue client: call APIs, preserve drafts, show evidence. **No** client-side util/load math (`frontend/`).

### 17. How are failures surfaced?
HTTP 400/404/409/503 for infra/validation; domain `UNSUPPORTED` / `NOT_ANSWERABLE` / explain fallback return **200** with structured fields.

### 18. Cost and latency?
Per-response `usage` + `timingsMs`. Live projections A/B/C in VALIDATION. Fake costs often `null`. p50/p95 are request timings with small N.

### 19. Security posture?
No auth (OUT_OF_SCOPE). Untrusted architecture text; size limits; sanitized error logs; secrets not in frontend image. Not a hardened multi-tenant service.

### 20. Scalability?
Fits ≤15-node analytical graphs. Horizontal scale / HA Postgres not built. OCC serializes conflicting writers per architecture.

### 21. Production readiness?
Demo-grade Compose service: missing authz, rate limits, OTel collector, CI, spend guards. Honest in `NOT_DONE.md`.

### 22. Why Vue instead of Next?
Optional UI after API correctness; Vite+nginx same-origin proxy; Nest already covers API (D-030). PDF did not require polished UI.

### 23. Why refuse availability % instead of a simple formula?
PDF example lacks a defensible failure-probability model (OQ-001). Inventing % would violate REQ-010/073. Target may be stored; never computed against.

### 24. What is blast radius here?
Qualitative exposure labels + paths (`unavailability.ts`). Not “2 of 4 services degraded” counts without definitions (OQ-002).

### 25. What would you improve next?
Reduce DTO omissions/ID slugs; measure extract→scenario e2e on held-out data; optional OTel; richer exposure **only** with formal definitions (`NOT_DONE.md`).
