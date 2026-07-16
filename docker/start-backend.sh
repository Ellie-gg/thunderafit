#!/bin/sh
# Cloud Build's native continuous deployment has no separate pipeline step
# for migrations, so they run here, at container boot, instead. Safe under
# Cloud Run's scale-from-zero bursts: `prisma migrate deploy` takes a
# Postgres advisory lock, so concurrent cold-start instances racing this
# don't corrupt anything — the losers just wait/no-op.
set -e
npx prisma migrate deploy
exec node dist/server.js
