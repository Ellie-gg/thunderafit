# ThunderaFit

SaaS de gestão de treinos para Personal Trainers. Backend (Fastify + Prisma + PostgreSQL) e frontend (Next.js) rodam como dois projetos separados.

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

O frontend sobe em `http://localhost:3001` (porta fixa, pois o backend já usa a 3000). Acesse `http://localhost:3001` no navegador — a tela inicial redireciona para login/registro automaticamente.

A URL do backend é configurada em `frontend/.env.local` (`NEXT_PUBLIC_API_URL`). O `next.config.ts` do frontend repassa chamadas `/api/*` para essa URL do lado do servidor, então o navegador nunca fala diretamente com o backend (evita problemas de CORS).

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
STATUS.md       histórico de progresso do projeto por fase
```
