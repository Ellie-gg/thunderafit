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

## Progresso Geral das Fases
- [x] Fase 1: Fundação Core, Auth e Estrutura Modular
- [x] Fase 2: Vínculo Personal↔Aluno e Limite Freemium
- [x] Fase 3: Catálogo de Exercícios (AI Seeder) e Prescrição de Treinos
- [x] Fase 4: Execução do Treino e Registro de Carga
- [x] Fase 5: Frontend Web Mobile-First
