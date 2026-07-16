# Status do Projeto: SaaS Fitness MVP

## 2026-07-15 - Executado por gpt-oss:20b via Ollama Cloud (Claude Code fork)
- **O que foi feito:** Implementação do domínio de relacionamento entre Personal Trainer e Alunos, adicionando modelo ClientRelation, endpoints POST /api/relations e GET /api/relations, com validações de limite freemium, checagem de existência, e testes automatizados.
- **Arquivos Criados/Modificados:** src/fitness/repository/relations.repository.ts, src/fitness/services/relations.service.ts, src/fitness/controllers/relations.controller.ts, src/fitness/routes/relations.routes.ts, src/fitness/__tests__/relations.test.ts, src/app.ts, prisma/schema.prisma
- **Evidência / Status dos Testes:**
  ```
  Applying migration `20260715141455_add_client_relation`

  The following migration(s) have been created and applied from new schema changes:

  migrations/
    └─ 20260715141455_add_client_relation/
      └─ migration.sql

  Your database is now in sync with your schema.

  Running generate... - Prisma Client
  ✔ Generated Prisma Client (v5.22.0) to .\\node_modules\\@prisma\\client in 783ms
  ```
  ```
  POST /api/relations 1st: status 201
  {"relation":{"id":"91343008-5955-43bb-af36-fa34abb18699","personalId":"6922be80-7bf8-4d7f-8ab1-47d606e0c14d","alunoId":"a920394f-c7d7-427d-bc7c-0cab06ef08d0","professionalType":"PERSONAL","createdAt":"2026-07-15T14:23:27.570Z"}}

  POST /api/relations 2nd: status 201
  {"relation":{"id":"a18866ce-f9ee-4513-9d0a-e3c033e06e0f","personalId":"6922be80-7bf8-4d7f-8ab1-47d606e0c14d","alunoId":"fe665608-0096-490d-b8c6-a472e1b517f9","professionalType":"PERSONAL","createdAt":"2026-07-15T14:23:27.595Z"}}

  POST /api/relations 3rd: status 201
  {"relation":{"id":"508f4f32-219c-4681-89bf-18f96f3a0e01","personalId":"6922be80-7bf8-4d7f-8ab1-47d606e0c14d","alunoId":"a411d872-2e24-4190-bd75-7332d923ddda","professionalType":"PERSONAL","createdAt":"2026-07-15T14:23:27.625Z"}}

  POST /api/relations 4th: status 403
  {"error":"Limite de alunos atingido."}

  POST /api/relations duplicate: status 409
  {"error":"Vínculo já existe."}

  POST /api/relations nonexistent: status 404
  {"error":"Aluno não encontrado ou role inválida."}

  GET /api/relations: status 200
  {"relations":[{"id":"a920394f-c7d7-427d-bc7c-0cab06ef08d0","email":"manual_student1@thunderafit.test","createdAt":"2026-07-15T14:23:27.570Z"},{"id":"fe665608-0096-490d-b8c6-a472e1b517f9","email":"manual_student2@thunderafit.test","createdAt":"2026-07-15T14:23:27.595Z"},{"id":"a411d872-2e24-4190-bd75-7332d923ddda","email":"manual_student3@thunderafit.test","createdAt":"2026-07-15T14:23:27.625Z"}]}
  ```
  PASS src/fitness/__tests__/relations.test.ts (6.392 s)
  PASS src/auth/__tests__/auth.test.ts
  Test Suites: 2 passed, 2 total
  Tests:       13 passed, 13 total
  Snapshots:   0 total
  Time:        9.774 s
  Ran all test suites.

## 2026-07-15 - Executado por Claude Code (Sonnet 5)
- **O que foi feito:** Implementado o catálogo de exercícios (seed curado com 29 exercícios) e a prescrição de treinos pelo Personal Trainer. Adicionados os models `Exercise`, `Workout` e `WorkoutExercise` ao schema (já haviam sido rascunhados por uma tentativa anterior travada, mas sem migration aplicada nem unique constraint em `Exercise.name`; isso foi corrigido). Corrigido `prisma/seed.ts`, que também era um resquício da tentativa anterior e importava um campo (`exercise_pods`) que não existe no JSON — reescrito para importar o array diretamente e fazer upsert por `name`. Implementados os endpoints `GET /api/exercises`, `POST /api/workouts` (valida vínculo `ClientRelation` antes de prescrever, retorna 403 se não vinculado), `POST /api/workouts/:id/exercises` (valida que o treino pertence ao Personal autenticado) e `GET /api/workouts/:id` (retorna treino com exercícios via include do Prisma). Nenhuma dependência nova foi adicionada; `package.json` não foi tocado (o script `db:seed` já existia).
- **Arquivos Criados/Modificados:** data/exercises_seed.json (novo), prisma/schema.prisma (models Exercise/Workout/WorkoutExercise + unique em Exercise.name), prisma/migrations/20260715195217_add_exercise_workout/migration.sql (novo), prisma/seed.ts (corrigido), src/fitness/repository/exercises.repository.ts (novo), src/fitness/services/exercises.service.ts (novo), src/fitness/controllers/exercises.controller.ts (novo), src/fitness/routes/exercises.routes.ts (novo), src/fitness/repository/workouts.repository.ts (novo), src/fitness/services/workouts.service.ts (novo), src/fitness/controllers/workouts.controller.ts (novo), src/fitness/routes/workouts.routes.ts (novo), src/fitness/__tests__/workouts.test.ts (novo), src/app.ts (registro das novas rotas)
- **Evidência / Status dos Testes:**
  ```
  > npx prisma migrate dev --name add_exercise_workout

  Applying migration `20260715195217_add_exercise_workout`

  The following migration(s) have been created and applied from new schema changes:

  migrations/
    └─ 20260715195217_add_exercise_workout/
      └─ migration.sql

  Your database is now in sync with your schema.

  Running generate... - Prisma Client
  ✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in 2.17s
  ```
  ```
  > npm run db:seed

  Seeding 29 exercises...
  Seeding complete.
  ```
  ```
  GET /api/exercises: HTTP_STATUS:200 — count: 29 exercícios retornados

  POST /api/workouts (aluno vinculado): HTTP_STATUS:201
  {"workout":{"id":"8aba8e25-a301-4441-a0b7-24c7e167f26b","personalId":"74c0f5d2-8452-4d8a-be32-84d04166eb06","alunoId":"262bfe50-fc0c-42ad-8e9f-839ea410a317","name":"Treino A - Peito e Triceps","letter":"A","createdAt":"2026-07-15T19:59:44.480Z","updatedAt":"2026-07-15T19:59:44.480Z"}}

  POST /api/workouts (aluno NÃO vinculado): HTTP_STATUS:403
  {"error":"Aluno não vinculado a este Personal Trainer."}

  POST /api/workouts/:id/exercises (3x): HTTP_STATUS:201 em todas
  {"workoutExercise":{"id":"35f9d09c-e7f1-411e-bc2e-286ef558c3a5","workoutId":"8aba8e25-a301-4441-a0b7-24c7e167f26b","exerciseId":"07675656-b609-4c8c-8138-6a6e4e17f4c8","sets":4,"repsRange":"8-12","restSeconds":60,"order":1,"createdAt":"2026-07-15T20:00:00.192Z","updatedAt":"2026-07-15T20:00:00.192Z"}}
  {"workoutExercise":{"id":"b8e9a579-10ca-42da-b05b-9f93fb36bca7","workoutId":"8aba8e25-a301-4441-a0b7-24c7e167f26b","exerciseId":"39bc2e96-899a-4e46-b691-2cda8db2d307","sets":3,"repsRange":"10-15","restSeconds":45,"order":2,"createdAt":"2026-07-15T20:00:00.654Z","updatedAt":"2026-07-15T20:00:00.654Z"}}
  {"workoutExercise":{"id":"b4a913d1-8890-4747-9d91-a2329164c1eb","workoutId":"8aba8e25-a301-4441-a0b7-24c7e167f26b","exerciseId":"8bedc12f-c91c-4c05-a0d6-9aab48bc668e","sets":3,"repsRange":"12-15","restSeconds":45,"order":3,"createdAt":"2026-07-15T20:00:01.053Z","updatedAt":"2026-07-15T20:00:01.053Z"}}

  GET /api/workouts/:id: HTTP_STATUS:200
  {"workout":{"id":"8aba8e25-a301-4441-a0b7-24c7e167f26b","personalId":"74c0f5d2-8452-4d8a-be32-84d04166eb06","alunoId":"262bfe50-fc0c-42ad-8e9f-839ea410a317","name":"Treino A - Peito e Triceps","letter":"A","createdAt":"2026-07-15T19:59:44.480Z","updatedAt":"2026-07-15T19:59:44.480Z","exercises":[{"id":"35f9d09c-e7f1-411e-bc2e-286ef558c3a5","workoutId":"8aba8e25-a301-4441-a0b7-24c7e167f26b","exerciseId":"07675656-b609-4c8c-8138-6a6e4e17f4c8","sets":4,"repsRange":"8-12","restSeconds":60,"order":1,"createdAt":"2026-07-15T20:00:00.192Z","updatedAt":"2026-07-15T20:00:00.192Z","exercise":{"id":"07675656-b609-4c8c-8138-6a6e4e17f4c8","name":"Abdominal Supra no Solo","muscleGroup":"Abdômen","equipment":"Peso Corporal","mediaUrl":"https://www.youtube.com/watch?v=jDwoBqPH0jk","description":"...","createdAt":"2026-07-15T19:52:30.760Z","updatedAt":"2026-07-15T19:52:30.760Z"}}, ... (mais 2 exercícios com dados completos incluídos)]}}
  ```
  ```
  > npm test

  PASS src/fitness/__tests__/workouts.test.ts (6.076 s)
  PASS src/fitness/__tests__/relations.test.ts
  PASS src/auth/__tests__/auth.test.ts

  Test Suites: 3 passed, 3 total
  Tests:       18 passed, 18 total
  Snapshots:   0 total
  Time:        12.989 s, estimated 15 s
  Ran all test suites.
  ```
- **Pendências conhecidas:** nenhuma conhecida.

## 2026-07-15 - Executado por Claude Code (Sonnet 5)
- **O que foi feito:** Implementada a execução do treino pelo aluno e o registro de carga (Fase 4), em 4 blocos sequenciais validados individualmente. Bloco 1: adicionado o model `SetLog` ao schema (relação com `WorkoutExercise`) e migration aplicada. Bloco 2: criados os endpoints `POST` e `GET /api/workouts/:workoutId/exercises/:workoutExerciseId/logs`, com validação de que o usuário autenticado é o `alunoId` dono do treino (403 caso contrário) e de que o `workoutExerciseId` pertence ao `workoutId` da URL (400 caso contrário). Bloco 3: estendido `GET /api/workouts/:id` (já existente da Fase 3) para incluir `setLogs` aninhados em cada `WorkoutExercise`, e corrigida uma lacuna de autorização da Fase 3 — o endpoint antes só verificava `personalId`, agora verifica se o usuário autenticado é o `alunoId` OU o `personalId` do treino, retornando 403 para qualquer outro usuário. Bloco 4: escritos testes automatizados cobrindo os 6 cenários pedidos. Nenhuma dependência nova adicionada; `package.json` não foi tocado.
- **Arquivos Criados/Modificados:** prisma/schema.prisma (model SetLog + relação inversa em WorkoutExercise), prisma/migrations/20260715200850_add_set_log/migration.sql (novo), src/fitness/repository/setlogs.repository.ts (novo), src/fitness/services/setlogs.service.ts (novo), src/fitness/controllers/setlogs.controller.ts (novo), src/fitness/routes/setlogs.routes.ts (novo), src/fitness/repository/workouts.repository.ts (findByIdWithExercises agora inclui setLogs), src/fitness/services/workouts.service.ts (getWorkout agora valida alunoId OU personalId, 403 caso contrário), src/fitness/controllers/workouts.controller.ts (variável renomeada para userId, mesmo comportamento de repasse), src/fitness/__tests__/setlogs.test.ts (novo), src/app.ts (registro da rota setlogsRoutes)
- **Evidência / Status dos Testes:**
  ```
  BLOCO 1 — > npx prisma migrate dev --name add_set_log

  Applying migration `20260715200850_add_set_log`

  The following migration(s) have been created and applied from new schema changes:

  migrations/
    └─ 20260715200850_add_set_log/
      └─ migration.sql

  Your database is now in sync with your schema.

  Running generate... (Use --skip-generate to skip the generators)
  Running generate... - Prisma Client
  ✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in 300ms
  ```
  ```
  BLOCO 2 — validação manual via curl (aluno dono, aluno não-dono, workoutExerciseId de outro treino)

  1. POST log (aluno dono) - serie 1: HTTP_STATUS:201
  {"setLog":{"id":"cf259658-e0b2-408f-9e74-e8d5ab33988f","workoutExerciseId":"dbe939bb-d9db-47fa-9157-7374dbaf3a01","setNumber":1,"repsDone":10,"weightKg":60,"loggedAt":"2026-07-15T20:15:45.163Z"}}

  2. POST log serie 2: HTTP_STATUS:201
  {"setLog":{"id":"48f6f674-0a09-4451-95d6-c6119aa01e82","workoutExerciseId":"dbe939bb-d9db-47fa-9157-7374dbaf3a01","setNumber":2,"repsDone":9,"weightKg":60,"loggedAt":"2026-07-15T20:15:45.595Z"}}

  3. POST log serie 3: HTTP_STATUS:201
  {"setLog":{"id":"b690f3a0-2e2d-4715-9d63-fd5b93a1860e","workoutExerciseId":"dbe939bb-d9db-47fa-9157-7374dbaf3a01","setNumber":3,"repsDone":8,"weightKg":65,"loggedAt":"2026-07-15T20:15:46.124Z"}}

  4. POST log com token de OUTRO aluno: HTTP_STATUS:403
  {"error":"Você não tem permissão para acessar este treino."}

  5. POST log com workoutExerciseId de outro treino na URL: HTTP_STATUS:400
  {"error":"Exercício não pertence ao treino informado."}

  6. GET logs (aluno dono): HTTP_STATUS:200
  {"setLogs":[{"id":"cf259658-e0b2-408f-9e74-e8d5ab33988f","workoutExerciseId":"dbe939bb-d9db-47fa-9157-7374dbaf3a01","setNumber":1,"repsDone":10,"weightKg":60,"loggedAt":"2026-07-15T20:15:45.163Z"},{"id":"48f6f674-0a09-4451-95d6-c6119aa01e82","workoutExerciseId":"dbe939bb-d9db-47fa-9157-7374dbaf3a01","setNumber":2,"repsDone":9,"weightKg":60,"loggedAt":"2026-07-15T20:15:45.595Z"},{"id":"b690f3a0-2e2d-4715-9d63-fd5b93a1860e","workoutExerciseId":"dbe939bb-d9db-47fa-9157-7374dbaf3a01","setNumber":3,"repsDone":8,"weightKg":65,"loggedAt":"2026-07-15T20:15:46.124Z"}]}
  ```
  ```
  BLOCO 3 — validação manual de GET /api/workouts/:id estendido

  1. GET /api/workouts/:id como aluno dono: HTTP_STATUS:200
  {"workout":{"id":"f85916b8-5bac-4415-9f6e-8525dcdf69e9","personalId":"2d09cbe8-9e07-44ac-bb0d-ed3924fddaef","alunoId":"0044be45-4d18-42c4-a64a-8652d6f3f912","name":"Treino A - Fase 4","letter":"A","createdAt":"2026-07-15T20:12:47.796Z","updatedAt":"2026-07-15T20:12:47.796Z","exercises":[{"id":"dbe939bb-d9db-47fa-9157-7374dbaf3a01","workoutId":"f85916b8-5bac-4415-9f6e-8525dcdf69e9","exerciseId":"07675656-b609-4c8c-8138-6a6e4e17f4c8","sets":4,"repsRange":"8-12","restSeconds":60,"order":1,"createdAt":"2026-07-15T20:12:49.491Z","updatedAt":"2026-07-15T20:12:49.491Z","exercise":{"id":"07675656-b609-4c8c-8138-6a6e4e17f4c8","name":"Abdominal Supra no Solo","muscleGroup":"Abdômen","equipment":"Peso Corporal","mediaUrl":"https://www.youtube.com/watch?v=jDwoBqPH0jk","description":"...","createdAt":"2026-07-15T19:52:30.760Z","updatedAt":"2026-07-15T19:52:30.760Z"},"setLogs":[{"id":"cf259658-e0b2-408f-9e74-e8d5ab33988f","workoutExerciseId":"dbe939bb-d9db-47fa-9157-7374dbaf3a01","setNumber":1,"repsDone":10,"weightKg":60,"loggedAt":"2026-07-15T20:15:45.163Z"},{"id":"48f6f674-0a09-4451-95d6-c6119aa01e82","workoutExerciseId":"dbe939bb-d9db-47fa-9157-7374dbaf3a01","setNumber":2,"repsDone":9,"weightKg":60,"loggedAt":"2026-07-15T20:15:45.595Z"},{"id":"b690f3a0-2e2d-4715-9d63-fd5b93a1860e","workoutExerciseId":"dbe939bb-d9db-47fa-9157-7374dbaf3a01","setNumber":3,"repsDone":8,"weightKg":65,"loggedAt":"2026-07-15T20:15:46.124Z"}]}]}}

  2. GET /api/workouts/:id como usuário NÃO autorizado: HTTP_STATUS:403
  {"error":"Você não tem permissão para acessar este treino."}
  ```
  ```
  BLOCO 4 — > npm test

  PASS src/fitness/__tests__/setlogs.test.ts (9.08 s)
  PASS src/fitness/__tests__/workouts.test.ts
  PASS src/fitness/__tests__/relations.test.ts
  PASS src/auth/__tests__/auth.test.ts

  Test Suites: 4 passed, 4 total
  Tests:       25 passed, 25 total
  Snapshots:   0 total
  Time:        20.218 s
  Ran all test suites.
  ```
