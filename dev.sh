#!/usr/bin/env bash
# ThunderaFit — sobe Postgres, backend e frontend com um comando só.
# Uso:
#   ./dev.sh        # sobe tudo
#   ./dev.sh down   # derruba tudo (containers + processos)
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="3000"
FRONTEND_PORT="3001"
PID_DIR="$ROOT_DIR/.dev-pids"
POSTGRES_CONTAINER="thunderafit_postgres"
TEST_EMAIL_PERSONAL="personal@thunderafit.test"
TEST_EMAIL_ALUNO="aluno@thunderafit.test"
TEST_PASSWORD="SenhaSegura@123"

wait_for_http() {
  local url="$1"
  local label="$2"
  for i in $(seq 1 30); do
    if curl -sf "$url" > /dev/null 2>&1; then
      echo "$label respondendo."
      return 0
    fi
    sleep 1
  done
  echo "$label não respondeu a tempo." >&2
  return 1
}

kill_port() {
  local port="$1"
  local label="$2"
  # `npm run dev &` no Windows guarda o PID do processo errado (o wrapper do
  # npm, não o node/next real que escuta a porta) — matar só esse PID deixa
  # o processo filho vivo e a porta continua respondendo. Encontrar o PID
  # real pela porta via netstat e derrubar a árvore inteira com
  # `taskkill /T` é o jeito que realmente funciona neste ambiente.
  local pids
  pids=$(netstat -ano 2>/dev/null | grep -E "LISTENING" | grep ":$port " | awk '{print $NF}' | sort -u)
  if [ -z "$pids" ]; then
    echo "$label: nada escutando na porta $port."
    return 0
  fi
  for p in $pids; do
    taskkill //F //T //PID "$p" 2>/dev/null || true
  done
  echo "$label: processo(s) na porta $port derrubado(s)."
}

down() {
  echo "==> Parando backend e frontend..."
  kill_port "$BACKEND_PORT" "Backend"
  kill_port "$FRONTEND_PORT" "Frontend"
  rm -f "$PID_DIR/backend.pid" "$PID_DIR/frontend.pid"
  echo "==> Derrubando containers Docker..."
  (cd "$ROOT_DIR" && docker-compose down)
  echo "Tudo parado."
}

check_not_wsl() {
  # Este script assume Git Bash rodando direto no Windows (node_modules é
  # instalado com o npm do Windows, então os binários nativos como
  # node_modules/bcrypt são .node compilados para Windows/PE32+). Rodar este
  # mesmo dev.sh de dentro do WSL usa o node do Linux, que não consegue
  # carregar esse binário ("invalid ELF header") — além de netstat/taskkill
  # abaixo serem specificamente Windows. Falha cedo com uma mensagem clara em
  # vez de deixar o erro cair só depois de o servidor tentar subir.
  if grep -qi microsoft /proc/version 2>/dev/null; then
    echo "Este terminal parece ser WSL, não Git Bash do Windows." >&2
    echo "Este projeto instala dependências (ex: bcrypt) com o npm do Windows," >&2
    echo "então os binários nativos só funcionam com o node do Windows." >&2
    echo "Rode este script a partir do Git Bash (MINGW64), ou use .\\dev.ps1 no PowerShell." >&2
    exit 1
  fi
}

check_docker() {
  if ! docker info > /dev/null 2>&1; then
    echo "Docker não parece estar rodando (docker info falhou). Abra o Docker Desktop e tente de novo." >&2
    exit 1
  fi
}

check_port_free() {
  local port="$1"
  local label="$2"
  local pids
  pids=$(netstat -ano 2>/dev/null | grep -E "LISTENING" | grep ":$port " | awk '{print $NF}' | sort -u)
  if [ -n "$pids" ]; then
    echo "$label: a porta $port já está em uso (PID $(echo "$pids" | tr '\n' ' ')). Rode './dev.sh down' primeiro, ou libere a porta manualmente." >&2
    exit 1
  fi
}

if [ "${1:-up}" = "down" ]; then
  down
  exit 0
fi

echo "==> Pré-checagem (ambiente + Docker + portas livres)..."
check_not_wsl
check_docker
check_port_free "$BACKEND_PORT" "Backend"
check_port_free "$FRONTEND_PORT" "Frontend"

mkdir -p "$PID_DIR"

