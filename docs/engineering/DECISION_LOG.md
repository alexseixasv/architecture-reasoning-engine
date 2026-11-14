# Decision Log

Append-only record of meaningful engineering decisions. Final submission also consolidates into `DECISIONS.md` (Phase 8).

## D-001 — Adopt NestJS / TypeScript / Postgres stack (2026-11-14)

- **Context:** PDF §8 allows any stack; production stack is TS/NestJS/Drizzle/Postgres/OTel/Next.
- **Decision:** Use NestJS + strict TypeScript + PostgreSQL + Drizzle (from Phase 2) + Vitest + Zod. No frontend.
- **Alternatives rejected:** Python/FastAPI (weaker alignment with panel stack); Express-only (less structure for interview navigation).
- **Consequences:** Faster interviewer familiarity; Nest DI must not leak into pure simulation module.

## D-002 — Closed-form analytical engine (2026-11-14)

- **Context:** PDF §4 allows closed-form, Monte Carlo, or discrete-event.
- **Decision:** Closed-form analytical formulas only for the 15h budget.
- **Alternatives rejected:** Monte Carlo / DES (harder to hand-verify in defense).
- **Consequences:** Document limits honestly in MODEL.md; refuse unsupported stochastic claims.

## D-003 — Postgres in Compose from Phase 1 (2026-11-14)

- **Context:** Persistence is Phase 2, but REQ-120 requires clean-machine Compose.
- **Decision:** Compose runs `api` + `postgres` in Phase 1; no application tables until Phase 2.
- **Consequences:** Early reproducibility proof; empty DB until migrations land.

## D-004 — Defer Ollama Compose service to Phase 5 (2026-11-14)

- **Context:** Zero-cost LLM is required later (REQ-111); model weights complicate Phase 1 bootstrap.
- **Decision:** Document LLM env placeholders in `.env.example`; do not start Ollama in Phase 1 Compose.
- **Consequences:** Phase 1 `docker compose up` stays reliable without GPU/model download.

## D-005 — Version-controlled TECHNICAL_REQUIREMENTS.md (2026-11-14)

- **Context:** PDF lives outside the repo; agents need durable requirement IDs.
- **Decision:** Extract PDF into `docs/specification/TECHNICAL_REQUIREMENTS.md` with REQ-IDs and phase mapping.
- **Consequences:** Compound Engineering can cite requirements without inventing scope.