- **Pendências conhecidas:** nenhuma conhecida.

## 2026-07-15 - Executado por Claude Code (Sonnet 5)
- **O que foi feito:** Mini-tarefa pontual (extensão do módulo `fitness`, descoberta como bloqueio ao iniciar a Fase 5): adicionado `GET /api/workouts`, protegido por `authenticate`, que lista os treinos do usuário autenticado — se `role === ALUNO`, retorna os `Workout` onde `alunoId === request.user.sub`; se `role === PERSONAL`, retorna os `Workout` onde `personalId === request.user.sub`. Nenhum parâmetro de identidade é aceito do cliente (vem do token). Não foi necessária migration (apenas uma nova query sobre tabela já existente).
- **Arquivos Criados/Modificados:** src/fitness/repository/workouts.repository.ts (novos métodos `findAllByAluno`, `findAllByPersonal`), src/fitness/services/workouts.service.ts (novo método `listWorkoutsForUser`), src/fitness/controllers/workouts.controller.ts (novo `listWorkoutsHandler`), src/fitness/routes/workouts.routes.ts (registrado `GET /api/workouts`), src/fitness/__tests__/workouts.test.ts (2 novos testes cobrindo aluno e personal)
- **Evidência / Status dos Testes:**
  ```
  GET /api/workouts como ALUNO: HTTP_STATUS:200
  {"workouts":[{"id":"799c1729-4c07-47be-b8a9-19156c9ad5ac","personalId":"5161c1b4-697d-44c4-8e30-4d667f366c07","alunoId":"49c36de6-2cb9-47cf-a79c-354dde760600","name":"Treino A - GetWorkouts","letter":"A","createdAt":"2026-07-15T20:33:41.679Z","updatedAt":"2026-07-15T20:33:41.679Z"},{"id":"2a281163-386a-446c-911d-106e18d752f0","personalId":"5161c1b4-697d-44c4-8e30-4d667f366c07","alunoId":"49c36de6-2cb9-47cf-a79c-354dde760600","name":"Treino B - GetWorkouts","letter":"B","createdAt":"2026-07-15T20:33:42.120Z","updatedAt":"2026-07-15T20:33:42.120Z"}]}

  GET /api/workouts como PERSONAL: HTTP_STATUS:200
  {"workouts":[{"id":"799c1729-4c07-47be-b8a9-19156c9ad5ac","personalId":"5161c1b4-697d-44c4-8e30-4d667f366c07","alunoId":"49c36de6-2cb9-47cf-a79c-354dde760600","name":"Treino A - GetWorkouts","letter":"A","createdAt":"2026-07-15T20:33:41.679Z","updatedAt":"2026-07-15T20:33:41.679Z"},{"id":"2a281163-386a-446c-911d-106e18d752f0","personalId":"5161c1b4-697d-44c4-8e30-4d667f366c07","alunoId":"49c36de6-2cb9-47cf-a79c-354dde760600","name":"Treino B - GetWorkouts","letter":"B","createdAt":"2026-07-15T20:33:42.120Z","updatedAt":"2026-07-15T20:33:42.120Z"}]}
  ```
  ```
  > npm test

  PASS src/fitness/__tests__/setlogs.test.ts (7.177 s)
  PASS src/fitness/__tests__/relations.test.ts
  PASS src/auth/__tests__/auth.test.ts
  PASS src/fitness/__tests__/workouts.test.ts

  Test Suites: 4 passed, 4 total
  Tests:       27 passed, 27 total
  Snapshots:   0 total
  Time:        18.42 s, estimated 20 s
  Ran all test suites.
  ```
- **Pendências conhecidas:** nenhuma conhecida. Esta era uma pré-condição bloqueante para a Fase 5 (Dashboard e Lista de Treinos do aluno precisavam de um jeito de descobrir os próprios treinos sem receber o UUID por fora). Resolvida antes de retomar o frontend.

## 2026-07-15 - Executado por Claude Code (Sonnet 5)
- **O que foi feito:** Implementado o frontend web mobile-first (Fase 5) — projeto Next.js (App Router) separado em `/frontend`, consumindo a API do backend. Sistema de design próprio "Voltagem" apresentado e aprovado antes da implementação (paleta storm/relâmpago dourado + ciano, tipografia Unbounded/Manrope/IBM Plex Mono, elemento de assinatura "Barra de Voltagem" segmentada). Stack: Next.js + TypeScript + Tailwind v4 + componentes estilo shadcn/ui (Button, Input, Label, Card, hand-rolled sobre Radix) + Zustand (sessão) + TanStack Query (dados). Telas: `/login`, `/register`, `/dashboard` (próximo treino = primeiro treino do aluno, simplificação documentada pois o backend não tem conceito de "próximo"), `/treinos` (lista) e `/treinos/[id]` (execução: mídia do YouTube embutida, descrição, histórico de séries, formulário de registro de carga). Durante a implementação, dois bloqueios reais foram descobertos e corrigidos: (1) backend não tinha endpoint para o aluno listar os próprios treinos — resolvido em mini-tarefa separada (`GET /api/workouts`, ver entrada anterior); (2) o navegador bloqueava as chamadas cross-origin (frontend em :3001, backend em :3000) por CORS, já que o backend (fora do escopo desta fase) não emite cabeçalhos CORS — resolvido inteiramente dentro de `/frontend` com rewrite do Next.js (`next.config.ts`) que repassa `/api/*` para `NEXT_PUBLIC_API_URL` do lado do servidor, então o navegador só fala com a própria origem. Token storage isolado em `lib/auth/token-store.ts` (sessionStorage, documentado como simplificação em vez de cookie httpOnly, que exigiria mudar `/src/auth`); `lib/api/client.ts` implementa refresh automático em 401, incluindo a rotação de refresh token que o backend já fazia desde a Fase 1 (persiste o par novo, não só o access token). Integração real validada de ponta a ponta com um navegador Chrome real via Puppeteer (não apenas revisão de código) contra os dois servidores rodando localmente — evidência colada abaixo, incluindo confirmação de que o registro de série feito pela UI persiste de fato no backend (verificado por uma chamada backend separada, com token do Personal, após o fluxo pela UI). `package.json` da raiz do backend não foi tocado; nenhuma dependência foi adicionada fora de `/frontend`.
- **Arquivos Criados/Modificados:**
  - Backend (mini-tarefa pré-Fase 5, já registrada na entrada anterior): `src/fitness/repository/workouts.repository.ts`, `src/fitness/services/workouts.service.ts`, `src/fitness/controllers/workouts.controller.ts`, `src/fitness/routes/workouts.routes.ts`, `src/fitness/__tests__/workouts.test.ts`
  - Frontend (novo projeto): `frontend/package.json`, `frontend/next.config.ts` (rewrite `/api/*`), `frontend/app/globals.css` (tokens do design system + Barra de Voltagem), `frontend/app/layout.tsx` (fontes Unbounded/Manrope/IBM Plex Mono), `frontend/app/providers.tsx`, `frontend/app/page.tsx`, `frontend/app/login/page.tsx`, `frontend/app/register/page.tsx`, `frontend/app/dashboard/page.tsx`, `frontend/app/treinos/page.tsx`, `frontend/app/treinos/[id]/page.tsx`, `frontend/components/ui/{button,input,label,card}.tsx`, `frontend/components/voltage-bar.tsx`, `frontend/components/auth-guard.tsx`, `frontend/components/app-header.tsx`, `frontend/components/exercise-execution-card.tsx`, `frontend/lib/utils.ts`, `frontend/lib/types.ts`, `frontend/lib/youtube.ts`, `frontend/lib/auth/token-store.ts`, `frontend/lib/store/auth-store.ts`, `frontend/lib/api/{client,auth,workouts}.ts`, `frontend/.env.local`
- **Evidência / Status dos Testes:**
  ```
  BLOCO 1 — > npm run build (dentro de /frontend, após todas as telas prontas)

  ▲ Next.js 16.2.10 (Turbopack)
  - Environments: .env.local

    Creating an optimized production build ...
  ✓ Compiled successfully in 5.4s
    Running TypeScript ...
    Finished TypeScript in 4.8s ...
    Collecting page data using 10 workers ...
    Generating static pages using 10 workers (8/8) in 903ms
    Finalizing page optimization ...

  Route (app)
  ┌ ○ /
  ├ ○ /_not-found
  ├ ○ /dashboard
  ├ ○ /login
  ├ ○ /register
  ├ ○ /treinos
  └ ƒ /treinos/[id]
  ```
  ```
  BLOCO 1 — E2E real via Puppeteer + Chrome instalado localmente, contra backend (:3000) e frontend (:3001) rodando de verdade:

  === 1. Abrindo /register ===
  URL após registro+login: http://localhost:3001/dashboard

  === Chamadas de API observadas até aqui ===
  POST http://localhost:3001/api/auth/register -> 201
  POST http://localhost:3001/api/auth/login -> 200
  GET http://localhost:3001/api/workouts -> 200

  === Dashboard contém saudação? === true
  ```
  ```
  BLOCO 2 e 3 — E2E real cobrindo Dashboard, Lista de Treinos e Execução (registro de série pela UI):

  === Preparando dados via backend direto (Personal, vínculo, treino) ===
  Workout preparado: a90a0cfa-9575-4854-89db-772029ba86ea

  === 1. Login do aluno via UI ===
  Dashboard mostra 'Próximo treino'? true
  Dashboard mostra nome do treino? true

  === 2. Navegando para /treinos ===
  Lista de treinos mostra 'Treino E2E'? true

  === 3. Abrindo execução do treino e registrando 1 série ===
  Tela mostra '1/3 séries' após registrar? true
  Tela mostra '10 reps × 42.5kg'? true

  === 4. Confirmando persistência real via backend (não é só estado local) ===
  setLogs persistidos no backend: [{"id":"e314be9f-6af3-4690-91ee-6e33d89fb4c5","workoutExerciseId":"eac8ff63-000b-4d95-8be5-ee25849db3d6","setNumber":1,"repsDone":10,"weightKg":42.5,"loggedAt":"2026-07-15T20:57:04.130Z"}]

  === Chamadas de API observadas na sessão do navegador ===
  POST http://localhost:3001/api/auth/login -> 200
  GET http://localhost:3001/api/workouts -> 200
  GET http://localhost:3001/api/workouts/a90a0cfa-9575-4854-89db-772029ba86ea -> 200
  GET http://localhost:3001/api/workouts -> 200
  GET http://localhost:3001/api/workouts/a90a0cfa-9575-4854-89db-772029ba86ea -> 200
  POST http://localhost:3001/api/workouts/a90a0cfa-9575-4854-89db-772029ba86ea/exercises/eac8ff63-000b-4d95-8be5-ee25849db3d6/logs -> 201
  GET http://localhost:3001/api/workouts/a90a0cfa-9575-4854-89db-772029ba86ea -> 200

  TODAS AS VERIFICAÇÕES PASSARAM.
  ```
  ```
  Regressão do backend após toda a Fase 5 (garantir que nada quebrou) — > npm test

  PASS src/fitness/__tests__/setlogs.test.ts (7.501 s)
  PASS src/fitness/__tests__/workouts.test.ts
  PASS src/fitness/__tests__/relations.test.ts
  PASS src/auth/__tests__/auth.test.ts

  Test Suites: 4 passed, 4 total
  Tests:       27 passed, 27 total
  Snapshots:   0 total
  Time:        18.178 s
  Ran all test suites.
  ```
