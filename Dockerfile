# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Evaluation Lab stays off unless the demo/compose override sets EVAL_LAB_ENABLED=1
ENV EVAL_LAB_ENABLED=0
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
# Deterministic Evaluation Lab fixtures (allowlisted paths; no Vitest specs)
COPY --from=build /app/tests/golden ./tests/golden
COPY --from=build /app/tests/validation ./tests/validation
COPY --from=build /app/tests/adversarial ./tests/adversarial
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
