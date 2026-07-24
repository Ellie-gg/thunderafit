# ThunderaFit — Agent Guide

ThunderaFit is a B2B2C fitness-coaching SaaS: personal trainers (`PERSONAL`) and
nutritionists (`NUTRICIONISTA`) manage students (`ALUNO`) — workout prescription,
execution logging, progress tracking, health intake, support Q&A, and Stripe billing.
An `ADMIN` role runs an internal panel (frontend route `/nimbus`).

This file is the entry point for an AI agent working in this repo. Keep it short —
it indexes context, it doesn't contain it. Deeper product/architecture rationale
lives in `MASTER_SPEC.md`; historical phase-by-phase changelog lives in `STATUS.md`.
Don't duplicate either here.

## Stack (exact versions — do not assume newer/older APIs)

| | Backend (repo root) | Frontend (`frontend/`) |
|---|---|---|
| Runtime | Node `25.x` | Node `25.x` |
| Framework | Fastify `^4.29.0` | Next.js `16.2.10` (pinned exact — see below) |
| ORM/DB | Prisma `^5.22.0` / PostgreSQL | — |
| Language | TypeScript `^5.6.3` | TypeScript `^5` |
| UI | — | React `19.2.4` |
| Tests | Jest `^29.7.0` (ts-jest) | Jest + Testing Library, Playwright |
| i18n | `Locale` enum (PT/EN/ES) on `User` | `next-intl`, cookie-based locale (no URL prefix) |
| Payments | Stripe (see `src/billing/`) | — |

**Next.js 16 has breaking changes vs. most training data.** Before writing any
frontend code, read `frontend/AGENTS.md` (already exists, short) and the relevant
guide under `frontend/node_modules/next/dist/docs/`.

## Commands

Backend (repo root):
- `npm run dev` — dev server (`ts-node-dev`, auto-restart)
- `npm run build` / `npm start` — compile to `dist/` / run compiled output
- `npm test` — **the only supported way to run the suite.** Already configured as
  `jest --runInBand --forceExit` — parallel Jest workers race on the same Postgres
  connection and produce flaky failures; do not invoke `npx jest` directly without
  those flags.
- `npm run db:up` — start local Postgres (`docker-compose up -d`)
- `npm run db:migrate` — dev migration (`prisma migrate dev`); `db:migrate:deploy` for
  production/CI (`prisma migrate deploy`, no prompts)
- `npm run db:seed`, `db:seed:admin`, `db:grant-plan` — seed scripts

Frontend (`frontend/`):
- `npm run dev` — dev server on port 3001
- `npm run build` / `npm start`
- `npm run lint` — ESLint
- `npm test` / `npm run test:watch` — Jest/RTL
- `npm run test:e2e` — Playwright

## Backend conventions

**Domain-first structure.** Each domain under `src/<domain>/` has the same five
folders: `routes/ → controllers/ → services/ → repository/`, plus `__tests__/`.
Routes wire HTTP to controllers; controllers parse/validate the request and call a
service; all business logic and authorization checks live in `services/`;
`repository/` is Prisma-only (no business logic). Follow this shape for new code.

`src/lib/` is flat shared utilities (`prisma.ts`, `locale.ts`, `storage.ts`) — not a
domain, no `AGENTS.md` of its own.

`prisma/schema.prisma` is sectioned with `// --- domain: <name> ---` comments —
find a domain's models there before assuming a shape.

**Naming**: files/folders `kebab-case.ts`; a domain's public service object is
`<domain>Service` (e.g. `authService`), repository is `<domain>Repository`. Tests
mirror the file they cover (`workouts.service.ts` → `__tests__/workouts.test.ts`).

**Roles** (`Role` enum on `User`): `PERSONAL`, `ALUNO`, `NUTRICIONISTA`, `ADMIN`.
Authorization is service-layer, not middleware-layer — expect explicit role/ownership
checks inside each service function, not a generic guard.

## Domain index

| Domain | Owns (Prisma models) | See |
|---|---|---|
| `auth` | `User`, `LoginLog` | [src/auth/AGENTS.md](src/auth/AGENTS.md) |
| `fitness` | `Exercise`(+Translation), `WorkoutProgram`, `Workout`, `WorkoutExercise`, `SetLog`, `ClientRelation` | [src/fitness/AGENTS.md](src/fitness/AGENTS.md) |
| `connections` | `ConnectionRequest` | [src/connections/AGENTS.md](src/connections/AGENTS.md) |
| `billing` | *(none — state lives on `User`)* | [src/billing/AGENTS.md](src/billing/AGENTS.md), `src/billing/BILLING_SETUP.md` |
| `progress` | *(none — aggregates `fitness` data)* | [src/progress/AGENTS.md](src/progress/AGENTS.md) |
| `anamnesis` | `Anamnesis` | [src/anamnesis/AGENTS.md](src/anamnesis/AGENTS.md) |
| `support` | `SupportThread`, `SupportMessage` | [src/support/AGENTS.md](src/support/AGENTS.md) |
| `notifications` | `Notification` | [src/notifications/AGENTS.md](src/notifications/AGENTS.md) |
| `admin` | `AdminAccessLog`, `AdminAuditLog` (+ reads across domains) | [src/admin/AGENTS.md](src/admin/AGENTS.md) |
| `nutrition` | `Food`, `DietPlan`, `DietMeal`, `DietFood` — **dormant, no frontend UI** | [src/nutrition/AGENTS.md](src/nutrition/AGENTS.md) |

Cross-domain relationships (who calls/depends on whom): see
[`docs/architecture.mermaid`](docs/architecture.mermaid).

Frontend structure/conventions: [frontend/AGENTS.md](frontend/AGENTS.md).

## Where NOT to look here

- Product vision, roadmap, monetization strategy, architectural decisions and their
  rationale → `MASTER_SPEC.md`.
- What changed, when, and why (phase-by-phase history) → `STATUS.md`.
- Deploy/infra (Cloud Run, Cloud Build triggers, Terraform) → `infra/README.md`,
  `infra/RUNBOOK.md`.