- **Pendências conhecidas:** (1) Nenhuma tela para o Personal Trainer foi implementada nesta fase, por escopo — ele continua operando via curl/Postman, conforme instruído. (2) Token storage usa `sessionStorage` em vez de cookie httpOnly (documentado em `lib/auth/token-store.ts`); troca futura exigiria alterar `/src/auth` no backend. (3) Não há testes automatizados de frontend (Jest/RTL/Playwright) nesta entrega — a validação de integração real foi feita via script Puppeteer ad-hoc (não commitado, foi removido de `/frontend` após uso) contra os dois servidores rodando de verdade, não via suíte de testes permanente.

## 2026-07-15 - Executado por Claude Code (Sonnet 5)
- **O que foi feito:** Fase 5.5 (Hardening Pré-Produção), em 3 blocos, mais os dois pedidos extras do usuário (script de subida rápida + usuário de teste com credenciais). Bloco 1: tokens migrados de `sessionStorage` para cookies httpOnly (`access_token`, `refresh_token`) setados pelo backend em `/api/auth/login` e `/api/auth/refresh` (`HttpOnly; SameSite=Lax`, `secure` em produção); o middleware `authenticate` agora aceita o token via cookie OU header `Authorization: Bearer` (compatibilidade com curl/Postman mantida); adicionado `POST /api/auth/logout` que invalida o refresh token no banco e limpa os cookies; frontend reescrito para não ler/escrever token em lugar nenhum (só guarda o objeto `user`, não sensível, em sessionStorage) e para reagir a uma sessão expirada via callback `onAuthExpired`. Bloco 2: `.env.example` (backend e novo `frontend/.env.example`) revisado — `POSTGRES_PASSWORD` deixou de usar valor fraco direto, ambos os segredos JWT já usavam placeholder `CHANGE_ME_*`; adicionado `ALLOWED_ORIGIN` configurável; `@fastify/cors` registrado no backend com `credentials: true` como caminho de produção real (frontend/backend em domínios diferentes), mantendo o rewrite do Next.js como solução de dev; auditoria confirmou que não há URL de API hardcoded no frontend. Bloco 3: criados `dev.sh` (bash) e `dev.ps1` (PowerShell nativo, já que o ambiente é Windows sem WSL) — sobem Postgres, aguardam saudável, rodam `prisma migrate deploy`, populam o catálogo, sobem backend e frontend, aguardam ambos responderem, e têm modo `down` que derruba tudo. Extra: os dois scripts também garantem um usuário de teste (`personal@thunderafit.test` + `aluno@thunderafit.test`, já vinculados) e gravam as credenciais em `TEST_CREDENTIALS.txt` (adicionado ao `.gitignore`).
  Três bugs reais foram descobertos e corrigidos durante a validação (não hipotéticos — só apareceram ao rodar de verdade): (a) `@fastify/cookie`/`@fastify/cors` mais recentes exigem Fastify v5, mas o projeto usa v4 — instaladas as versões majors anteriores compatíveis (`@fastify/cookie@9.4.0`, `@fastify/cors@9.0.1`) em vez de forçar um upgrade de Fastify fora de escopo; (b) `npm run dev &` no Windows guarda o PID do processo errado (o wrapper do npm, não o node/next real que escuta a porta) — tanto `dev.sh` quanto `dev.ps1` agora descobrem o PID real pela porta via `netstat` e derrubam a árvore inteira com `taskkill /T`, já que o `down` original não estava parando nada de verdade; (c) `Invoke-WebRequest` contra `"localhost"` no `dev.ps1` trava no timeout inteiro tentando IPv6 antes de cair para IPv4, mesmo com o servidor já respondendo — trocado para `127.0.0.1` nas checagens internas do script.
- **Arquivos Criados/Modificados:** src/app.ts (registro de `@fastify/cors` e `@fastify/cookie`), src/auth/middlewares/authenticate.ts (aceita cookie), src/auth/controllers/auth.controller.ts (`setAuthCookies`/`clearAuthCookies`, `logoutHandler`, refresh aceita cookie), src/auth/routes/auth.routes.ts (`POST /api/auth/logout`), src/auth/services/auth.service.ts (`logout`), src/auth/__tests__/auth.test.ts (testes de cookie e logout), package.json (deps `@fastify/cookie`, `@fastify/cors`), .env.example (placeholders revisados, `ALLOWED_ORIGIN`), frontend/.env.example (novo), frontend/next.config.ts (sem mudança nesta fase, rewrite já existia), frontend/lib/api/client.ts (fetch sem Authorization, refresh via cookie, `onAuthExpired`), frontend/lib/store/auth-store.ts (sem tokens, só `user`), frontend/lib/api/auth.ts (`logoutRequest`), frontend/components/auth-guard.tsx (assina `onAuthExpired`), frontend/components/app-header.tsx (logout chama a API), frontend/lib/auth/token-store.ts (removido, não usado mais), dev.sh (novo), dev.ps1 (novo), .gitignore (`TEST_CREDENTIALS.txt` e artefatos do dev script)
- **Evidência / Status dos Testes:**
  ```
  BLOCO 1 — > npm test (backend, com os novos testes de cookie/logout)

  PASS src/fitness/__tests__/workouts.test.ts
  PASS src/fitness/__tests__/setlogs.test.ts
  PASS src/fitness/__tests__/relations.test.ts
  PASS src/auth/__tests__/auth.test.ts

  Test Suites: 4 passed, 4 total
  Tests:       31 passed, 31 total
  Snapshots:   0 total
  Time:        9.78 s
  Ran all test suites.
  ```
  ```
  BLOCO 1 — curl -i login (Set-Cookie real, HttpOnly confirmado):

  HTTP/1.1 200 OK
  set-cookie: access_token=eyJhbGci...; Max-Age=900; Path=/; HttpOnly; SameSite=Lax
  set-cookie: refresh_token=eyJhbGci...; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
  ```
  ```
  BLOCO 1 — E2E real via Puppeteer + Chrome, cookies inspecionados via CDP (Page.cookies) e via document.cookie:

  === Cookies visíveis via CDP (Page.cookies) ===
  refresh_token: httpOnly=true sameSite=Lax secure=false
  access_token: httpOnly=true sameSite=Lax secure=false

  === Storage do navegador (deve NÃO ter token) ===
  { "sessionStorageKeys": ["thunderafit_user"], "localStorageKeys": [], "sessionStorageHasToken": false, "localStorageHasToken": false }

  === document.cookie (JS não deve enxergar os httpOnly) ===
  ""

  TODAS AS VERIFICAÇÕES DE COOKIE PASSARAM.
  ```
  ```
  BLOCO 1 — fluxo completo (login → dashboard → treinos → registrar série) usando só cookie httpOnly, sem nenhum header Authorization:

  Dashboard mostra treino via cookie auth? true
  Serie registrada via cookie auth (1/3)? true

  Chamadas de API:
  POST http://localhost:3001/api/auth/login -> 200
  GET http://localhost:3001/api/workouts -> 200
  GET http://localhost:3001/api/workouts/1479b638-.../ -> 200
  POST http://localhost:3001/api/workouts/.../exercises/.../logs -> 201
  GET http://localhost:3001/api/workouts/1479b638-.../ -> 200

  TODAS AS VERIFICACOES PASSARAM (fluxo completo com cookie httpOnly).
  ```
  ```
  BLOCO 2 — CORS real (headers na resposta de registro):

  HTTP/1.1 201 Created
  access-control-allow-origin: http://localhost:3001
  access-control-allow-credentials: true
  ```
  ```
  BLOCO 3 — > ./dev.sh (execução real, do zero, log completo resumido — saída de prisma:query omitida)

  ==> Subindo PostgreSQL (docker-compose up -d)...
   Container thunderafit_postgres Created
   Container thunderafit_postgres Started
  ==> Aguardando Postgres ficar saudável...
  Postgres saudável.
  ==> Rodando migrations...
  No pending migrations to apply.
  ==> Populando catálogo de exercícios (idempotente)...
  Seeding 29 exercises...
  Seeding complete.
  ==> Subindo backend (porta 3000)...
  Backend respondendo.
  ==> Subindo frontend (porta 3001)...
  Frontend respondendo.
  ==> Garantindo usuário de teste (Personal + Aluno já vinculados)...
  Credenciais de teste salvas em /c/Users/eliel.garcia/Documents/github/thunderafit/TEST_CREDENTIALS.txt (arquivo no .gitignore).

  ThunderaFit rodando:
    Backend:  http://localhost:3000
    Frontend: http://localhost:3001

  Para derrubar tudo: ./dev.sh down
  ```
  ```
  BLOCO 3 — > ./dev.sh down (real, com verificação pós-comando)

  ==> Parando backend e frontend...
  ÊXITO: o processo com PID 31888 (processo filho de PID 34920) foi finalizado.
  Backend: processo(s) na porta 3000 derrubado(s).
  ÊXITO: o processo com PID 47932 (processo filho de PID 38488) foi finalizado.
  Frontend: processo(s) na porta 3001 derrubado(s).
  ==> Derrubando containers Docker...
   Container thunderafit_postgres Removed
  Tudo parado.

  $ docker ps -a --filter "name=thunderafit"   -> vazio
  $ netstat -ano | grep -E ":3000 |:3001 "     -> nenhuma porta em LISTENING
  $ curl http://localhost:3000/health          -> exit 7 (connection refused, esperado)
  $ curl http://localhost:3001/login           -> exit 7 (connection refused, esperado)
  ```
  ```
  BLOCO 3 — > .\dev.ps1 (execução real após corrigir o bug do Invoke-WebRequest/localhost, log completo resumido)

  ==> Subindo PostgreSQL (docker-compose up -d)...
  Postgres saudavel.
  ==> Rodando migrations...
  No pending migrations to apply.
  ==> Populando catalogo de exercicios (idempotente)...
  Seeding complete.
  ==> Subindo backend (porta 3000)...
  Backend respondendo.
  ==> Subindo frontend (porta 3001)...
  Frontend respondendo.
  ==> Garantindo usuario de teste (Personal + Aluno ja vinculados)...
  Credenciais de teste salvas em C:\Users\eliel.garcia\Documents\github\thunderafit\TEST_CREDENTIALS.txt (arquivo no .gitignore).

  ThunderaFit rodando:
    Backend:  http://localhost:3000
    Frontend: http://localhost:3001

  Para derrubar tudo: .\dev.ps1 down
  SCRIPT_EXIT_CODE=0
  ```
  ```
  BLOCO 3 — > .\dev.ps1 down (real, após corrigir o bug do Stop-Dev que só matava o PID do wrapper)

  ==> Parando backend e frontend...
  Backend: processo(s) na porta 3000 derrubado(s).
  Frontend: processo(s) na porta 3001 derrubado(s).
  ==> Derrubando containers Docker...
   Container thunderafit_postgres Removed
  Tudo parado.
  SCRIPT_EXIT_CODE=0

  $ docker ps -a --filter "name=thunderafit"   -> vazio
  $ netstat -ano | grep -E ":3000 |:3001 "     -> nenhuma porta em LISTENING (esperado)
  $ curl http://localhost:3000/health          -> exit 7 (connection refused, esperado)
  $ curl http://localhost:3001/login           -> exit 7 (connection refused, esperado)
  ```
  ```
  Regressão final do backend (após religar Postgres que o teste do dev.ps1 down tinha derrubado) — > npm test

  PASS src/auth/__tests__/auth.test.ts (9.928 s)
  PASS src/fitness/__tests__/workouts.test.ts
  PASS src/fitness/__tests__/relations.test.ts
  PASS src/fitness/__tests__/setlogs.test.ts

  Test Suites: 4 passed, 4 total
  Tests:       31 passed, 31 total
  Snapshots:   0 total
  Time:        22.117 s, estimated 43 s
  Ran all test suites.
  ```
- **Pendências conhecidas:** (1) Ainda não há testes automatizados de frontend (Jest/RTL/Playwright) permanentes — a validação de integração desta fase também usou scripts Puppeteer ad-hoc, removidos após uso. (2) `dev.sh`/`dev.ps1` assumem que as portas 3000/3001 estão livres e que Docker Desktop já está rodando — não fazem esse pré-check. (3) O anexo "dev.sh" mencionado no prompt original não chegou de fato nesta conversa (nenhum arquivo foi de fato anexado) — os dois scripts foram escritos do zero a partir da estrutura real do projeto, conforme a própria instrução previa para esse caso.

