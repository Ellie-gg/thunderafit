# ThunderaFit frontend (Next.js, App Router). 3-stage build using
# `output: "standalone"` (next.config.ts) — without it the image would ship
# the entire node_modules tree + full .next build cache.
#
# Node version pinned to match ../.nvmrc/package.json "engines".
FROM node:25-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:25-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# BACKEND_URL is read at request time by app/api/[...path]/route.ts, not at
# build time — nothing backend-URL-related needs to be known here.
RUN npm run build

FROM node:25-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /bin/false app

# `output: "standalone"` doesn't include public/ or .next/static by default
# (see Next.js docs) — copied in manually, same as the canonical recipe.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER app

# Cloud Run injects $PORT at runtime; the standalone server.js reads it.
CMD ["node", "server.js"]
