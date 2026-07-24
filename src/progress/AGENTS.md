# progress domain

## Purpose

Read-only aggregation views over a student's (`aluno`) training history: load
progression per exercise, monthly workout frequency, which exercises have
logged sets, and a weekly dashboard summary (active days, volume, streak).
No writes happen in this domain — it only queries and reshapes data owned by
`fitness`.

## Main entities / data it reads

This domain **owns no Prisma models**. `prisma/schema.prisma` documents it
explicitly: "domain: progress — Agregação sobre SetLog, sem tabela própria."

It reads, via its own repository (`progress.repository.ts`), models owned by
**`src/fitness`**:
- `SetLog` — the core signal for every endpoint (weight, reps, `loggedAt`).
- `WorkoutExercise` / `Workout` — joined to scope logs to `alunoId` and to
  resolve `workoutId` / prescribed exercises.
- `Exercise` — joined for name/muscle group when listing logged exercises.
- `ClientRelation` — read directly (not via `fitness`'s repository) purely to
  check a PERSONAL/NUTRICIONISTA↔aluno bond; see below.

The repository deliberately queries Prisma directly instead of importing
`src/fitness`'s repository, to keep domains decoupled (see comment in
`progress.repository.ts`).

## Key rules / authorization

`assertAluno()` in `progress.controller.ts` resolves whose progress is being
requested, per role, and is shared by all four handlers:
- **ADMIN**: must pass `?alunoId=` explicitly (400 if missing); no bond check.
- **PERSONAL / NUTRICIONISTA**: must pass `?alunoId=`; then a `ClientRelation`
  lookup is required (403 if not bonded to that aluno — this is the IDOR
  guard, added after ADMIN's unchecked path already existed, so treat the
  ordering of these `if` branches as load-bearing, not incidental).
- **ALUNO**: any `alunoId` query param is ignored; always resolves to
  `user.sub` (a student can never view another student's progress).
- Any other role is rejected with 403.

The 403 message text for "not bonded" intentionally matches the equivalent
check in `src/anamnesis` — kept in sync for consistent error UX across the
two domains that both gate professional access via `ClientRelation`.

## Handle with care

- **Streak calculation is duplicated on purpose, not by accident.**
  `getWeeklySummary`'s streak logic (count backwards from today; if today has
  no log yet, start from yesterday instead of zeroing out) is intentionally
  re-implemented in `src/fitness/services/workout-summary.service.ts`
  (`computeStreakDays`, used for the post-workout completion summary). Both
  sides carry comments cross-referencing the other file. **If you change the
  streak semantics here, update `workout-summary.service.ts` too** (or vice
  versa) — there is no shared helper.
- **Day-boundary logic is UTC-based**: `dayKey`/`monthKey` use
  `toISOString().slice(...)`, so "today" and day grouping follow UTC, not the
  student's local timezone. This affects streaks, load-history grouping, and
  the weekly `days` array.
- `getLoadHistory` aggregates to **one point per UTC day** (max weight of
  that day), not per session — a documented, deliberate readability choice
  for the progress chart. Don't "fix" this into per-session granularity
  without checking the frontend chart expectations.
- `getFrequency`'s `totalWorkouts` counts distinct workouts across the whole
  period, not the sum of the monthly `workoutCount` column — a workout could
  theoretically have sets logged in different months. Do not "simplify" it
  into a sum.
- `getWeeklySummary` uses **two different windows on purpose**: a 90-day
  lookback to compute the streak correctly, but only the last 7 days for
  `volumeKg` / `setsThisWeek`. Don't collapse them to one window.
- `volumeKg` remains in the `weekly-summary` payload even though the
  dashboard UI switched to displaying `setsThisWeek` instead (Fase 39) —
  it's kept for contract stability, not because it's still rendered.

## Current state

Implemented (Fase 8, extended through Fase 33.4/39): 4 endpoints, all under
`/api/progress`, all `GET`, all authenticated — `load-history`, `frequency`,
`exercises` (logged-exercise list), `weekly-summary`. No mutation endpoints
exist in this domain. Tests in `__tests__/progress.test.ts` cover day-level
aggregation, percent-change math, per-role authorization (including the
PERSONAL-not-bonded 403 and ADMIN-missing-alunoId 400 cases), empty-history
students, and the streak "today not yet logged" edge case.