## 2026-07-15 - Executado por Claude Code (Sonnet 5)
- **O que foi feito:** Painel do Personal Trainer (Fase 6), reaproveitando o sistema de design "Voltagem" da Fase 5 sem criar nada novo de paleta/tipografia — mesmos componentes `Card`, `Button`, `Input`, `Label`, `VoltageBar`, `AppHeader`. Antes de implementar, foi identificada e resolvida uma lacuna real de contrato: `POST /api/relations` exige `alunoId` (UUID), e não existia nenhum endpoint para o Personal descobrir esse ID a partir do e-mail do aluno — o único dado que ele realmente tem. Parei e perguntei antes de agir; a opção escolhida foi adicionar `GET /api/users/lookup?email=...` (protegido, retorna `{id, email, role}` de um `ALUNO` existente ou 404), sem alterar o contrato de `POST /api/relations`. Bloco 1: redirecionamento pós-login/registro agora é por `role` (`ALUNO` → `/dashboard`, `PERSONAL` → `/personal/dashboard`); `AuthGuard` ganhou um parâmetro `allowedRoles` que redireciona para o dashboard correto em vez de deixar um usuário na área errada; `/personal/dashboard` lista os alunos vinculados (`GET /api/relations`) com `VoltageBar` mostrando `X/limiteAlunos` e um aviso visual de "limite atingido" (sem upgrade real, só o estado visual, conforme roadmap pós-MVP), além da lista de treinos já prescritos. Bloco 2: `/personal/alunos/novo` faz o lookup por e-mail e depois `POST /api/relations`, tratando os 3 erros (`404`, `409`, `403`) com mensagens específicas e amigáveis, não um erro genérico. Bloco 3: `/personal/treinos/novo` cria o treino (aluno vinculado + nome + letra A/B/C/D) e redireciona para `/personal/treinos/[id]`, que mostra os exercícios já prescritos em ordem e tem um formulário para adicionar mais (filtro por nome/grupo muscular sobre os ~29 exercícios do catálogo + dropdown, conforme sugerido no prompt). Bloco 4: como o backend foi tocado (endpoint novo, não mudança de contrato existente), a suíte completa rodou e subiu de 31 para 34 testes, todos passando.
- **Arquivos Criados/Modificados:**
  - Backend (mini-tarefa aprovada antes de agir): `src/fitness/services/users.service.ts` (novo), `src/fitness/controllers/users.controller.ts` (novo), `src/fitness/routes/users.routes.ts` (novo), `src/app.ts` (registro de `usersRoutes`), `src/fitness/__tests__/relations.test.ts` (3 novos testes para `GET /api/users/lookup`)
  - Frontend: `frontend/lib/auth/redirect.ts` (novo, `dashboardPathForRole`), `frontend/lib/api/relations.ts` (novo, `listRelations`/`createRelation`/`lookupAlunoByEmail`), `frontend/lib/api/workouts.ts` (`createWorkout`, `addWorkoutExercise`), `frontend/components/auth-guard.tsx` (parâmetro `allowedRoles`), `frontend/components/app-header.tsx` (logo aponta pro dashboard certo por role), `frontend/components/add-exercise-form.tsx` (novo), `frontend/app/login/page.tsx` e `frontend/app/register/page.tsx` (redirect por role), `frontend/app/page.tsx` (idem), `frontend/app/dashboard/page.tsx`, `frontend/app/treinos/page.tsx`, `frontend/app/treinos/[id]/page.tsx` (restritos a `allowedRoles={["ALUNO"]}`), `frontend/app/personal/dashboard/page.tsx` (novo), `frontend/app/personal/alunos/novo/page.tsx` (novo), `frontend/app/personal/treinos/novo/page.tsx` (novo), `frontend/app/personal/treinos/[id]/page.tsx` (novo)
- **Evidência / Status dos Testes:**
  ```
  BLOCO 4 — > npm test (backend, com os 3 novos testes de GET /api/users/lookup)

  PASS src/auth/__tests__/auth.test.ts (5.234 s)
  PASS src/fitness/__tests__/setlogs.test.ts
  PASS src/fitness/__tests__/relations.test.ts
  PASS src/fitness/__tests__/workouts.test.ts

  Test Suites: 4 passed, 4 total
  Tests:       34 passed, 34 total
  Snapshots:   0 total
  Time:        11.152 s
  Ran all test suites.
  ```
  ```
  BLOCO 1 — E2E real via Puppeteer + Chrome, backend e frontend rodando de verdade:

  === BLOCO 1: Login como Personal e checar redirecionamento por role ===
  URL após login do Personal: http://localhost:3001/personal/dashboard
  Dashboard mostra '0/3'? true
  Dashboard mostra 'Nenhum aluno vinculado'? true
  ```
  ```
  BLOCO 2 — os 3 cenários de erro + 1 de sucesso, todos reais:

  === Vincular aluno — sucesso ===
  Dashboard mostra '1/3' após vincular? true
  Dashboard mostra o e-mail do aluno vinculado? true

  === Vincular aluno — 404 (email inexistente) ===
  Mensagem 404 apareceu? true
  URL permaneceu em /personal/alunos/novo (não navegou)? true

  === Vincular aluno — 409 (já vinculado) ===
  Mensagem 409 apareceu? true

  === Vincular aluno — 403 (limite atingido) ===
  Mensagem 403 apareceu? true
  ```
  ```
  BLOCO 3 — fluxo completo de criação de treino + persistência + fechamento do ciclo com o aluno:

  === Criar treino do zero pela UI ===
  Treino criado, ID: f1be0a8d-602e-4af8-b621-89c2a9e9fb55

  === Adicionar 3 exercícios pela UI ===
  Tela mostra '3 exercício(s) prescrito(s)'? true

  === Confirmar persistência via GET direto no backend ===
  Ordens persistidas no backend: [1,2,3]

  === (bônus) Confirmar que o aluno dono vê o treino em /treinos ===
  Aluno vê 'Treino E2E Fase 6' em /treinos? true
  ```
  ```
  Chamadas de API observadas na sessão do navegador (amostra confirmando integração real, não mock):

  POST /api/auth/login -> 200
  GET /api/relations -> 200
  GET /api/users/lookup?email=... -> 200 (depois 404, depois 200, depois 200)
  POST /api/relations -> 201 (depois 409, depois 403)
  POST /api/workouts -> 201
  GET /api/workouts/:id -> 200
  GET /api/exercises -> 200
  POST /api/workouts/:id/exercises -> 201 (x3)
  ```
- **Pendências conhecidas:** (1) Edição e exclusão de treino já prescrito ficaram fora de escopo, por decisão explícita do prompt — só criação. (2) Sem paginação/busca na lista de alunos do dashboard do Personal (aceitável para o volume do MVP/Freemium, no máximo 3 alunos no plano free). (3) Herdadas da Fase 5/5.5: sem testes automatizados de frontend permanentes (validação via Puppeteer ad-hoc removido após uso); `dev.sh`/`dev.ps1` não fazem pré-check de porta/Docker.

## 2026-07-15 - Executado por Claude Code (Sonnet 5)
- **O que foi feito:** Suíte de testes automatizados permanente para o frontend (Fase 7), substituindo os scripts Puppeteer ad-hoc usados desde a Fase 5. Antes de instalar a ferramenta de E2E, parei e perguntei (conforme a nota de autonomia do prompt) — Playwright foi a opção escolhida, configurado para usar o Google Chrome já instalado na máquina (`channel: "chrome"` em `playwright.config.ts`) em vez de baixar o Chromium próprio do Playwright, evitando dependência de download de binário grande neste ambiente.
  1) **Unidade/componente** (Jest + React Testing Library, configurado via `next/jest`): `AuthGuard` (6 testes — estado de carregamento, redirect para `/login` sem sessão, autorização por `allowedRoles`, redirect cruzado Personal↔Aluno para a área errada, registro do callback `onAuthExpired`); a tela de vincular aluno (4 testes — sucesso e os 3 erros de negócio 404/409/403 com as mensagens específicas certas); e o formulário de registro de série em `ExerciseExecutionCard` (4 testes — contagem de séries, payload correto enviado, mensagem de erro da API, formulário escondido quando completo).
  2) **Integração de API client** (Jest, mockando `global.fetch`, sem backend real): `lib/api/client.ts` (5 testes — sucesso 200, erro de negócio 403 vira `ApiError` com status/mensagem corretos, 401 com refresh automático bem-sucedido e retry da chamada original, 401 com refresh que falha disparando `onAuthExpired` e propagando o erro, e confirmação de que `auth:false` nunca tenta refresh); `lib/api/relations.ts` (3 testes — URL/método/corpo corretos, incluindo o encoding do e-mail na query string do lookup).
  3) **E2E real** (Playwright, contra backend+banco de verdade, sem mocks): fluxo crítico completo login → dashboard → ver treino → registrar série → confirmar persistência real via uma chamada backend separada (mesmo padrão de verificação usado nas fases anteriores). O teste cria os próprios dados de setup via HTTP direto ao backend antes de exercitar a UI, não depende de `TEST_CREDENTIALS.txt`.
  Durante a validação, foi descoberto e corrigido um bug de contaminação cross-projeto: rodar `npm test` na raiz do backend também estava tentando compilar e rodar os novos arquivos de teste do frontend (`frontend/__tests__/**`), porque o `testMatch` do Jest da raiz não tinha escopo restrito e o TypeScript do frontend usa o alias `@/*` que não existe no `tsconfig` da raiz — 2 suítes falhavam. Corrigido adicionando `"roots": ["<rootDir>/src", "<rootDir>/prisma"]` ao Jest da raiz, isolando os dois projetos de teste completamente.
- **Arquivos Criados/Modificados:** `frontend/package.json` (scripts `test`, `test:watch`, `test:e2e`; devDependencies `jest`, `jest-environment-jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@types/jest`, `@playwright/test`), `frontend/jest.config.js` (novo), `frontend/jest.setup.ts` (novo), `frontend/playwright.config.ts` (novo), `frontend/__tests__/components/auth-guard.test.tsx` (novo), `frontend/__tests__/components/vincular-aluno.test.tsx` (novo), `frontend/__tests__/components/exercise-execution-card.test.tsx` (novo), `frontend/__tests__/lib/api/client.test.ts` (novo), `frontend/__tests__/lib/api/relations.test.ts` (novo), `frontend/e2e/critical-flow.spec.ts` (novo), `frontend/README.md` (reescrito — era ainda o boilerplate do create-next-app; agora documenta as 3 camadas de teste), `frontend/.gitignore` (artefatos do Playwright), `package.json` da raiz (`jest.roots` restrito a `src`/`prisma`, corrige a contaminação cross-projeto)
- **Evidência / Status dos Testes:**
  ```
  Unidade + Integração — > npm test (dentro de /frontend)

  Test Suites: 5 passed, 5 total
  Tests:       22 passed, 22 total
  Snapshots:   0 total
  Time:        3.183 s
  Ran all test suites.
  ```
  ```
  E2E real — > npm run test:e2e (dentro de /frontend, backend+Postgres+frontend rodando de verdade)

  Running 1 test using 1 worker

    ok 1 [chrome] › e2e\critical-flow.spec.ts:27:5 › login → dashboard → treino → registrar série (2.7s)

    1 passed (3.9s)
  ```
  ```
  Regressão do backend na raiz, após corrigir a contaminação cross-projeto — > npm test

  PASS src/auth/__tests__/auth.test.ts (5.781 s)
  PASS src/fitness/__tests__/setlogs.test.ts
  PASS src/fitness/__tests__/workouts.test.ts
  PASS src/fitness/__tests__/relations.test.ts

  Test Suites: 4 passed, 4 total
  Tests:       34 passed, 34 total
  Snapshots:   0 total
  Time:        12.294 s
  Ran all test suites.
  ```
  ```
  Build e lint do frontend, para garantir que os arquivos novos não quebraram nada — > npm run build

  ✓ Compiled successfully in 2.6s
    Running TypeScript ...
  ✓ Finished TypeScript in 3.2s

  Route (app)
  ┌ ○ /
  ├ ○ /_not-found
  ├ ○ /dashboard
  ├ ○ /login
  ├ ○ /personal/alunos/novo
  ├ ○ /personal/dashboard
  ├ ƒ /personal/treinos/[id]
  ├ ○ /personal/treinos/novo
  ├ ○ /register
  ├ ○ /treinos
  └ ƒ /treinos/[id]
  ```
- **Pendências conhecidas:** (1) Cobertura de componente não é exaustiva — cobre os pontos pedidos no prompt (AuthGuard, formulário de vínculo, formulário de série), não todas as telas (ex: dashboard do Personal, criação de treino não têm teste de componente dedicado, só cobertura indireta via E2E). (2) Um único teste E2E cobre o fluxo crítico; não há E2E para os fluxos do Personal (vincular aluno, criar treino) — ficou coberto apenas pela validação manual via Puppeteer da Fase 6, não por um teste permanente. (3) Playwright configurado para 1 worker/sem paralelismo, adequado para 1 teste; precisará de ajuste (isolamento de dados, possivelmente paralelismo) se a suíte E2E crescer.

## 2026-07-15 - Executado por Claude Code (Sonnet 5)
- **O que foi feito:** Primeiro item do roadmap pós-MVP — "Evolução" (Fase 8): histórico de carga e frequência de treinos, domínio `/src/progress` deixando de ser stub. Nenhuma tabela nova — é agregação sobre `SetLog` (Fase 4), já com `weightKg`, `repsDone` e `loggedAt`.
  **Decisões de arquitetura tomadas (documentadas conforme pedido):**
  1. **Granularidade do histórico de carga: por dia, não por sessão/treino individual.** Se o aluno registra o mesmo exercício em dois treinos no mesmo dia, os dois viram um único ponto (o maior peso do dia). Escolhido por ser a granularidade mais legível num gráfico de evolução e por evitar ruído de múltiplos pontos no mesmo dia — documentado como comentário no próprio `progress.service.ts`.
  2. **Variação percentual calculada no backend, não no frontend.** Duplicar a lógica de agregação por dia em dois lugares (para o frontend recalcular a mesma coisa) seria pior do que o backend já entregar o número pronto — o frontend só exibe.
  3. **Frequência: contagem de treinos distintos com pelo menos 1 `SetLog` por mês, meses vazios preenchidos com 0** (para o gráfico não "pular" meses sem treino). `totalWorkouts` é a contagem de treinos distintos no período inteiro, não a soma das colunas mensais — evita contar 2x um treino cujas séries, hipoteticamente, caiam em meses diferentes.
  4. **Todos os 3 endpoints (`load-history`, `frequency`, `exercises`) restritos a `role === ALUNO`** (403 para `PERSONAL`) — o dado é pessoal do aluno, mesmo que um Personal tecnicamente não teria dados por não ter `Workout` como `alunoId`.
  Backend: `GET /api/progress/load-history?exerciseId=...`, `GET /api/progress/frequency?period=...` (aceita `Nm`, ex: `3m`/`6m`/`12m`, default `6m`), e `GET /api/progress/exercises` (lista só os exercícios com pelo menos 1 série registrada — necessário para popular o seletor do frontend sem inventar endpoint de contrato diferente). Frontend: tela `/evolucao` reaproveitando 100% o design system "Voltagem" — sem paleta/tipografia nova. Gráficos com **Recharts** (pré-aprovado no prompt; já é a lib natural para React/Next e não exigiu pausa). Segui a skill de dataviz do ambiente: cores concretas em hex (Recharts não lê CSS custom properties), grid recessivo, marks finas de 2px com pontos ≥8px de área de toque, tooltip no hover, e uma visão em tabela (`<details>`) para acessibilidade em ambos os gráficos. Link "Evolução" adicionado ao `AppHeader`, visível só para `role === ALUNO`.
