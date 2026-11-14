# Architecture Reasoning Engine

Deterministic architecture analysis service for “what happens if” questions. Natural language is used only to extract and explain; **all numbers come from hand-verifiable code**.

**Status:** Phase 1 foundation (Compose + health). Simulation, formal model persistence, and LLM extraction are not implemented yet.

## Requirements source

Case requirements are version-controlled in [docs/specification/TECHNICAL_REQUIREMENTS.md](docs/specification/TECHNICAL_REQUIREMENTS.md). Agent process rules: [AGENTS.md](AGENTS.md).

## Prerequisites

- Node.js 20+ (22 recommended)
- Docker and Docker Compose

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Health check:

```bash
curl http://localhost:3000/health
```

Expected shape:

```json
{
  "status": "ok",
  "service": "architecture-reasoning-engine",
  "version": "0.1.0",
  "timestamp": "..."
}
```

## Local development

```bash
cp .env.example .env
npm ci
npm run start:dev
```

Verification scripts:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## What exists vs what does not

| Present (Phase 1) | Not yet |
| --- | --- |
| NestJS API + `/health` | Formal architecture model / persistence |
| PostgreSQL via Compose (no app tables yet) | Deterministic simulation engine |
| Engineering memory + REQ specification | LLM extraction / explanation |
| Vitest smoke tests | Golden tests, validation dataset, OTel |

## Planned module layout (later phases)

```
src/
  architecture/   # formal model domain + Nest adapters
  simulation/     # pure deterministic engine (no Nest/ORM/LLM imports)
  ai/             # provider abstraction, extraction, explanation
  observability/
  persistence/
  common/
```

## Privacy

Keep this repository private until the hiring defense session (REQ-172).
