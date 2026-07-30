/**
 * Perf (Grupo Y, item 99) — fragmentos de response schema compartilhados
 * entre `GET /api/workout-programs/:id` e `GET /api/workouts/:id`. Mapeados
 * campo a campo contra o que `workout-programs.repository.ts#
 * findProgramWithSessions` e `workouts.repository.ts#findByIdWithExercises`
 * realmente selecionam (nenhum `select` no topo → todos os escalares do
 * model) + o que os services acrescentam depois (traduções, `suggestedNext`)
 * — um response schema do Fastify funciona como ALLOWLIST de serialização,
 * então um campo esquecido aqui some da resposta em silêncio.
 *
 * Não reaproveita `exerciseItemSchema` de `exercises.routes.ts`: aquele é o
 * `select` mais estreito do catálogo (sem `youtubeSupplementUrl`/
 * `createdAt`/`updatedAt`); aqui o exercício vem de um `include: { exercise:
 * true }` sem `select`, trazendo o model inteiro.
 */

const setLogSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    workoutExerciseId: { type: "string" },
    setNumber: { type: "integer" },
    repsDone: { type: "integer" },
    weightKg: { type: "number" },
    loggedAt: { type: "string" },
  },
};

const exerciseFullSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    muscleGroup: { type: "string" },
    equipment: { type: "string" },
    mediaUrl: { type: ["string", "null"] },
    youtubeSupplementUrl: { type: ["string", "null"] },
    mediaType: { type: "string", enum: ["YOUTUBE", "VIDEO", "GIF"] },
    description: { type: "string" },
    difficultyLevel: { type: "string", enum: ["INICIANTE", "INTERMEDIARIO", "AVANCADO"] },
    isFeatured: { type: "boolean" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const workoutExerciseSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    workoutId: { type: "string" },
    exerciseId: { type: "string" },
    sets: { type: "integer" },
    repsRange: { type: "string" },
    restSeconds: { type: "integer" },
    order: { type: "integer" },
    notes: { type: ["string", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    exercise: exerciseFullSchema,
    setLogs: { type: "array", items: setLogSchema },
  },
};

// Escalares de uma sessão (`Workout`) — a mesma linha de banco aparece em 2
// formatos distintos: dentro de `program.workouts[]` (+ `suggestedNext`, sem
// `program`) e como o próprio topo de `GET /api/workouts/:id` (+ `program`
// resumido, sem `suggestedNext`) — nunca os dois campos juntos.
const sessionBaseProperties = {
  id: { type: "string" },
  programId: { type: "string" },
  personalId: { type: ["string", "null"] },
  alunoId: { type: ["string", "null"] },
  name: { type: "string" },
  letter: { type: "string" },
  lastCompletedAt: { type: ["string", "null"] },
  createdAt: { type: "string" },
  updatedAt: { type: "string" },
  exercises: { type: "array", items: workoutExerciseSchema },
};

// `program.workouts[]` — usado só dentro de `workoutProgramDetailSchema`.
const workoutSessionInProgramSchema = {
  type: "object",
  properties: {
    ...sessionBaseProperties,
    // Service-computed (workout-programs.service.ts#getProgram) — nunca vem
    // do Prisma, sempre presente (boolean) em toda sessão retornada.
    suggestedNext: { type: "boolean" },
  },
};

// Topo de `GET /api/workouts/:id` — mesmos escalares de sessão + o `program`
// resumido (`select: {origin, sessionScheme}` em `findByIdWithExercises`,
// nunca o WorkoutProgram inteiro).
export const workoutDetailSchema = {
  type: "object",
  properties: {
    ...sessionBaseProperties,
    program: {
      type: "object",
      properties: {
        origin: { type: "string", enum: ["PERSONAL", "SELF", "PERSONAL_CATALOG"] },
        sessionScheme: { type: "string", enum: ["LETTER", "WEEKDAY"] },
      },
    },
  },
};

// Topo de `GET /api/workout-programs/:id`.
export const workoutProgramDetailSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    personalId: { type: ["string", "null"] },
    origin: { type: "string", enum: ["PERSONAL", "SELF", "PERSONAL_CATALOG"] },
    name: { type: "string" },
    isTemplate: { type: "boolean" },
    alunoId: { type: ["string", "null"] },
    sessionScheme: { type: "string", enum: ["LETTER", "WEEKDAY"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    category: { type: "string", enum: ["GERAL", "HOME", "PREMIUM", "PRONTOS"] },
    bannerImageUrl: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    tags: {
      type: "array",
      items: {
        type: "string",
        enum: ["FEMININO", "HIPERTROFIA", "DEFINICAO", "EXPRESS", "INICIANTE", "INTERMEDIARIO", "AVANCADO"],
      },
    },
    workouts: { type: "array", items: workoutSessionInProgramSchema },
  },
};