- **Arquivos Criados/Modificados:**
  - Backend: `src/progress/repository/progress.repository.ts` (novo), `src/progress/services/progress.service.ts` (novo), `src/progress/controllers/progress.controller.ts` (novo), `src/progress/routes/progress.routes.ts` (novo), `src/progress/__tests__/progress.test.ts` (novo, 7 testes), `src/app.ts` (registro de `progressRoutes`)
  - Frontend: `frontend/lib/api/progress.ts` (novo), `frontend/lib/types.ts` (`LoggedExercise`, `LoadHistoryPoint/Response`, `FrequencyMonth/Response`), `frontend/components/load-history-chart.tsx` (novo), `frontend/components/frequency-chart.tsx` (novo), `frontend/app/evolucao/page.tsx` (novo), `frontend/components/app-header.tsx` (link Evolução condicional a `role === ALUNO`), `frontend/e2e/evolucao-flow.spec.ts` (novo, E2E real), `frontend/package.json` (dependência `recharts`)
- **Evidência / Status dos Testes:**
  ```
  Backend — testes novos + suíte completa — > npm test

  PASS src/auth/__tests__/auth.test.ts (5.547 s)
  PASS src/fitness/__tests__/setlogs.test.ts
  PASS src/progress/__tests__/progress.test.ts
  PASS src/fitness/__tests__/workouts.test.ts
  PASS src/fitness/__tests__/relations.test.ts

  Test Suites: 5 passed, 5 total
  Tests:       41 passed, 41 total
  Snapshots:   0 total
  Time:        13.862 s
  Ran all test suites.
  ```
  ```
  Validação manual real via curl, com SetLogs de verdade criados pela API (não fixture inventada):

  === GET /api/progress/exercises ===
  {"exercises":[{"id":"07675656-b609-4c8c-8138-6a6e4e17f4c8","name":"Abdominal Supra no Solo","muscleGroup":"Abdômen"}]}

  === GET /api/progress/load-history?exerciseId=... (3 séries: 55/60/65kg no mesmo dia) ===
  {"exerciseId":"07675656-b609-4c8c-8138-6a6e4e17f4c8","history":[{"date":"2026-07-15","maxWeightKg":65}],"percentChangeVsPrevious":null}

  === GET /api/progress/frequency ===
  {"period":"6m","months":[{"month":"2026-02","workoutCount":0},{"month":"2026-03","workoutCount":0},{"month":"2026-04","workoutCount":0},{"month":"2026-05","workoutCount":0},{"month":"2026-06","workoutCount":0},{"month":"2026-07","workoutCount":1}],"totalWorkouts":1}

  === GET /api/progress/load-history sem exerciseId ===
  {"error":"exerciseId é obrigatório."} HTTP_STATUS:400

  === GET /api/progress/exercises como PERSONAL ===
  {"error":"Apenas alunos podem acessar o histórico de evolução."} HTTP_STATUS:403
  ```
  ```
  Frontend — E2E real (Playwright) contra backend+Postgres de verdade, dados criados via API antes do teste:

  Running 2 tests using 1 worker

    ok 1 [chrome] › e2e\critical-flow.spec.ts:27:5 › login → dashboard → treino → registrar série (3.4s)
    ok 2 [chrome] › e2e\evolucao-flow.spec.ts:26:5 › login → /evolucao → gráfico de carga e frequência com dados reais (3.1s)

    2 passed (7.6s)
  ```
  ```
  Frontend — unidade/integração (garantindo que nada quebrou) — > npm test

  Test Suites: 5 passed, 5 total
  Tests:       22 passed, 22 total
  Snapshots:   0 total
  Time:        3.871 s
  Ran all test suites.
  ```
  ```
  Frontend — > npm run build

  ✓ Compiled successfully in 3.2s
    Running TypeScript ...
  ✓ Finished TypeScript in 3.1s

  Route (app)
  ┌ ○ /
  ├ ○ /_not-found
  ├ ○ /dashboard
  ├ ○ /evolucao
  ├ ○ /login
  ├ ○ /personal/alunos/novo
  ├ ○ /personal/dashboard
  ├ ƒ /personal/treinos/[id]
  ├ ○ /personal/treinos/novo
  ├ ○ /register
  ├ ○ /treinos
  └ ƒ /treinos/[id]
  ```
  Screenshot real (via Playwright) da tela `/evolucao` renderizando com dados reais foi capturado e conferido visualmente durante a execução — gráfico de linha com o ponto correto (65kg, o pico do dia), barra de julho com valor 1, ambos no sistema de design "Voltagem" (dourado sobre fundo storm), antes de ser descartado (não commitado, era só para inspeção visual nesta sessão).
- **Pendências conhecidas:** (1) A granularidade "por dia" nunca foi visualmente testada com múltiplos dias reais distintos além do teste automatizado (a API não permite criar `SetLog` com `loggedAt` custom, então toda validação manual/E2E via UI só produz logs "de hoje" — a agregação multi-dia foi validada apenas no teste automatizado, que manipula `loggedAt` direto via Prisma). (2) Frequência sempre usa mês corrente do servidor; não há teste automatizado cobrindo virada de ano (dezembro→janeiro) explicitamente, embora a lógica com `Date.UTC` deva lidar com isso corretamente. (3) Herdada da Fase 7: cobertura de componente/unidade do frontend não inclui a tela `/evolucao` nem os componentes de gráfico — só o E2E cobre esse código novo.

## 2026-07-15 - Executado por Claude Code (Sonnet 5)
- **O que foi feito:** Prompt de Fase 9 pedia essencialmente o que já havia sido entregue nesta mesma sessão como Fase 7 (suíte de testes de frontend) e Fase 8 (Evolução) — a checklist de referência do próprio prompt não listava essas duas fases, sinal de que foi escrito sem saber que elas já tinham rodado. Não refiz esse trabalho (já está no `STATUS.md`, com evidência real, testes passando). Esta entrada cobre só o que era genuinamente novo: item 3 (polish) e item 4 (preparação para expansão mobile + stub de billing).
  **Item 4a (preparação mobile/Capacitor) — já satisfeito, sem mudança necessária:** auditei todas as páginas em `/frontend/app` e confirmei que 100% já usam `"use client"` + TanStack Query (nenhum Server Component buscando dado autenticado) desde a Fase 5 — não havia nada para corrigir aqui, documentando a confirmação em vez de inventar uma mudança.
  **Item 4b (stub de billing):** `/src/billing` deixou de ser stub — `POST /api/billing/webhook`, sem `authenticate` (um webhook externo real não carrega nosso JWT; a autenticidade de verdade viria da assinatura do provedor, fora de escopo aqui), validação mínima de payload (`event` obrigatório, string), loga via `request.log.info` e responde 200. Zero lógica de negócio — é só o esqueleto de contrato para a futura integração com um agregador de pagamento (ex: RevenueCat), evitando retrabalho de rota depois.
  **Item 3 (polish) — bug real de UX encontrado e corrigido:** 4 páginas (`/dashboard`, `/treinos`, `/personal/dashboard`, `/evolucao`) e 1 componente (`AddExerciseForm`) tratavam `isLoading` mas nunca `isError` nas suas queries do TanStack Query — se a requisição falhasse (rede, 500, sessão expirada não coberta pelo refresh), a tela ficava presa em "Carregando..." para sempre, sem nenhum feedback ou saída para o usuário. Criado `components/query-error.tsx` (mensagem específica via `ApiError`, ou genérica de rede, + botão "Tentar novamente" que chama `refetch()`) e aplicado nas 5 telas/componentes afetados. Também adicionado o pré-check de porta/Docker no `dev.sh`/`dev.ps1` (pendência conhecida desde a Fase 5.5): antes de subir qualquer coisa, os dois scripts agora rodam `docker info` (aborta com mensagem clara se o Docker não estiver rodando) e checam se as portas 3000/3001 já estão em uso (aborta com o PID e a sugestão de rodar `down` primeiro, em vez de silenciosamente tentar subir em cima de outra coisa).
- **Arquivos Criados/Modificados:**
  - Backend: `src/billing/controllers/billing.controller.ts` (novo), `src/billing/routes/billing.routes.ts` (novo), `src/billing/__tests__/billing.test.ts` (novo, 3 testes), `src/app.ts` (registro de `billingRoutes`)
  - Frontend: `frontend/components/query-error.tsx` (novo), `frontend/app/dashboard/page.tsx`, `frontend/app/treinos/page.tsx`, `frontend/app/personal/dashboard/page.tsx`, `frontend/app/evolucao/page.tsx`, `frontend/app/personal/treinos/novo/page.tsx`, `frontend/components/add-exercise-form.tsx` (todos: adicionado tratamento de `isError`/`isLoading` faltante)
  - Scripts: `dev.sh` (funções `check_docker`, `check_port_free`), `dev.ps1` (função `Test-PortFree` + checagem `docker info`)
- **Evidência / Status dos Testes:**
  ```
  Backend completo (com os 3 novos testes de billing) — > npm test

  PASS src/auth/__tests__/auth.test.ts (5.777 s)
  PASS src/billing/__tests__/billing.test.ts
  PASS src/fitness/__tests__/setlogs.test.ts
  PASS src/progress/__tests__/progress.test.ts
  PASS src/fitness/__tests__/relations.test.ts
  PASS src/fitness/__tests__/workouts.test.ts

  Test Suites: 6 passed, 6 total
  Tests:       44 passed, 44 total
  Snapshots:   0 total
  Time:        14.978 s
  Ran all test suites.
  ```
  ```
  Frontend — unidade/integração (garantindo que o polish não quebrou nada) — > npm test

  Test Suites: 5 passed, 5 total
  Tests:       22 passed, 22 total
  Snapshots:   0 total
  Time:        3.977 s
  Ran all test suites.
  ```
  ```
  Frontend — E2E real (Playwright), ambos os fluxos — > npx playwright test

  Running 2 tests using 1 worker

    ok 1 [chrome] › e2e\critical-flow.spec.ts:27:5 › login → dashboard → treino → registrar série (3.6s)
    ok 2 [chrome] › e2e\evolucao-flow.spec.ts:26:5 › login → /evolucao → gráfico de carga e frequência com dados reais (3.1s)

    2 passed (8.0s)
  ```
  ```
  Validação manual real do stub de billing — > curl

  POST /api/billing/webhook {"event":"subscription.renewed","data":{"userId":"xyz"}}
  {"received":true}
  HTTP_STATUS:200

  POST /api/billing/webhook {} (sem event)
  {"error":"event é obrigatório e deve ser uma string."}
  HTTP_STATUS:400
  ```
  ```
  Pré-check de porta do dev.sh (real, com porta 3000 propositalmente ocupada por outro processo antes do teste)

  ==> Pré-checagem (Docker + portas livres)...
  Backend: a porta 3000 já está em uso (PID 46056 ). Rode './dev.sh down' primeiro, ou libere a porta manualmente.
  ```
  ```
  Pré-check de porta do dev.ps1 (real, com porta 3001 propositalmente ocupada antes do teste)

  ==> Pre-checagem (Docker + portas livres)...
  Frontend: a porta 3001 ja esta em uso (PID 4744). Rode '.\dev.ps1 down' primeiro, ou libere a porta manualmente.
  ```
  ```
  ./dev.sh completo, do zero, com portas livres (real, log resumido — prisma:query omitido)

  ==> Pré-checagem (Docker + portas livres)...
  ==> Subindo PostgreSQL (docker-compose up -d)...
  ==> Aguardando Postgres ficar saudável...
  Postgres saudável.
  ==> Rodando migrations...
  ==> Populando catálogo de exercícios (idempotente)...
  ==> Subindo backend (porta 3000)...
  Backend respondendo.
  ==> Subindo frontend (porta 3001)...
  Frontend respondendo.
  ==> Garantindo usuário de teste (Personal + Aluno já vinculados)...
  Credenciais de teste salvas em TEST_CREDENTIALS.txt.

  $ curl http://localhost:3000/health -> {"status":"ok",...}
  $ curl -o /dev/null -w "%{http_code}" http://localhost:3001/login -> 200
  ```
  ```
  ./dev.sh down (real, verificado pós-comando)

  ==> Parando backend e frontend...
  Backend: processo(s) na porta 3000 derrubado(s).
  Frontend: processo(s) na porta 3001 derrubado(s).
  ==> Derrubando containers Docker...
   Container thunderafit_postgres Removed
  Tudo parado.

  $ docker ps -a --filter "name=thunderafit" -> vazio
  $ netstat -ano | grep -E ":3000 |:3001 " -> nenhuma porta em LISTENING
  ```
- **Pendências conhecidas:** (1) Polish foi best-effort conforme instruído — não houve varredura exaustiva de todas as telas em busca de toda inconsistência visual possível, só os gaps de `isError` encontrados ao revisar cada página com queries do TanStack Query. (2) O stub de billing não tem qualquer verificação de assinatura/autenticidade — é deliberadamente ingênuo, documentado como esqueleto de contrato, não uma implementação de segurança.

