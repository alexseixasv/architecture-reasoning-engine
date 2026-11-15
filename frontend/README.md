# Frontend — Architecture Reasoning Engine

Vue 3 + Vite + TypeScript + Tailwind SPA. Thin presentation layer over the NestJS API (Workspace + Evaluation Lab).

## Prerequisites

- Node.js 20+
- Backend API (Fake LLM recommended)

## Compose (production-built SPA)

From the repo root (`LLM_PROVIDER=fake` by default):

```bash
docker compose up -d --build
```

Open `http://127.0.0.1:8080` (`WEB_PORT`). nginx serves the SPA, proxies `/api/*` → Nest (prefix stripped), and forwards `/health`. No OpenAI secrets are baked into the frontend image.

Evaluation Lab UI is at `/evaluation`. Lab **API** endpoints stay **403** unless Compose demo override enables them:

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
```

HTTP acceptance through nginx:

```bash
npx tsx scripts/compose-frontend-acceptance.ts
npx tsx scripts/compose-evaluation-acceptance.ts   # requires demo override
```

## Local Vite (API on host)

```bash
# from repo root — API
docker compose up -d postgres
cp .env.example .env   # LLM_PROVIDER=fake
npm ci
npm run db:migrate
npm run start:dev
```

```bash
cd frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api/*` to `http://127.0.0.1:3000` (prefix stripped). For Lab API locally, set `EVAL_LAB_ENABLED=1` on the Nest process.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server + proxy |
| `npm run typecheck` | `vue-tsc` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (mocked API client) |
| `npm run build` | Production build to `dist/` |

## Notes

- Extraction never auto-persists.
- Version updates use `expectedVersion` OCC; HTTP 409 preserves unsaved JSON and never auto-retries.
- Semantic diff uses `GET /architectures/:id/diff?from=&to=` only.
- Evaluation Lab Run button never calls OpenAI; historical panel is sanitized evidence only.
- Contextual `InfoTooltip` icons use the shared glossary in `src/lib/glossary.ts` (interview explanations; no client-side math).
- No Nest CORS required for Vite/Compose same-origin `/api` routing.
- Do not set secrets in frontend env files.
