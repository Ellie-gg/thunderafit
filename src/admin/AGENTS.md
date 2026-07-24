# Admin Domain (`/nimbus`)

## Purpose

Backend for the internal admin panel (frontend route `/nimbus`, not user-facing).
Gives an ADMIN a cross-tenant, cross-domain view of the whole platform: business
overview metrics, user list/role management, login history, support SLA
tracking, audit/access logs, the exercise catalog CRUD (including media
upload), and curation of "SELF" workout templates (the library students can
copy into "Meu treino pessoal" without a Personal involved).

This is the only domain in the codebase whose read scope is intentionally
platform-wide instead of scoped to the caller's own data/relations.

## Main entities

Owned by this domain (`prisma/schema.prisma`):
- `AdminAccessLog` — audit trail of an ADMIN reading a specific student's
  health data (today: anamnesis only). Written by *other* domains (see below),
  read here via `GET /api/admin/access-logs`.
- `AdminAuditLog` — generic audit trail of sensitive admin *write* actions.
  Today the only action logged is `ROLE_CHANGE`, with `details` as a plain
  string summary (e.g. `"PERSONAL -> ADMIN"`).

Read/written but owned by other domains:
- `User` (auth domain) — list/paginate all users, read `lastLoginAt`,
  `limiteAlunos`, `planoAssinatura`, and write `role`.
- `LoginLog` (auth domain) — recent logins across all users, joined in
  memory to `User.email` (no DB relation between the two tables).
- `ClientRelation` (relations domain) — used to compute freemium-limit stats
  and to flag orphan `ALUNO`s (no Personal/Nutricionista link at all).
- `SupportThread` (support domain) — open threads oldest-first, for the SLA
  view (`hoursOpen`).
- `Exercise` / `WorkoutExercise` (fitness domain) — full catalog CRUD, media
  upload, and a usage-count check before allowing delete.
- `WorkoutProgram` / `Workout` (fitness domain) — SELF-origin templates only
  (`origin: "SELF"`, `personalId: null`); queried directly via `prisma` here
  rather than through the fitness repository, to keep the domains decoupled
  (same pattern used throughout this repository).

Reverse dependency: `src/anamnesis/services/anamnesis.service.ts` imports
`adminRepository` directly to call `createAccessLog` whenever an ADMIN reads a
student's anamnesis — this is the one place outside this domain that writes
into an admin-owned table.

## Key rules / authorization

- **Every handler in `admin.controller.ts` starts with `assertAdmin(request)`**,
  which throws a 403 if `request.user.role !== "ADMIN"`. There is no partial
  access — PERSONAL and NUTRICIONISTA get the same 403 as ALUNO. Verified by
  `__tests__/admin.test.ts` (`it.each` over every `/api/admin/*` path with both
  PERSONAL and ALUNO tokens).
- Role edits (`PUT /api/admin/users/:id/role`) have extra guards on top of the
  role check, in `admin.service.ts#updateUserRole`:
  - Rejects an unknown `role` value (400) — validated against the real enum,
    never trusted as-is.
  - An admin cannot change their **own** role (400) — avoids losing panel
    access with no one able to revert it via UI.
  - Cannot demote the **last remaining ADMIN** in the system (400), counted
    fresh from the DB (`countUsersWithRole("ADMIN")`), independent of who is
    making the request.
  - A successful change always writes an `AdminAuditLog` row
    (`ROLE_CHANGE`, `"<old> -> <new>"`) before returning.
- Exercise delete is blocked (409) if any `WorkoutExercise` references it —
  never cascades, to avoid silently destroying real students' prescriptions.
- Exercise media upload never trusts the client's declared `mediaType`: each
  branch (`YOUTUBE`/`VIDEO`/`GIF`) re-validates the actual payload format
  (regex on the data URL) before accepting it, and checks the exercise exists
  before spending time/bandwidth uploading to the bucket.
- SELF templates (`origin: "SELF"`) are the only workout programs a student
  can apply without a Personal relationship; the aluno only *copies*, never
  edits — enforced by other domains, not this one, but this is where they are
  authored.

## Handle with care

- This is the highest-privilege backend surface in the repo — it can read
  every user's data and every student's data with **no `ClientRelation` check
  at all** (by design: an ADMIN doesn't need to be linked to a student).
  Any new endpoint added here inherits that same wide-open read scope, so
  double-check it actually needs to.
- `AdminAccessLog` exists specifically to audit ADMIN reads of health data. If
  you add a new admin-facing endpoint that surfaces PII/health data (not just
  aggregate metrics), write a `createAccessLog` entry the same way
  `anamnesis.service.ts#getForAdmin` does — do not assume it's covered by
  something else.
- `listRecentLogins`/`recentAccessLogs`/`recentAuditLogs` resolve
  user emails by a separate lookup (no FK/relation declared between those log
  tables and `User`) — a removed user shows as `"(usuário removido)"` for
  logins; access/audit logs currently do not enrich emails at all. Don't
  assume the log rows are always joinable to a live user.
- `updateUserRole`'s "last admin" check counts live DB rows, but auth is
  stateless (JWT carries the role at login time) — a demoted admin's existing
  token stays valid with the old role until it expires/refreshes. This is a
  known tradeoff, not a bug to silently "fix" without checking with the team.
- The bigger `bodyLimit: 8_000_000` override on the exercise-media route is
  scoped to that one route only — don't reuse the pattern globally without
  reason, it exists purely because base64 video/GIF payloads exceed Fastify's
  1MB default.

## Current state

All routes are mounted under `/api/admin/*` and require authentication
(`fastify.authenticate`) plus the `assertAdmin` role check inside each
handler (route-level `preHandler` only checks the JWT is valid, not the
role). Covered by `__tests__/admin.test.ts` (overview/users/logins/SLA/
access-logs + cross-domain "wide view" cases for relations/workouts/support/
anamnesis), `admin-user-role.test.ts` (role-edit guards), and dedicated
suites for exercise CRUD, exercise media upload, and SELF template curation.