## 2026-07-16 - Executado por Claude Code (Sonnet 5)
- **O que foi feito:** Fase 10 — ativação dos três domínios stub `/src/anamnesis`, `/src/support` e `/src/notifications`, reaproveitando 100% o sistema de design "Voltagem" (nenhuma cor/tipografia nova).
  **Decisão de escopo (documentada, não pausada — nenhuma das 3 condições de pausa da autonomia ampliada se aplicava):** tocar `prisma/schema.prisma` e `src/app.ts`, embora não estivessem no escopo de arquivos listado no prompt, foi tratado como necessidade inevitável para "ativar" um domínio stub — o mesmo raciocínio já usado nas Fases 3/4/8 ao criar models novos e registrar rotas.
  **Decisão de escopo (cross-domain sem tocar `/src/fitness`):** tanto Anamnese ("Personal vê aluno vinculado") quanto Dúvidas ("aluno descobre seus Personals") precisavam de uma consulta que não existia em `/src/fitness` e que seria fora de escopo criar lá. Resolvido consultando `prisma.clientRelation` diretamente a partir dos repositórios de `anamnesis` e `support` (comentado inline como decisão deliberada, não descuido).
  **Decisão dos gatilhos de notificação:** o prompt sugeria "1-2 eventos existentes"; escolhi os dois inteiramente dentro do domínio `support` (nova dúvida → notifica o Personal; resposta do Personal → notifica o aluno; reabertura pelo aluno → notifica o Personal de novo) em vez de esticar até `/src/fitness` (ex: "treino prescrito"), o que violaria o escopo de arquivos desta fase.
  **Bloco A (Anamnese):** model `Anamnesis` 1:1 (`alunoId @unique`), campos de saúde/histórico/objetivos. `GET/POST/PUT /api/anamnesis` — aluno edita a própria (`GET` sem query = própria; 404 se ainda não preencheu; `POST` 409 se já existe; `PUT` 404 se ainda não criada); Personal vê só leitura via `?alunoId=`, 403 se não vinculado. Frontend: `/anamnese` (formulário do aluno) e `/personal/alunos/[alunoId]/anamnese` (visão read-only do Personal).
  **Bloco B (Dúvidas):** models `SupportThread` (status `ABERTO`/`RESPONDIDO`) e `SupportMessage`. Aluno cria thread com Personal vinculado (403 se não vinculado); ambos os lados respondem; resposta do Personal fecha (`RESPONDIDO`); nova mensagem do aluno num thread já respondido reabre (`ABERTO`). Sem WebSocket — `refetchOnWindowFocus: true` no detalhe da thread, conforme instrução explícita de que polling/refetch é suficiente. Frontend: `/duvidas` + `/duvidas/[id]` (aluno), `/personal/duvidas` (lista com filtro Abertas/Respondidas/Todas) + `/personal/duvidas/[id]`, componente compartilhado `SupportThreadDetail`.
  **Bloco C (Notificações):** model `Notification` (in-app apenas). **Decisão explícita, documentada em comentário no código:** push real (APNs/FCM) fica fora de escopo desta fase — `notify()` no service é o ponto de extensão natural para isso no futuro, não implementado agora. `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/:id/read` (404 se não existe ou não pertence ao caller), `POST /api/notifications/read-all`. Frontend: `NotificationBell` no `AppHeader` (ambos os papéis), badge de não-lidas, polling a cada 30s, dropdown com marcar-como-lida ao clicar.
  **Bug crítico encontrado e corrigido:** `apiFetch` em `frontend/lib/api/client.ts` sempre mandava `Content-Type: application/json` mesmo em requisições sem corpo (`POST` de logout, marcar notificação como lida). O parser JSON do Fastify rejeita corpo vazio com esse header via 400. Descoberto porque o novo E2E de Dúvidas falhava na asserção final (badge de notificação não sumia após clicar). Depurado com um script temporário (`_debug.spec.ts`, removido depois) que confirmou `POST .../read -> 400`. Corrigido enviando o header/body só quando `body !== undefined`. **Isso retroativamente significa que `logoutRequest()` estava silenciosamente quebrado desde a Fase 5.5** — o `try/finally` no botão Sair sempre limpava a sessão local independente do resultado da chamada, mascarando que a invalidação do refresh token no servidor nunca estava realmente acontecendo no logout. Corrigido junto.
  **Bug de UX encontrado e corrigido:** no `AppHeader`, em telas de ~390px, o wordmark "ThunderaFit" colidia visualmente com o primeiro link de texto ("ThunderaFitEvolução"), sem gap algum — `justify-between` colapsa o espaço quando o conteúdo não cabe, e não havia nenhum esconder responsivo. Corrigido escondendo o texto do wordmark e todos os links de texto abaixo de `sm:`, com `gap-2` explícito e `px-4 sm:px-6`; compensado adicionando os mesmos atalhos de navegação (visíveis só `sm:hidden`) diretamente em `/dashboard` e `/personal/dashboard`. Confirmado via screenshot real (Playwright) antes/depois.
  Ao final: suíte completa (backend + frontend unidade/integração) e o E2E do fluxo mais valioso (Dúvidas: aluno pergunta → Personal responde → aluno vê resposta + notificação), com dois usuários reais em duas sessões de navegador separadas (`browser.newContext()` x2). Evidência bruta colada abaixo.
- **Arquivos Criados/Modificados:**
  - Schema/infra (fora do escopo listado, tocados por necessidade inevitável): `prisma/schema.prisma` (models `Anamnesis`, `SupportThread`, `SupportMessage`, `Notification`), `prisma/migrations/20260716011658_add_anamnesis_support_notifications/migration.sql` (novo), `src/app.ts` (registro de `anamnesisRoutes`, `supportRoutes`, `notificationsRoutes`)
  - Backend: `src/anamnesis/repository/anamnesis.repository.ts`, `src/anamnesis/services/anamnesis.service.ts`, `src/anamnesis/controllers/anamnesis.controller.ts`, `src/anamnesis/routes/anamnesis.routes.ts`, `src/anamnesis/__tests__/anamnesis.test.ts` (novo, 10 testes); `src/support/repository/support.repository.ts`, `src/support/services/support.service.ts`, `src/support/controllers/support.controller.ts`, `src/support/routes/support.routes.ts`, `src/support/__tests__/support.test.ts` (novo, 9 testes); `src/notifications/repository/notifications.repository.ts`, `src/notifications/services/notifications.service.ts`, `src/notifications/controllers/notifications.controller.ts`, `src/notifications/routes/notifications.routes.ts`, `src/notifications/__tests__/notifications.test.ts` (novo, 5 testes)
  - Frontend: `frontend/lib/types.ts` (`Anamnesis`, `AnamnesisInput`, `SupportThreadStatus`, `SupportMessage`, `SupportThread`, `PersonalOption`, `Notification`), `frontend/lib/api/anamnesis.ts` (novo), `frontend/lib/api/support.ts` (novo), `frontend/lib/api/notifications.ts` (novo), `frontend/lib/api/client.ts` (fix do bug de Content-Type), `frontend/components/notification-bell.tsx` (novo), `frontend/components/app-header.tsx` (sino de notificações, nav links, fix de overflow mobile), `frontend/components/support-thread-detail.tsx` (novo, compartilhado), `frontend/app/anamnese/page.tsx` (novo), `frontend/app/personal/alunos/[alunoId]/anamnese/page.tsx` (novo), `frontend/app/duvidas/page.tsx` (novo), `frontend/app/duvidas/[id]/page.tsx` (novo), `frontend/app/personal/duvidas/page.tsx` (novo), `frontend/app/personal/duvidas/[id]/page.tsx` (novo), `frontend/app/dashboard/page.tsx` e `frontend/app/personal/dashboard/page.tsx` (atalhos mobile compensando o header), `frontend/e2e/duvidas-flow.spec.ts` (novo, E2E do fluxo mais valioso)
- **Evidência / Status dos Testes:**
  ```
  Migration — > npx prisma migrate dev --name add_anamnesis_support_notifications

  Applying migration `20260716011658_add_anamnesis_support_notifications`

  The following migration(s) have been created and applied from new schema changes:

  migrations/
    └─ 20260716011658_add_anamnesis_support_notifications/
      └─ migration.sql

  Your database is now in sync with your schema.
  Running generate... - Prisma Client
  ✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client
  ```
  ```
  Backend — testes novos por domínio, isolados primeiro

  PASS src/anamnesis/__tests__/anamnesis.test.ts
  Tests: 10 passed, 10 total

  PASS src/support/__tests__/support.test.ts
  Tests: 9 passed, 9 total

  PASS src/notifications/__tests__/notifications.test.ts
  Tests: 5 passed, 5 total
  ```
  ```
  Backend — suíte completa final (reexecutada do zero, última checagem antes de fechar a fase) — > npm test

  PASS src/auth/__tests__/auth.test.ts (5.604 s)
  PASS src/progress/__tests__/progress.test.ts
  PASS src/fitness/__tests__/setlogs.test.ts
  PASS src/support/__tests__/support.test.ts
  PASS src/anamnesis/__tests__/anamnesis.test.ts
  PASS src/fitness/__tests__/workouts.test.ts
  PASS src/fitness/__tests__/relations.test.ts
  PASS src/notifications/__tests__/notifications.test.ts
  PASS src/billing/__tests__/billing.test.ts

  Test Suites: 9 passed, 9 total
  Tests:       68 passed, 68 total
  Snapshots:   0 total
  Time:        19.655 s, estimated 21 s
  Ran all test suites.
  ```
  ```
  Bug encontrado via E2E — depuração com script temporário (_debug.spec.ts, removido após uso):

  POST http://localhost:3000/api/notifications/<id>/read -> 400

  Após o fix em client.ts (Content-Type só quando há body):

  POST http://localhost:3000/api/notifications/<id>/read -> 200
  ```
  ```
  Frontend — E2E completo (Playwright), incluindo o fluxo mais valioso (Dúvidas, 2 sessões de navegador) — > npx playwright test

  Running 3 tests using 1 worker

    ok 1 [chrome] › e2e\critical-flow.spec.ts:27:5 › login → dashboard → treino → registrar série (2.8s)
    ok 2 [chrome] › e2e\duvidas-flow.spec.ts:26:5 › aluno pergunta → Personal responde → aluno vê resposta e notificação (5.6s)
    ok 3 [chrome] › e2e\evolucao-flow.spec.ts:26:5 › login → /evolucao → gráfico de carga e frequência com dados reais (3.2s)

    3 passed (12.1s)
  ```
  ```
  Frontend — unidade/integração (garantindo que nada quebrou) — > npm test

  Test Suites: 5 passed, 5 total
  Tests:       22 passed, 22 total
  Snapshots:   0 total
  Time:        3.183 s
  Ran all test suites.
  ```
  ```
  Frontend — > npx tsc --noEmit && npx eslint . (ambos limpos, sem erros/warnings)
  ```
  ```
  Frontend — > npm run build (checagem final, após o fix do overflow mobile do header)

  ✓ Compiled successfully in 3.9s
    Running TypeScript ...
    Finished TypeScript in 4.2s ...

  Route (app)
  ┌ ○ /
  ├ ○ /_not-found
  ├ ○ /anamnese
  ├ ○ /dashboard
  ├ ○ /duvidas
  ├ ƒ /duvidas/[id]
  ├ ○ /evolucao
  ├ ○ /login
  ├ ƒ /personal/alunos/[alunoId]/anamnese
  ├ ○ /personal/alunos/novo
  ├ ○ /personal/dashboard
  ├ ○ /personal/duvidas
  ├ ƒ /personal/duvidas/[id]
  ├ ○ /personal/treinos/[id]
  ├ ○ /personal/treinos/novo
  ├ ○ /register
  ├ ○ /treinos
  └ ƒ /treinos/[id]
  ```
- **Pendências conhecidas:** (1) Notificações são in-app apenas — push real (APNs/FCM) é decisão explícita fora de escopo desta fase, documentada como ponto de extensão futuro no `notify()`. (2) Dúvidas usa polling/refetch-on-focus, não WebSocket, conforme instrução explícita do prompt — em produção com volume alto de mensagens simultâneas, um usuário só vê a resposta do outro lado ao focar a aba ou no próximo poll do `NotificationBell` (30s), não instantaneamente. (3) A anamnese não tem histórico de versões — `PUT` sobrescreve os campos anteriores, sem trilha de auditoria (aceitável para o MVP, mas relevante se no futuro for preciso ver o que mudou e quando). (4) O bug de `Content-Type`/400 corrigido nesta fase esteve presente desde a Fase 5.5 sem detecção — vale considerar, como item de hardening futuro, adicionar um teste de integração de API-client dedicado a chamadas sem corpo, para não depender de um E2E pegar esse tipo de regressão de novo.

## 2026-07-16 - Executado por Claude Code (Sonnet 5)
- **O que foi feito:** Fase 11 — Módulo de Nutrição & Multi-Profissional, em 4 blocos sequenciais com checkpoint de evidência entre cada um (autonomia restrita desta fase, por alterar comportamento já validado desde a Fase 2). Nenhuma das 2 condições de pausa da cláusula de autonomia se aplicou: a mudança de `Role`/`professionalType` foi 100% aditiva (novo valor de enum, sem invalidar dado existente) e nenhum campo de resposta já consumido em produção foi removido/renomeado (`GET /api/relations` manteve o mesmo formato).
  **Bloco 1 — Nutricionista como profissional + limite por profissional:** `Role` ganhou o valor `NUTRICIONISTA` (migration aditiva `20260716021028_add_nutricionista_role`); `register` passou a aceitar os 3 valores. Auditei a contagem do limite Freemium (`relationsRepository.countByPersonal`) e confirmei que **já era filtrada pelo id exato do profissional autenticado** (o campo `personalId` do `ClientRelation` guarda o id de quem vinculou, seja Personal ou Nutricionista) — ou seja, o limite já era por profissional antes mesmo de eu tocar no código; a única mudança real necessária foi `POST /api/relations` parar de assumir `PERSONAL` fixo e passar a inferir `professionalType` do `role` de quem chama (nunca aceito do cliente), com um guard novo (403) para bloquear um `ALUNO` chamando o endpoint — gap de autorização pré-existente, corrigido de passagem por estar exatamente no código sendo tocado. `GET /api/relations` e o lookup por e-mail (Fase 6) já funcionavam simetricamente, sem mudança.
  **Bloco 2 — Módulo de Nutrição:** models `Food` (catálogo, 26 alimentos curados via seed, mesmo padrão AI Seeder da Fase 3), `DietPlan`/`DietMeal`/`DietFood` (migration `20260716021503_add_nutrition_module`). **Decisão de granularidade (documentada no schema):** `DietFood.quantity` é um multiplicador da porção-base do `Food` (ex: `portionDescription = "100g"`, `quantity = 1.5` → 150g), não um valor absoluto — evita duplicar conversão porção↔grama, mesma filosofia "backend calcula, frontend só exibe" da Fase 8. `DietPlan` representa um dia de plano (mesmo escopo "1 sessão" do `Workout` da Fase 3). Endpoints: `GET /api/foods`, `POST /api/diet-plans` (mesma checagem de vínculo do `POST /api/workouts`, mas via `(nutricionistaId, alunoId)` + `professionalType === NUTRICIONISTA`), `POST /api/diet-plans/:id/meals`, `POST /api/diet-plans/:id/meals/:mealId/foods`, `GET /api/diet-plans/:id` (agregação de macros por refeição e total do dia). Validação explícita dos macros agregados feita tanto em teste automatizado quanto manualmente via curl (evidência abaixo) — bateu exatamente com o cálculo manual em ambos os casos.
  **Bloco 3 — Frontend do Nutricionista:** `/nutricionista/dashboard` (espelha `/personal/dashboard` — alunos vinculados + `VoltageBar` com limite próprio + planos criados), `/nutricionista/alunos/novo` (extraído para o componente compartilhado `VincularAlunoForm`, reaproveitado também pelo Personal), `/nutricionista/planos/novo` e `/nutricionista/planos/[id]` (criar plano + adicionar refeições/alimentos). Terceiro botão de role adicionado em `/register`. `dashboardPathForRole` ganhou o terceiro branch (`/nutricionista/dashboard`).
  **Bloco 4 — Dashboard unificado do aluno:** `/dashboard` agora busca tanto `listMyWorkouts` quanto `listMyDietPlans` e renderiza os dois cards condicionalmente ("Próximo treino" se houver Personal vinculado, "Plano alimentar de hoje" se houver Nutricionista vinculado) — um aluno pode ter só um dos dois, ambos, ou nenhum ainda. Novo componente compartilhado `DietPlanView` (macros por refeição + total do dia) reaproveitado tanto pela tela editável do Nutricionista (`/nutricionista/planos/[id]`) quanto pela tela read-only do aluno (`/dieta/[id]`, nova, no mesmo padrão visual de `/treinos/[id]`).
  Ao final: suíte completa (backend + frontend) reexecutada, e 2 E2E novos — o fluxo do Nutricionista (Bloco 3) e, especialmente, **o cenário multi-profissional do Bloco 4**: um único aluno de teste vinculado simultaneamente a um Personal e a um Nutricionista, dashboard mostrando os dois cards com os dados corretos de cada um (sem vazamento cruzado). Evidência bruta de todos os 4 checkpoints colada abaixo, incluindo o teste manual explicitamente pedido no prompt (aluno 3/3 num Personal ainda sendo vinculável a um Nutricionista com vaga livre) — não apenas os testes automatizados.
