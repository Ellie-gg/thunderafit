# src/nutrition — Nutrition domain

DORMANT — this domain is fully implemented in the backend but has no UI entry
point in the current frontend. Do not add new features here unless explicitly
asked; it is kept at zero maintenance cost per house convention (see
MASTER_SPEC.md).

## Purpose

If reactivated, lets a `NUTRICIONISTA` (a professional role, alongside
`PERSONAL`) build a diet plan for a linked `ALUNO`: one active plan per
student, organized into daily meals, each meal a list of foods with quantity
(a multiplier of the food's base portion). Macros (protein/carbs/fat/kcal)
are computed backend-side per food, per meal, and totaled for the plan.

## Main entities (`prisma/schema.prisma`)

- `Food` — global catalog (name, portion description, macros per portion).
- `DietPlan` — one per nutricionista↔aluno pairing; `isActive` (creating a
  new plan deactivates prior ones for that aluno).
- `DietMeal` — meals within a plan (name, time, order).
- `DietFood` — a food + quantity within a meal.

Linking reuses `ClientRelation` (same table as Personal↔Aluno) with
`professionalType === "NUTRICIONISTA"`.

## Current state

- Backend: `routes/`, `controllers/`, `services/`, `repository/` are complete
  and wired into the Fastify app (`GET/POST /api/diet-plans`, nested meals
  and foods, `GET /api/foods`).
- Frontend: pages under `frontend/app/nutricionista/**` and
  `frontend/app/dieta/[id]` still exist in the repo but have no navigation
  entry point — `register` no longer offers the `NUTRICIONISTA` role, and
  `NUTRICIONISTA` is not a selectable value in the current sign-up UI (see
  `frontend/lib/roles.ts`, "Fase 18: NUTRICIONISTA foi REMOVIDO da UI"). Only
  a support-thread link (`/nutricionista/duvidas`) remains reachable for any
  legacy user still holding that role.
- Reversal note: reactivating means restoring the entry point (role option
  at registration + nav links), not writing new backend code.
