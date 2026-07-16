# ThunderaFit

SaaS de gestão de treinos para Personal Trainers. Backend (Fastify + Prisma + PostgreSQL) e frontend (Next.js) rodam como dois projetos separados.

## Subir o ambiente (modo rápido)

- **Windows (PowerShell):** `.\dev.ps1`
- **Windows (Git Bash):** `./dev.sh`

Sobe Postgres, roda migrations/seed e inicia backend + frontend. Para derrubar tudo: `.\dev.ps1 down` ou `./dev.sh down`. Credenciais de teste ficam em `TEST_CREDENTIALS.txt`.

> Os dois scripts assumem Windows (usam `netstat`/`taskkill`, e os módulos nativos do `node_modules` são compilados para Windows). Não há suporte a WSL/Linux nativo hoje — rodar `./dev.sh` de dentro do WSL falha (`bcrypt` com binário Windows, ELF inválido no Linux); o script detecta isso e avisa.

## Pré-requisitos

- Node.js 18+
- Docker (para o PostgreSQL)

## 1. Configurar variáveis de ambiente (backend)

Copie o exemplo e ajuste se necessário (os valores padrão já funcionam com o `docker-compose.yml`):

```bash
cp .env.example .env
```

## 2. Subir o banco de dados

Na raiz do projeto:

```bash
npm install
npm run db:up        # sobe o PostgreSQL via docker-compose
npm run db:migrate   # aplica as migrations do Prisma
npm run db:seed      # popula o catálogo de exercícios (~29 exercícios)
```

## 3. Rodar o backend

Ainda na raiz:

```bash
npm run dev
```

A API sobe em `http://localhost:3000`. Teste com:

```bash
curl http://localhost:3000/health
```

## 4. Rodar o frontend

Em outro terminal, entre na pasta `frontend`:

```bash
cd frontend
npm install
npm run dev
```

O frontend sobe em `http://localhost:3001` (porta fixa, pois o backend já usa a 3000). Acesse `http://localhost:3001` no navegador — a tela inicial mostra os 3 perfis (Personal/Aluno/Nutricionista) para login/cadastro.

A URL do backend é configurada em `frontend/.env.local` (`BACKEND_URL`). O proxy server-side em `frontend/app/api/[...path]/route.ts` repassa chamadas `/api/*` para essa URL do lado do servidor, então o navegador nunca fala diretamente com o backend (evita problemas de CORS, e em produção anexa o token de identidade exigido pelo backend com invocação restrita por IAM no Cloud Run).

## 5. Rodar os testes do backend

```bash
npm test
```

## Fluxo básico para testar manualmente

1. Crie uma conta como **Personal Trainer** em `/register`.
2. Como o cadastro de aluno e a prescrição de treino ainda não têm tela própria (fora do escopo do MVP), use `curl`/Postman com o token do Personal para:
   - Registrar um aluno (`POST /api/auth/register` com `role: "ALUNO"`)
   - Vincular o aluno (`POST /api/relations`)
   - Criar um treino (`POST /api/workouts`) e adicionar exercícios (`POST /api/workouts/:id/exercises`) — a lista de exercícios do catálogo está em `GET /api/exercises`.
3. Faça login como o **aluno** no frontend (`/login`) — o dashboard e a lista de treinos (`/treinos`) já mostram os dados reais vindos da API, e a execução do treino (`/treinos/:id`) permite registrar séries.

## Estrutura do projeto

```
/src            backend (Fastify) — auth, fitness (exercícios, treinos, séries)
/prisma         schema, migrations e seed do banco
/frontend       frontend (Next.js) — telas do aluno
/infra          Terraform (GCP: Cloud Run, Artifact Registry, Cloud Build, Secret Manager)
/docker         scripts usados dentro dos Dockerfiles (ex: migration na subida do backend)
STATUS.md       histórico de progresso do projeto por fase
```

## Branches e deploy

- **`main`** é produção. Todo push em `main` dispara build+deploy automático no Cloud Run (via Cloud Build, configurado no Terraform em `infra/` — sem pipeline YAML nenhum, é nativo do Cloud Run).
- **`dev`** é onde o trabalho do dia a dia acontece antes de virar PR para `main`. Não tem deploy automático — só existe o ambiente de produção.
- `dev.sh`/`dev.ps1` existem nas duas branches (são inertes em produção, nada no pipeline os executa — não há necessidade de removê-los de `main`).
- Ver `infra/README.md` para o bootstrap da infraestrutura (GCP, Neon, Terraform) e `infra/RUNBOOK.md` para rollback e operação.
