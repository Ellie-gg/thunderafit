# ThunderaFit — Frontend

Frontend Next.js (App Router) do ThunderaFit — telas do aluno e do Personal Trainer.
Ver o `README.md` da raiz do projeto para como subir o backend + banco.

## Rodando em desenvolvimento

```bash
npm install
npm run dev
```

Sobe em `http://localhost:3001`. Requer o backend rodando em `http://localhost:3000`
(configurável via `BACKEND_URL` em `.env.local`, ver `.env.example`).

## Testes

Há 3 camadas de teste, cada uma com um propósito diferente:

### 1. Unidade / componente (Jest + React Testing Library)

Componentes isolados, com `fetch` e dependências externas mockadas — não precisa do
backend rodando.

```bash
npm test          # roda uma vez
npm run test:watch  # modo watch
```

Cobre: `AuthGuard` (redirecionamento por `allowedRoles`), a tela de vincular aluno
(os 3 estados de erro — 404/409/403), e o formulário de registro de série
(`ExerciseExecutionCard`).

### 2. Integração de API client (Jest, mockando `fetch`)

Testa `lib/api/*.ts` diretamente — que a URL/método/corpo chamados estão corretos, que
o refresh automático de 401 funciona, e que erros de negócio (403, etc.) viram
`ApiError` com o status certo. Rodam junto com os testes de unidade (`npm test`), em
`__tests__/lib/api/`.

### 3. E2E (Playwright)

Cobre o fluxo crítico completo: login → dashboard → treino → registro de série, contra
um backend real rodando (não mockado). Usa o Google Chrome já instalado na máquina
(`channel: "chrome"` em `playwright.config.ts`) em vez de baixar o Chromium do
Playwright.

**Pré-requisitos:** backend + Postgres rodando (na raiz do projeto: `./dev.sh` ou
`.\dev.ps1`) e o frontend também (`npm run dev` aqui, porta 3001).

```bash
npm run test:e2e
```

O teste cria seus próprios dados (Personal, Aluno, vínculo, treino, exercício) direto
via chamadas HTTP ao backend antes de exercitar a UI — não depende de
`TEST_CREDENTIALS.txt` nem de estado prévio do banco.

## Estrutura

```
app/                 rotas (App Router)
components/          componentes compartilhados (design system "Voltagem")
lib/                 API client, store de sessão (Zustand), tipos
__tests__/           testes de unidade/componente e de lib/api (Jest)
e2e/                 testes E2E (Playwright)
```
