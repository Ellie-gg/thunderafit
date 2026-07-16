# ThunderaFit backend (Fastify + Prisma). 2-stage build:
#   builder -> compiles TS + generates the Prisma client
#   runner  -> lean runtime image, prod-only deps + compiled output
#
# Node version pinned to match .nvmrc/package.json "engines" (see those files
# if this tag ever needs bumping — nothing else should need to change).
FROM node:25-slim AS builder
WORKDIR /app

# Must match the runner stage's OpenSSL install below — `prisma generate`
# picks its query-engine binary target based on what it detects *here*, at
# build time. Skipping this in the builder makes Prisma silently guess
# "debian-openssl-1.1.x", which then fails to load at runtime in the actual
# runner image (real mismatch hit while smoke-testing this image).
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune devDependencies out of node_modules for the runner stage, but keep
# the generated Prisma client (prisma generate writes into node_modules).
RUN npm prune --omit=dev

FROM node:25-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Prisma's query engine needs libssl present at runtime to detect the right
# binary target — node:*-slim doesn't ship it, and without it Prisma silently
# guesses "openssl-1.1.x" (real bug hit while smoke-testing this image: it
# then also tries to fetch/write an engine binary at container boot).
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Cloud Run (and most container platforms) refuse to run as root by default
# best practice — create an unprivileged user instead of using node:*-slim's
# implicit root.
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /bin/false app

# --chown is required: `prisma migrate deploy` at boot (docker/start-backend.sh)
# needs write access under node_modules/@prisma/engines — without it, running
# as a non-root user fails with "Can't write to .../@prisma/engines" (also
# hit while smoke-testing).
COPY --from=builder --chown=app:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=app:nodejs /app/dist ./dist
COPY --from=builder --chown=app:nodejs /app/prisma ./prisma
COPY --chown=app:nodejs package.json ./
COPY --chown=app:nodejs docker/start-backend.sh ./docker/start-backend.sh
RUN chmod +x ./docker/start-backend.sh

USER app

# Cloud Run injects $PORT at runtime; src/server.ts already reads it.
CMD ["./docker/start-backend.sh"]
