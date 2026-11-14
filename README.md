# Architecture Reasoning Engine

Deterministic architecture analysis service for “what happens if” questions. Natural language is used only to extract and explain; **all numbers come from hand-verifiable code**.

**Status:** Phase 2 — versioned formal model + Postgres persistence. Simulation and LLM extraction are not implemented yet.

## Requirements source

Case requirements: [docs/specification/TECHNICAL_REQUIREMENTS.md](docs/specification/TECHNICAL_REQUIREMENTS.md). Agent process: [AGENTS.md](AGENTS.md).

## Prerequisites

- Node.js 20+ (22 recommended)
- Docker and Docker Compose

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

```bash
curl http://localhost:3000/health
curl -s -X POST http://localhost:3000/architectures \
  -H "Content-Type: application/json" \
  --data-binary @tests/fixtures/architectures/checkout-pricing.json
```

## Architecture APIs (Phase 2)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/architectures/validate` | Validate only |
| POST | `/architectures` | Create v1 (rejects schema/referential ERRORs) |
| GET | `/architectures/:id` | Latest version |
| GET | `/architectures/:id/versions` | Version list |
| GET | `/architectures/:id/versions/:version` | Inspect immutable version |
| PUT | `/architectures/:id` | Body `{ expectedVersion, document }` — OCC; `409` on conflict |
| GET | `/architectures/:id/diff?from=&to=` | Deterministic semantic diff |

Semantic warnings (sync cycles, missing timeouts, retries without backoff, SPOF) are reported but do **not** block persistence. Scenario answerability is Phase 3.

## Local development

```bash
cp .env.example .env
npm ci
# ensure Postgres is up (docker compose up postgres -d)
npm run db:migrate
npm run start:dev
```

```bash
npm run typecheck
npm run lint
npm test
npm run test:integration   # requires DATABASE_URL
npm run build
```

## Module layout

```
src/
  architecture/
    domain/           # pure types, Zod schema, findings (no Nest/Drizzle)
    application/      # validate, diff, service
    infrastructure/   # repository
    presentation/     # Nest controller/module
  persistence/        # Drizzle client + migrations runner
  health/
```

## What exists vs what does not

| Present | Not yet |
| --- | --- |
| Formal model + Zod validation | Deterministic simulation engine |
| Immutable version history + OCC | LLM extraction / explanation |
| Manual correction + diffs | OpenTelemetry / analysis endpoints |
| Unit + Postgres integration tests | Golden numerical tests |

## Privacy

Keep this repository private until the hiring defense session (REQ-172).
