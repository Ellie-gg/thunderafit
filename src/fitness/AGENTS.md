# fitness domain

## 1. Purpose

- **Exercise catalog** — canonical exercise data (PT source of truth) plus EN/ES translations, listed via `GET /api/exercises`.
- **Workout programs & sessions** — `WorkoutProgram` (template or applied instance) grouping 1–7 `Workout` sessions, each with prescribed `WorkoutExercise` rows.
- **Set logging** — students log sets (`SetLog`) per prescribed exercise during execution.
- **Student–trainer relations** — `ClientRelation` linking a PERSONAL/NUTRICIONISTA to an ALUNO, with Freemium seat limits and payment reminders.
- **Workout generator ("Montagem Inteligente")** — deterministic rule engine that drafts exercises for a session; persists nothing.
- **Post-workout summary** — volume comparison, personal records (PRs) and streak, computed when a session is marked complete.

## 2. Main entities

- `Exercise` — canonical PT record (`name`, `muscleGroup`, `description`, `equipment`, `mediaUrl`/`mediaType`, `difficultyLevel`, `isFeatured`). `isFeatured` exercises sort first within their muscle group.
- `ExerciseTranslation` — EN/ES only, unique on `(exerciseId, locale)`, cascade-deletes with the exercise. PT never has a row here.
- `WorkoutProgram` — `origin` (`PERSONAL` | `SELF`) and `isTemplate`/`alunoId` together encode 3 states: Personal template (`alunoId` null), applied instance (`alunoId` set), or admin-curated SELF template (`personalId` null, no Personal involved at all). `sessionScheme` (`LETTER` A–E or `WEEKDAY` Mon–Sun) is fixed at creation and drives session ordering/limits.
- `Workout` — a single session (letter/weekday) inside a program; `personalId`/`alunoId` are its own fields, not inherited from `program` (both nullable for template/SELF cases). `lastCompletedAt` is the *only* completion signal — there is no separate "session log" entity.
- `WorkoutExercise` — a prescribed exercise line (`sets`, `repsRange`, `restSeconds`, `order`, optional `notes` capped at 500 chars in the service layer, not the DB).
- `SetLog` — one logged set (`setNumber`, `repsDone`, `weightKg`, `loggedAt`); `findAllByWorkoutExercise` caps at the 100 most recent rows per exercise (desc-fetch + reverse, same pattern as the nested workout/program reads).
- `ClientRelation` — unique `(personalId, alunoId)`; `professionalType` distinguishes PERSONAL vs NUTRICIONISTA; `paymentReminderDueDate`/`Recurring` drive a login-time notification, no cron.

## 3. Key rules / authorization

Roles: `PERSONAL`, `ALUNO`, `NUTRICIONISTA`, `ADMIN` (`Role` enum).

