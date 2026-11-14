# Phases

Eight stop-gated phases. Mark requirements complete only with implementation + verification evidence.

| Phase | Name | Status |
| --- | --- | --- |
| 1 | Foundation and engineering rules | complete (pending human review) |
| 2 | Formal model and persistence | pending |
| 3 | Deterministic simulation engine | pending |
| 4 | Golden tests | pending |
| 5 | LLM integration | pending |
| 6 | API and observability | pending |
| 7 | Validation and benchmarking | pending |
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

### Suggested commit

`chore: bootstrap foundation with requirements spec and nestjs compose`

---

## Phase 2 — Formal model and persistence

Pending. Primary REQs: REQ-022, REQ-030–031, REQ-040–042, REQ-070, REQ-161.

## Phase 3 — Deterministic simulation engine

Pending. Primary REQs: REQ-003, REQ-010–012, REQ-021, REQ-050–052, REQ-060–062, REQ-071–073, REQ-083.

## Phase 4 — Golden tests

Pending. Primary REQs: REQ-080–083.

## Phase 5 — LLM integration

Pending. Primary REQs: REQ-020, REQ-100, REQ-111, REQ-123.

## Phase 6 — API and observability

Pending. Primary REQs: REQ-001–002, REQ-110, REQ-112, REQ-130.

## Phase 7 — Validation and benchmarking

Pending. Primary REQs: REQ-090–098, REQ-113–114.

## Phase 8 — Documentation and interview preparation

Pending. Primary REQs: REQ-131–135, REQ-150–153, REQ-172.
