# AGENTS.md — Architecture Reasoning Engine

Instructions for humans and coding agents working in this repository.

## Authoritative sources

1. **Case requirements:** [docs/specification/TECHNICAL_REQUIREMENTS.md](docs/specification/TECHNICAL_REQUIREMENTS.md) (extracted from the hiring PDF).
2. **Engineering memory:** [docs/engineering/](docs/engineering/) (`DECISION_LOG.md`, `LEARNINGS.md`, `PHASES.md`).
3. This file: process invariants and workflow. Do **not** duplicate the full specification here.

## Compound Engineering loop

For every phase or substantive change:

`PLAN → IMPLEMENT → VERIFY → REVIEW → DOCUMENT → COMMIT → COMPOUND`

Before planning or implementing a phase:

1. Read [docs/specification/TECHNICAL_REQUIREMENTS.md](docs/specification/TECHNICAL_REQUIREMENTS.md).
2. Check the relevant requirement IDs for that phase (see the traceability matrix).
3. Read `docs/engineering/PHASES.md`, `DECISION_LOG.md`, and `LEARNINGS.md`.
4. Inspect existing code and patterns.
5. Propose a small plan; identify modules and tests; avoid unnecessary dependencies.

After implementing:

1. Run relevant tests, lint, and TypeScript checks.
2. Validate completed work against the requirement IDs and traceability matrix.
3. Record decisions in `docs/engineering/DECISION_LOG.md`.
4. Record reusable lessons and corrections in `docs/engineering/LEARNINGS.md`.
5. Update `docs/engineering/PHASES.md` with **actual** verification evidence.
6. Suggest a conventional commit message; do **not** commit or push unless the human explicitly asks.
7. Stop at phase boundaries unless the human approves the next phase.

**Never mark a requirement complete without implementation and verification evidence.**

## Architectural invariants

1. **No LLM-produced numbers.** Availability, latency, retries, capacity, saturation, throughput, blast radius, utilization, token/cost projections used as architecture answers — all must come from deterministic code or real measurements. See REQ-010–REQ-012.
2. **Simulation is pure.** `simulate(architecture, scenario) → SimulationResult` must not import NestJS, Drizzle, HTTP clients, LLM SDKs, or persistence.
3. **LLM roles only:** extract structured facts, interpret scenarios, explain grounded engine results.
4. **Missing data:** ASK / ASSUME / REFUSE — never silently invent defaults. Assumptions must be visible.
5. **Untrusted input:** architecture prose must not steer system behavior (REQ-100).
6. **Narrow and honest:** prefer a correct limited engine over a broad inaccurate one (REQ-073, REQ-165).

## Stack (engineering decision ENG-001)

Node.js LTS, TypeScript (strict), NestJS, PostgreSQL, Drizzle (from Phase 2), Zod, Vitest, Docker Compose, OpenTelemetry (Phase 6), Ollama-compatible + OpenAI-compatible provider abstraction (Phase 5).

## Phase rule

Implement exactly one phase at a time. Do not start the next phase without explicit human approval.

## Privacy

Keep the repository private until the defense session (REQ-172).