- Only `PERSONAL` creates/edits `Workout`s and programs with `origin: PERSONAL` (NUTRICIONISTA is deliberately excluded, even though it can hold a `ClientRelation`).
- `PERSONAL` or `NUTRICIONISTA` may create a `ClientRelation`; `professionalType` is always derived from the caller's JWT role, never accepted from the request body.
- Creating a `Workout` or applying/adding-session to a `WorkoutProgram` requires an existing `ClientRelation` between the acting Personal and the target aluno — checked every time, not just at first assignment.
- Program ownership check is `origin === "PERSONAL" && program.personalId === callerId` — checking `personalId` alone would already reject a SELF program (personalId is null), but the explicit `origin` check documents intent and is enforced identically in `apply`, `addSession`, `deleteProgram`.
- Only ADMIN manages `origin: SELF` templates (curated catalog); Personals cannot create, edit, or apply them — students self-apply via `applySelfTemplate`, which only checks role `ALUNO`.
- One applied program per aluno **per Personal** (not global) — `apply()` rejects with 409 if that Personal already has one applied; no auto-replace, the Personal must delete first (which wipes set-log history for that program's workouts).
- Only the owning `ALUNO` can call `completeWorkout` (not the Personal, not ADMIN) — completion is an execution act.
- `ADMIN` never has its own workouts/relations; it gets a "viewing" mode via `?alunoId=`/`?personalId=` query params, never impersonation.
- Session count/label limits are schema-scoped: LETTER caps at 5 (A–E), WEEKDAY caps at 7 (Mon–Sun) — `orderFor(program.sessionScheme)` is the single source of valid keys and max count.

## 4. Handle with care

- **Every `Workout` belongs to a `WorkoutProgram`** (`programId` NOT NULL) — there is no standalone workout anymore; anything creating a `Workout` directly must attach it to a program.
- **`lastCompletedAt` is the only completion boundary.** There's no per-session log entity, so `workout-summary.service.ts` infers "this session's sets" as everything logged between the *previous* `lastCompletedAt` and now, capped by `SESSION_WINDOW_MS` (6h) to avoid pulling in stale pending sets. Capture the *old* `lastCompletedAt` **before** overwriting it in `completeWorkout` — this ordering is load-bearing.
- **PR detection** (`detectPersonalRecord`) compares against history strictly **before** the new set is written — write-after-compare, or a set will beat itself. First-ever log for an exercise is never a PR (no baseline).
- **WEEKDAY suggestion is deterministic-by-day, LETTER is round-robin.** `computeSuggestedSessionId` branches by `sessionScheme`; don't collapse them into one code path (WEEKDAY ignores `lastCompletedAt` entirely and just returns today's session, or `null` if the program has none scheduled for today — it never blocks the aluno from opening another session).
- **Never sort sessions with plain `localeCompare`/alphabetical** — WEEKDAY letters ("SEGUNDA".."DOMINGO") don't sort calendar-correctly alphabetically; always go through `sortByScheme`/`orderFor`.
- **i18n fallback must never throw or return empty fields.** PT reads straight off `Exercise`; EN/ES look up `ExerciseTranslation` and fall back to the PT value already embedded on the object when no translation row exists yet. `/nimbus/exercicios` (admin CRUD) bypasses translation entirely and always edits the canonical PT record.
- **Batch translations, don't loop per session/exercise.** `getProgram` and `getWorkout` flatten all nested exercises across sessions into one `translateNested` call (one `ExerciseTranslation` query total) and redistribute by array position — a naive per-session loop reintroduces the N+1 this was fixed to avoid. Same pattern already fixed in `relations.service.listRelations`/`checkAndFireDueReminders` (batched `user.findMany` instead of per-relation lookups) and `workout-summary.buildPersonalRecords` (batched historical-log query across all exercises in the session).
- **The generator (`workout-generator.service.ts`) persists nothing.** It only returns a draft array; `level` reorders candidates by difficulty preference rather than filtering, because most of the catalog is uncurated `INTERMEDIARIO`. First muscle group in the input array is treated as "primary" (3 exercises), the rest "secondary" (2 exercises) — order of the input, not any stored primary/secondary flag, decides this.
- **Copy, not reference, on template apply.** Applying a `WorkoutProgram` template deep-copies program+sessions+exercises; editing the original template afterward must never retroactively change an aluno's already-applied copy.

## 5. Current state

The catalog holds ~232 exercises, mostly defaulted to `INTERMEDIARIO` difficulty with a small hand-curated `isFeatured` subset per muscle group. `muscleGroup` is a free-text string, not an enum — the admin/generator muscle-group pickers derive their option list live from `DISTINCT muscleGroup` in the DB, so adding/renaming/removing a group is a pure data change, no code/migration needed. Current groups: `Peito`, `Costas`, `Ombro`, `Bíceps`, `Tríceps`, `Abdômen`, `Cardio`, `Alongamento`; (since Fase 50, replacing a single old "Pernas") `Quadríceps`, `Glúteos`, `Posterior da Coxa`, `Panturrilhas`, `Adutores e Abdutores`; and (since Fase 51) `Antebraço`, `Trapézio`, `Flexores do Quadril`. `equipment` is likewise free text; `"Peso Corporal"` (bodyweight) and `"Itens Domésticos"` (needs a household object — chair/towel/backpack/wall/step) mark exercises suitable for a home workout, curated via `prisma/seed-treino-em-casa-e-pernas.ts` and `prisma/seed-antebraco-trapezio-quadril.ts`. EN/ES translations exist as an incremental, possibly-partial overlay (fallback to PT is normal, not an error state) — the Fase 50/51 additions have no translation rows yet, same fallback applies. The workout generator and post-workout summary (volume delta, PR badges, streak) are both live and wired into the normal create/complete flows; the generator's per-muscle-group catalog reads are backed by an in-memory cache (`exercisesRepository`, TTL 5min, invalidated by admin writes), so selecting several groups doesn't cost one DB round-trip each. Student-trainer relations support payment reminders fired at login (no scheduler/cron infra). `SetLog` history is capped at 100 most-recent rows per prescribed exercise in nested workout/program reads and in the standalone list endpoint alike.