- **Arquivos Criados/Modificados:**
  - Schema/infra: `prisma/schema.prisma` (enum `Role` +`NUTRICIONISTA`; models `Food`, `DietPlan`, `DietMeal`, `DietFood`), `prisma/migrations/20260716021028_add_nutricionista_role/migration.sql` (novo), `prisma/migrations/20260716021503_add_nutrition_module/migration.sql` (novo), `data/foods_seed.json` (novo, 26 alimentos), `prisma/seed.ts` (seed de `Food`), `src/app.ts` (registro de `foodsRoutes`, `dietPlansRoutes`)
  - Backend: `src/auth/controllers/auth.controller.ts` (aceita `NUTRICIONISTA` no register), `src/fitness/services/relations.service.ts` (`createRelation` aceita `professionalType`), `src/fitness/controllers/relations.controller.ts` (infere `professionalType` do role autenticado, guard 403 para não-profissional), `src/fitness/__tests__/relations.test.ts` (5 novos testes, incluindo o cenário crítico de limite por profissional); `src/nutrition/repository/foods.repository.ts`, `src/nutrition/services/foods.service.ts`, `src/nutrition/controllers/foods.controller.ts`, `src/nutrition/routes/foods.routes.ts`, `src/nutrition/repository/diet-plans.repository.ts`, `src/nutrition/services/diet-plans.service.ts`, `src/nutrition/controllers/diet-plans.controller.ts`, `src/nutrition/routes/diet-plans.routes.ts`, `src/nutrition/__tests__/diet-plans.test.ts` (novo, 11 testes)
  - Frontend: `frontend/lib/types.ts` (`Role` +`NUTRICIONISTA`; `Food`, `Macros`, `DietPlan`, `DietFoodItem`, `DietMealDetail`, `DietPlanDetail`), `frontend/lib/auth/redirect.ts` (3º branch), `frontend/lib/api/nutrition.ts` (novo), `frontend/app/register/page.tsx` (3º botão de role), `frontend/components/vincular-aluno-form.tsx` (novo, extraído e compartilhado), `frontend/app/personal/alunos/novo/page.tsx` (refatorado para usar o componente compartilhado), `frontend/app/nutricionista/alunos/novo/page.tsx` (novo), `frontend/app/nutricionista/dashboard/page.tsx` (novo), `frontend/app/nutricionista/planos/novo/page.tsx` (novo), `frontend/app/nutricionista/planos/[id]/page.tsx` (novo), `frontend/components/add-diet-meal-form.tsx` (novo), `frontend/components/add-diet-food-form.tsx` (novo), `frontend/components/diet-plan-view.tsx` (novo, compartilhado), `frontend/app/dashboard/page.tsx` (dois cards condicionais), `frontend/app/dieta/[id]/page.tsx` (novo), `frontend/e2e/nutricionista-flow.spec.ts` (novo), `frontend/e2e/multi-profissional-flow.spec.ts` (novo)
- **Evidência / Status dos Testes:**
  ```
  Migrations — > npx prisma migrate dev (2x, uma por bloco)

  Applying migration `20260716021028_add_nutricionista_role`
  Your database is now in sync with your schema.

  Applying migration `20260716021503_add_nutrition_module`
  Your database is now in sync with your schema.
  ```
  ```
  BLOCO 1 — checkpoint: > npx jest src/fitness/__tests__/relations.test.ts

  PASS src/fitness/__tests__/relations.test.ts
    POST /api/relations (5 testes originais) ✓
    GET /api/users/lookup (3 testes originais) ✓
    Fase 11 — Nutricionista como segundo tipo de profissional (limite por profissional)
      √ aluno já no limite (3/3) do Personal ainda pode ser vinculado a um Nutricionista com vaga livre
      √ GET /api/relations do Nutricionista retorna só o vínculo dele, não os do Personal
      √ Nutricionista atinge o próprio limite (3) independente do Personal já estar 3/3
      √ GET /api/relations do Personal continua mostrando 3, sem contaminação do Nutricionista
      √ um ALUNO autenticado não pode chamar POST /api/relations (403)

  Tests: 13 passed, 13 total
  ```
  ```
  BLOCO 1 — validação manual real via curl (não só o teste automatizado), cenário crítico:

  == Personal vincula 3 alunos (3/3) ==
  vincular ecc9e786... -> HTTP_STATUS:201
  vincular 2b5c1887... -> HTTP_STATUS:201
  vincular 6cc13556... -> HTTP_STATUS:201

  == Nutricionista vincula O MESMO aluno1 (já 3/3 no Personal) ==
  {"relation":{"id":"7b0fcafa...","personalId":"494cc061...","alunoId":"ecc9e786...","professionalType":"NUTRICIONISTA","createdAt":"..."}}
  HTTP_STATUS:201

  == GET /api/relations do Nutricionista (só 1, o aluno1) ==
  {"relations":[{"id":"ecc9e786...","email":"manual_p11_aluno1@thunderafit.test",...}]}

  == GET /api/relations do Personal (continua 3, sem contaminação) ==
  {"relations":[{"id":"ecc9e786...",...},{"id":"2b5c1887...",...},{"id":"6cc13556...",...}]}
  ```
  ```
  BLOCO 1 — suíte completa (checkpoint "não regrediu, ≥44") — > npm test

  Test Suites: 9 passed, 9 total
  Tests:       73 passed, 73 total
  Ran all test suites.
  ```
  ```
  BLOCO 2 — > npm run db:seed

  Seeding 29 exercises...
  Seeding 26 foods...
  Seeding complete.
  ```
  ```
  BLOCO 2 — checkpoint: > npx jest src/nutrition/__tests__/diet-plans.test.ts

  PASS src/nutrition/__tests__/diet-plans.test.ts
    GET /api/foods ✓
    POST /api/diet-plans (3 testes) ✓
    POST /api/diet-plans/:id/meals e /foods — agregação de macros (5 testes) ✓
    GET /api/diet-plans (2 testes) ✓

  Tests: 11 passed, 11 total
  ```
  ```
  BLOCO 2 — validação manual real via curl: plano completo com 3 refeições, macros conferidos à mão

  Refeição "Cafe da manha": Aveia (3.9P/18C/2G/113kcal) + Banana (1.1/23/0.3/89)
    -> esperado 5.0P/41C/2.3G/202kcal — API retornou exatamente isso.

  Refeição "Almoco": Frango x1.5 (46.5/0/5.4/247.5) + Batata Doce x2 (3.2/40/0.2/172)
    -> esperado 49.7P/40C/5.6G/419.5kcal — API retornou exatamente isso.

  Refeição "Lanche": Ovo x2 (12.6/1.2/10.6/156)
    -> esperado 12.6P/1.2C/10.6G/156kcal — API retornou exatamente isso.

  Total do dia esperado: 67.3P / 82.2C / 18.5G / 777.5kcal — API (totalMacros) bateu exatamente.
  ```
  ```
  BLOCO 2 — suíte completa (checkpoint) — > npm test

  Test Suites: 10 passed, 10 total
  Tests:       84 passed, 84 total
  Ran all test suites.
  ```
  ```
  BLOCO 3 — > npx tsc --noEmit && npx eslint . (frontend, ambos limpos)
  ```
  ```
  BLOCO 3 — checkpoint E2E real (Playwright), fluxo completo do Nutricionista pela UI:

  Running 1 test using 1 worker
    ok 1 [chrome] › e2e\nutricionista-flow.spec.ts:20:5 › Nutricionista se cadastra, vincula aluno e cria plano de dieta com 2 refeições (3.3s)
  1 passed (4.4s)
  ```
  ```
  BLOCO 4 — checkpoint E2E real (Playwright), cenário multi-profissional — o mais importante desta fase:

  Running 1 test using 1 worker
    ok 1 [chrome] › e2e\multi-profissional-flow.spec.ts:25:5 › aluno com Personal E Nutricionista simultâneos vê os dois cards no dashboard (4.6s)
  1 passed (5.9s)
  ```
  ```
  BLOCO 4 (final) — suíte COMPLETA, backend + frontend + E2E, reexecutada do zero:

  Backend — > npm test
  Test Suites: 10 passed, 10 total
  Tests:       84 passed, 84 total
  Ran all test suites.

  Frontend unidade/integração — > npm test
  Test Suites: 5 passed, 5 total
  Tests:       22 passed, 22 total
  Ran all test suites.

  Frontend E2E — > npx playwright test
  Running 5 tests using 1 worker
    ok 1 [chrome] › e2e\critical-flow.spec.ts:27:5 › login → dashboard → treino → registrar série (3.3s)
    ok 2 [chrome] › e2e\duvidas-flow.spec.ts:26:5 › aluno pergunta → Personal responde → aluno vê resposta e notificação (6.4s)
    ok 3 [chrome] › e2e\evolucao-flow.spec.ts:26:5 › login → /evolucao → gráfico de carga e frequência com dados reais (4.0s)
    ok 4 [chrome] › e2e\multi-profissional-flow.spec.ts:25:5 › aluno com Personal E Nutricionista simultâneos vê os dois cards no dashboard (4.0s)
    ok 5 [chrome] › e2e\nutricionista-flow.spec.ts:20:5 › Nutricionista se cadastra, vincula aluno e cria plano de dieta com 2 refeições (4.1s)
  5 passed (23.3s)
  ```
  ```
  Frontend — > npm run build (final, com as 5 novas rotas de Fase 11)

  ✓ Compiled successfully in 3.9s
    Running TypeScript ...
    Finished TypeScript in 4.6s ...

  Route (app)
  ┌ ○ /
  ├ ○ /_not-found
  ├ ○ /anamnese
  ├ ○ /dashboard
  ├ ƒ /dieta/[id]
  ├ ○ /duvidas
  ├ ƒ /duvidas/[id]
  ├ ○ /evolucao
  ├ ○ /login
  ├ ○ /nutricionista/alunos/novo
  ├ ○ /nutricionista/dashboard
  ├ ƒ /nutricionista/planos/[id]
  ├ ○ /nutricionista/planos/novo
  ├ ƒ /personal/alunos/[alunoId]/anamnese
  ├ ○ /personal/alunos/novo
  ├ ○ /personal/dashboard
  ├ ○ /personal/duvidas
  ├ ƒ /personal/duvidas/[id]
  ├ ƒ /personal/treinos/[id]
  ├ ○ /personal/treinos/novo
  ├ ○ /register
  ├ ○ /treinos
  └ ƒ /treinos/[id]
  ```
- **Pendências conhecidas:** (1) `DietPlan` não tem conceito de data/dia — "plano alimentar de hoje" no dashboard do aluno usa o mesmo tipo de simplificação documentada desde a Fase 5 para "próximo treino" (primeiro item da lista, sem noção real de "hoje" no backend); se o produto precisar de múltiplos planos por período, isso precisará de um campo de data ou vigência. (2) O gap de autorização em `POST /api/relations` (qualquer autenticado podia chamar, incluindo `ALUNO`) já existia desde a Fase 2 e não fazia parte do escopo original desta fase — foi corrigido de passagem por estar exatamente no código que o Bloco 1 já precisava tocar, não por uma varredura de segurança dedicada; outros endpoints não tocados nesta fase não foram reauditados. (3) Dúvidas/Anamnese continuam exclusivas do vínculo com Personal — não foram estendidas para o relacionamento com Nutricionista nesta fase, por não estar no escopo dos 4 blocos pedidos (ficaria como extensão natural futura do domínio `support`/`anamnesis`, fora do módulo de nutrição). (4) `DietFood.quantity` aceita qualquer número positivo pelo formulário (min 0.5, step 0.5) mas não há validação de limite superior no backend — aceitável para o MVP, mas um valor absurdo (ex: 1000 porções) não é rejeitado.

