#!/bin/sh
# Cloud Build's native continuous deployment has no separate pipeline step
# for migrations, so they run here, at container boot, instead. Safe under
# Cloud Run's scale-from-zero bursts: `prisma migrate deploy` takes a
# Postgres advisory lock, so concurrent cold-start instances racing this
# don't corrupt anything — the losers just wait/no-op.
#
# Fase 122 — retry limitado. O `migrate deploy` roda contra um banco que pode
# estar ACORDANDO do autosuspend (Neon suspende após 5 min de inatividade, e no
# plano Free isso não é configurável), então a primeira tentativa pode estourar
# o timeout de 10s do advisory lock sem que exista nada de errado com a
# migration. Quando isso acontece o container não sobe e o DEPLOY INTEIRO falha
# — foi o que derrubou o merge da Fase 119 (build 316b3fe5).
#
# Retry BOUNDED de propósito (3 tentativas, backoff crescente): absorve a falha
# transitória, mas se a migration estiver realmente quebrada o container ainda
# sai com erro e o Cloud Run mantém a revisão anterior no ar. Fail-closed
# continua sendo o comportamento final — o retry só evita chamar de "quebrado"
# aquilo que era só lentidão.
#
# A correção de RAIZ do vazamento de lock é o `directUrl` em
# prisma/schema.prisma (migrations pela conexão DIRETA, não pelo PgBouncer).
# Este retry é a segunda camada, pra latência de cold start.
set -e

MAX_TENTATIVAS=3

tentativa=1
while true; do
  if npx prisma migrate deploy; then
    break
  fi

  if [ "$tentativa" -ge "$MAX_TENTATIVAS" ]; then
    echo "migrate deploy falhou em $MAX_TENTATIVAS tentativas — abortando o boot (a revisão anterior segue no ar)." >&2
    exit 1
  fi

  espera=$((tentativa * 5))
  echo "migrate deploy falhou (tentativa $tentativa/$MAX_TENTATIVAS). Nova tentativa em ${espera}s..." >&2
  sleep "$espera"
  tentativa=$((tentativa + 1))
done

exec node dist/server.js