echo "==> Subindo PostgreSQL (docker-compose up -d)..."
(cd "$ROOT_DIR" && npm run db:up)

echo "==> Aguardando Postgres ficar saudável..."
healthy=false
for i in $(seq 1 30); do
  status=$(docker inspect --format='{{.State.Health.Status}}' "$POSTGRES_CONTAINER" 2>/dev/null || echo "starting")
  if [ "$status" = "healthy" ]; then
    healthy=true
    break
  fi
  sleep 2
done
if [ "$healthy" != "true" ]; then
  echo "Postgres não ficou saudável a tempo." >&2
  exit 1
fi
echo "Postgres saudável."

echo "==> Rodando migrations..."
(cd "$ROOT_DIR" && npx prisma migrate deploy) || { echo "Falha ao rodar migrations." >&2; exit 1; }

echo "==> Populando catálogo de exercícios (idempotente)..."
(cd "$ROOT_DIR" && npm run db:seed)

echo "==> Subindo backend (porta $BACKEND_PORT)..."
(cd "$ROOT_DIR" && nohup npm run dev > "$ROOT_DIR/.dev-backend.log" 2>&1 & echo $! > "$PID_DIR/backend.pid")

wait_for_http "http://localhost:$BACKEND_PORT/health" "Backend" || { echo "Veja $ROOT_DIR/.dev-backend.log"; exit 1; }

echo "==> Subindo frontend (porta $FRONTEND_PORT)..."
(cd "$ROOT_DIR/frontend" && nohup npm run dev > "$ROOT_DIR/.dev-frontend.log" 2>&1 & echo $! > "$PID_DIR/frontend.pid")

wait_for_http "http://localhost:$FRONTEND_PORT/login" "Frontend" || { echo "Veja $ROOT_DIR/.dev-frontend.log"; exit 1; }

echo "==> Garantindo usuário de teste (Personal + Aluno já vinculados)..."
PERSONAL_REG=$(curl -s -X POST "http://localhost:$BACKEND_PORT/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL_PERSONAL\",\"password\":\"$TEST_PASSWORD\",\"role\":\"PERSONAL\"}")
curl -s -X POST "http://localhost:$BACKEND_PORT/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL_ALUNO\",\"password\":\"$TEST_PASSWORD\",\"role\":\"ALUNO\"}" > /dev/null

PERSONAL_LOGIN=$(curl -s -X POST "http://localhost:$BACKEND_PORT/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL_PERSONAL\",\"password\":\"$TEST_PASSWORD\"}")
PERSONAL_TOKEN=$(echo "$PERSONAL_LOGIN" | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken' 2>/dev/null)

ALUNO_LOGIN=$(curl -s -X POST "http://localhost:$BACKEND_PORT/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL_ALUNO\",\"password\":\"$TEST_PASSWORD\"}")
ALUNO_ID=$(echo "$ALUNO_LOGIN" | node -pe 'JSON.parse(require("fs").readFileSync(0)).user.id' 2>/dev/null)

if [ -n "${PERSONAL_TOKEN:-}" ] && [ -n "${ALUNO_ID:-}" ]; then
  curl -s -X POST "http://localhost:$BACKEND_PORT/api/relations" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $PERSONAL_TOKEN" \
    -d "{\"alunoId\":\"$ALUNO_ID\"}" > /dev/null
fi

CRED_FILE="$ROOT_DIR/TEST_CREDENTIALS.txt"
cat > "$CRED_FILE" << EOF
ThunderaFit — Credenciais de Teste (geradas por dev.sh)
Gerado em: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

Personal Trainer:
  email: $TEST_EMAIL_PERSONAL
  senha: $TEST_PASSWORD

Aluno (já vinculado ao Personal acima):
  email: $TEST_EMAIL_ALUNO
  senha: $TEST_PASSWORD

Login do aluno pelo frontend: http://localhost:$FRONTEND_PORT/login
Uso do Personal (sem tela própria nesta fase): via curl/Postman, header
"Authorization: Bearer <accessToken>" obtido em POST /api/auth/login.
EOF
echo "Credenciais de teste salvas em $CRED_FILE (arquivo no .gitignore)."

echo ""
echo "ThunderaFit rodando:"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo ""
echo "Para derrubar tudo: ./dev.sh down"