## 2026-07-16 - Executado por Claude Code (Sonnet 5)
- **O que foi feito:** Fase 12 — Polish Visual & Usabilidade, 4 itens independentes, nenhum deles exigiu tocar `/src/auth` ou mudar contrato de API de forma não-aditiva (backend não foi tocado nesta fase — confirmado via `git status src/` vazio antes de escrever o STATUS).
  **Item 1 (Tela Inicial com Seleção de Perfil):** `/` deixou de redirecionar direto para `/login` — agora mostra 3 boxes grandes (Personal/Aluno/Nutricionista), cada um com copy contextualizada, levando para `/register?role=X`. A escolha de papel saiu de dentro do form de `/register` (3º botão de role, da Fase 11) — `/register` agora só lê `role` da query string; se vier ausente/inválido (link antigo, acesso direto), redireciona de volta para `/` em vez de mostrar um form quebrado. Sessão já ativa em `/` continua pulando a seleção e indo direto pro dashboard certo (comportamento antigo preservado). Criado `frontend/lib/roles.ts` com os metadados de cada papel (label, tagline, cor de acento), fonte única reaproveitada tanto por `/` quanto por `/register`.
  **Item 2 (Acento de Cor por Papel):** 3 novas variáveis CSS (`--role-personal`, `--role-aluno`, `--role-nutricionista`), tratadas como extensão da paleta Voltagem existente, não uma paleta nova:
  - **Personal → `#FFC93C`** (o dourado `--volt-400` que já era o acento padrão do produto desde a Fase 5) — mantém a identidade "energia do treino" que o Personal já carregava implicitamente.
  - **Aluno → `#3FD0C9`** (o ciano `--static-450` que já identificava Evolução/progresso pessoal desde a Fase 8) — reforça a narrativa "seu crescimento" que já era do aluno.
  - **Nutricionista → `#B98CFF`** (violeta, cor genuinamente nova) — comunica cuidado/vitalidade sem reutilizar verde/vermelho (reservados para success/danger); testado no validador de paleta da skill de dataviz — CVD/contraste/distinção normal-vision todos PASS (a única checagem que falhou, "lightness band", é calibrada para séries categóricas de gráfico contra superfície escura, não para chips de acento de UI — os acentos já existentes no produto, gold/ciano, têm exatamente o mesmo perfil de luminosidade e nunca foram um problema real).
  Aplicado em 2 lugares deliberadamente pequenos (não repintou a interface): a `VoltageBar` (novo prop `role`, tinge os segmentos preenchidos via `--voltage-accent`) nos 3 dashboards + execução de treino; e o `AppHeader` (borda inferior de 2px + uma bolinha de 8px ao lado do wordmark). **Bug descoberto durante a validação visual:** a primeira tentativa tingia a cor do próprio emoji ⚡ via `color` CSS — não teve nenhum efeito, porque emojis coloridos (fonte de emoji do sistema) ignoram a propriedade `color`/`currentColor`, sempre renderizando com a cor própria da fonte. Corrigido substituindo por elementos que realmente respeitam `color`/`background-color` (borda superior nos boxes da tela inicial, borda inferior + bolinha no header) — confirmado via screenshot antes/depois.
  **Item 3 (Erro Acionável ao Vincular Aluno):** `VincularAlunoForm` (compartilhado desde a Fase 11 entre Personal e Nutricionista) trata 404 separadamente dos outros erros — em vez de texto genérico, mostra "Esse e-mail ainda não tem conta no ThunderaFit. Peça para seu aluno se cadastrar primeiro." com um botão "Copiar convite para compartilhar" que copia (`navigator.clipboard.writeText`) um texto de convite pronto, incluindo o link `/register?role=ALUNO` e o nome do profissional que convidou ("Personal Trainer" ou "Nutricionista", novo prop `professionalLabel`). Validado com clique real de navegador (não só o teste unitário com clipboard mockado) — texto copiado conferido via `navigator.clipboard.readText()`.
  **Item 4 (Teaser de Evolução):** novo componente `EvolucaoTeaser` no dashboard do aluno, usando os endpoints já existentes (`GET /api/progress/exercises` + `/load-history`) — pega o primeiro exercício com séries registradas (mesma simplificação de "primeiro item da lista" já documentada para "próximo treino"/"plano de hoje"), mostra `{exercício}: {+/-X.X}% na última sessão` quando há `percentChangeVsPrevious` calculável, ou um estado vazio convidativo ("Registre suas primeiras séries para ver sua evolução aqui.") quando ainda não há 2 dias distintos de dado — nunca esconde o card nem quebra. Validado nos dois estados (vazio e populado, este último manipulando `loggedAt` via Prisma para simular 2 dias, mesma técnica de teste já usada na Fase 8).
  **Bug de ambiente descoberto e corrigido durante a validação (não é da Fase 12, mas bloqueava testá-la):** a suíte de E2E começou a falhar com "Can't reach database server at localhost:5432" mesmo com o Postgres saudável e uma conexão TCP crua funcionando via `localhost`. Isolado ao Prisma especificamente (uma conexão TCP simples via Node funcionava instantaneamente); forçar `127.0.0.1` em vez de `localhost` no `DATABASE_URL` resolveu — o mesmo tipo de bug de resolução IPv6-primeiro já documentado no `Invoke-WebRequest` do `dev.ps1` na Fase 5.5, agora afetando a engine do Prisma. Corrigido em `.env` e documentado em `.env.example` para não se repetir em setups futuros.
  Ao final: suíte completa reexecutada (backend intacto, 84/84; frontend unidade/integração 22/22; E2E — todos os 5 já existentes mais 3 novos, 8/8), e validação visual real via Playwright com screenshots dos 4 itens (login→dashboard aluno/Personal/Nutricionista, tela de vincular com 404, landing de seleção).
- **Arquivos Criados/Modificados:**
  - Design system: `frontend/app/globals.css` (3 variáveis `--role-*`, mapeamento `@theme inline`, `.voltage-segment` aceita `--voltage-accent`)
  - Item 1: `frontend/lib/roles.ts` (novo), `frontend/app/page.tsx` (reescrito — landing com 3 boxes), `frontend/app/register/page.tsx` (reescrito — lê `role` da query, sem picker, `Suspense` para `useSearchParams`)
  - Item 2: `frontend/components/voltage-bar.tsx` (prop `role`), `frontend/components/app-header.tsx` (borda + bolinha por papel), `frontend/app/dashboard/page.tsx`, `frontend/app/personal/dashboard/page.tsx`, `frontend/app/nutricionista/dashboard/page.tsx`, `frontend/app/treinos/[id]/page.tsx`, `frontend/components/exercise-execution-card.tsx` (todos: `role` passado ao `VoltageBar`)
  - Item 3: `frontend/components/vincular-aluno-form.tsx` (404 tratado à parte + `AlunoNaoEncontrado` com botão de copiar convite, novo prop `professionalLabel`), `frontend/app/personal/alunos/novo/page.tsx`, `frontend/app/nutricionista/alunos/novo/page.tsx` (passam `professionalLabel`)
  - Item 4: `frontend/components/evolucao-teaser.tsx` (novo), `frontend/app/dashboard/page.tsx` (usa o teaser)
  - Testes: `frontend/__tests__/components/vincular-aluno.test.tsx` (teste do 404 atualizado para a nova mensagem + botão de copiar), `frontend/e2e/selecao-perfil-flow.spec.ts` (novo), `frontend/e2e/nutricionista-flow.spec.ts` (fluxo de registro atualizado para passar por `/` primeiro), `frontend/e2e/evolucao-flow.spec.ts` (locator do link "Evolução" desambiguado do novo teaser)
  - Ambiente: `.env` e `.env.example` (`DATABASE_URL` usa `127.0.0.1`, não `localhost`)
- **Evidência / Status dos Testes:**
  ```
  Validação da paleta de acento (Item 2) — node scripts/validate_palette.js "#FFC93C,#3FD0C9,#B98CFF" --mode dark

  [FAIL] Lightness band         outside band (esperado — ver justificativa no corpo da entrada)
  [PASS] Chroma floor           all 3 >= 0.1
  [PASS] CVD separation         worst adjacent ΔE 12.6 (deutan) · tritan 16.9
  [PASS] Normal-vision floor    worst adjacent ΔE 23.5 (normal)
  [PASS] Contrast vs surface    all 3 >= 3:1
  ```
  ```
  Bug de ambiente encontrado e corrigido — Prisma não alcançava o Postgres via "localhost"

  ERR Invalid `prisma.user.count()` invocation: Can't reach database server at `localhost:5432`
  (conexão TCP crua via Node, mesma máquina, mesmo host "localhost": CONNECTED — confirma que não é rede/firewall)

  Após forçar 127.0.0.1 no DATABASE_URL:
  > node -e "... DATABASE_URL=...127.0.0.1... prisma.user.count()"
  user count 3
  ```
  ```
  Frontend — > npx tsc --noEmit && npx eslint . (ambos limpos, sem erros/warnings)
  ```
  ```
  Backend — suíte completa (não tocado nesta fase, checando que nada regrediu) — > npm test

  Test Suites: 10 passed, 10 total
  Tests:       84 passed, 84 total
  Ran all test suites.
  ```
  ```
  Frontend — unidade/integração, incluindo o teste do 404 acionável reescrito (Item 3) — > npm test

  Test Suites: 5 passed, 5 total
  Tests:       22 passed, 22 total
  Ran all test suites.
  ```
  ```
  Frontend — E2E completo (5 já existentes + 3 novos do Item 1) — > npx playwright test

  Running 8 tests using 1 worker
    ok 1 [chrome] › e2e\critical-flow.spec.ts:27:5 › login → dashboard → treino → registrar série (3.1s)
    ok 2 [chrome] › e2e\duvidas-flow.spec.ts:26:5 › aluno pergunta → Personal responde → aluno vê resposta e notificação (6.1s)
    ok 3 [chrome] › e2e\evolucao-flow.spec.ts:26:5 › login → /evolucao → gráfico de carga e frequência com dados reais (3.3s)
    ok 4 [chrome] › e2e\multi-profissional-flow.spec.ts:25:5 › aluno com Personal E Nutricionista simultâneos vê os dois cards no dashboard (3.2s)
    ok 5 [chrome] › e2e\nutricionista-flow.spec.ts:20:5 › Nutricionista se cadastra, vincula aluno e cria plano de dieta com 2 refeições (3.7s)
    ok 6 [chrome] › e2e\selecao-perfil-flow.spec.ts:12:5 › `/` mostra os 3 perfis e o registro chega pré-contextualizado (1.8s)
    ok 7 [chrome] › e2e\selecao-perfil-flow.spec.ts:37:5 › /register sem `role` na URL volta para a seleção de perfil (568ms)
    ok 8 [chrome] › e2e\selecao-perfil-flow.spec.ts:42:5 › registro real via backend confirma o role correto quando vindo do fluxo de seleção (1.9s)
  8 passed (25.1s)
  ```
  ```
  Validação manual real do texto de convite copiado (Item 3) — clique de verdade no navegador, não mock:

  CLIPBOARD_TEXT: Oi! Te convidei pra usar o ThunderaFit comigo como seu(sua) Personal Trainer.
  Cria sua conta de aluno aqui: http://localhost:3001/register?role=ALUNO
  ```
  ```
  Validação visual real via screenshots (Playwright), todos os 4 itens conferidos:

  1. `/` — 3 boxes com borda superior dourada/ciano/violeta distintas, copy contextualizada por papel.
  2. `/register?role=PERSONAL` — heading "Cadastro — Personal Trainer" + tagline, sem seletor de role, com
     "Não é personal trainer? Escolher outro perfil" e "Já tem conta? Entrar".
  3. Dashboard do aluno — header com borda/bolinha ciano, VoltageBar ciano no card de treino, card de plano
     alimentar, teaser de Evolução no estado vazio ("Registre suas primeiras séries...").
  4. Dashboard do Personal — header com borda/bolinha dourada, VoltageBar dourada no limite de alunos.
  5. Tela de vincular aluno, e-mail inexistente — mensagem acionável + botão "Copiar convite para
     compartilhar", com feedback "Convite copiado!" após o clique real.
  6. Dashboard do Nutricionista — header com borda/bolinha violeta, VoltageBar violeta no limite de alunos.
  7. Teaser de Evolução populado (2 dias distintos de carga simulados) — "Abdominal Supra no Solo: +22.2%
     na última sessão", batendo exatamente com (55-45)/45×100 = 22.2%.
  ```
  ```
  Frontend — > npm run build (final)

  ✓ Compiled successfully in 4.3s
    Running TypeScript ...
    Finished TypeScript in 5.4s ...

  Route (app)
  ┌ ○ /
  ├ ○ /_not-found
  ├ ○ /anamnese
  ├ ○ /dashboard
  ├ ƒ /dieta/[id]
  ├ ○ /duvidas
  ├ ƒ /duvidas/[id]
  ├ ○ /evolucao
  ├ ○ /login
  ├ ○ /nutricionista/alunos/novo
  ├ ○ /nutricionista/dashboard
  ├ ƒ /nutricionista/planos/[id]
  ├ ○ /nutricionista/planos/novo
  ├ ƒ /personal/alunos/[alunoId]/anamnese
  ├ ○ /personal/alunos/novo
  ├ ○ /personal/dashboard
  ├ ○ /personal/duvidas
  ├ ƒ /personal/duvidas/[id]
  ├ ƒ /personal/treinos/[id]
  ├ ○ /personal/treinos/novo
  ├ ○ /register
  ├ ○ /treinos
  └ ƒ /treinos/[id]
  ```
- **Pendências conhecidas:** (1) O acento por papel (Item 2) só aparece na `VoltageBar` e na borda/bolinha do header — botões, links e outros elementos permanecem no dourado/ciano padrão de sempre, por decisão explícita de não repintar a interface inteira; se o fundador quiser um acento mais presente no futuro, dá pra estender o mesmo padrão (`role` prop + `--voltage-accent`-like var) a outros componentes. (2) O teaser de Evolução (Item 4) sempre olha o primeiro exercício com séries registradas, não necessariamente o mais relevante/recente — mesma simplificação já aceita em outros lugares do dashboard; se o aluno tiver muitos exercícios distintos, o teaser pode não mostrar o que ele mais quer ver. (3) O texto do convite copiável (Item 3) é fixo em português e não é customizável pelo profissional antes de copiar — atende ao pedido do prompt (texto pronto), mas não permite personalização. (4) O fix do `DATABASE_URL` (127.0.0.1 vs localhost) resolve o sintoma neste ambiente específico; a causa raiz (por que a engine do Prisma resolve "localhost" de um jeito que trava, diferente de conexões TCP puras do Node) não foi investigada a fundo — não era o escopo desta fase, só um bloqueio real para conseguir validar o resto.

## Progresso Geral das Fases
- [x] Fase 1: Fundação Core, Auth e Estrutura Modular
- [x] Fase 2: Vínculo Personal↔Aluno e Limite Freemium
- [x] Fase 3: Catálogo de Exercícios (AI Seeder) e Prescrição de Treinos
- [x] Fase 4: Execução do Treino e Registro de Carga
- [x] Fase 5: Frontend Web Mobile-First
- [x] Fase 5.5: Hardening Pré-Produção (cookie httpOnly, config de ambiente, script de dev)
- [x] Fase 6: Painel do Personal Trainer (UI)
- [x] Fase 7: Suíte de Testes Automatizados de Frontend
- [x] Fase 8: Evolução (Histórico de Carga e Frequência)
- [x] Fase 9: Consolidação (Polish + Stub de Billing + Preparação Mobile)
- [x] Fase 10: Anamnese + Dúvidas + Notificações
- [x] Fase 11: Módulo de Nutrição & Multi-Profissional
- [x] Fase 12: Polish Visual & Usabilidade
