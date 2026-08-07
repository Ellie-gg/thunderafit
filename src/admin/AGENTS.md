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
  Four actions are logged today: `ROLE_CHANGE` (`admin.repository.ts`), plus
  `USER_DELETE`, `PREMIUM_TOGGLE` and `EMAIL_VERIFIED_BY_ADMIN`
  (`admin.service.ts`). `details` is a plain string summary (e.g.
  `"PERSONAL -> ADMIN"`). This doc claimed `ROLE_CHANGE` was the ONLY one
  until the 2026-08-06 audit — filtering the trail on that assumption
  silently drops 3 of the 4 sensitive-action types.

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
- `WorkoutProgram` / `Workout` (fitness domain) — SELF-origin templates
  (`origin: "SELF"`, `personalId: null`) **and**, since Fase 62,
  PERSONAL_CATALOG-origin templates (`origin: "PERSONAL_CATALOG"`, "Templates
  Básico" — the free template library offered to every Personal, curated by
  the same `/api/admin/self-templates/*` routes via an `origin` param on
  create/list, default `SELF`); queried directly via `prisma` here rather
  than through the fitness repository, to keep the domains decoupled (same
  pattern used throughout this repository). "Templates Premium" for the
  Personal is NOT curated here — it reuses the existing SELF/PREMIUM
  templates as-is (same underlying rows sold to students as "Aluno
  Premium").

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
- **Fase 84 — `youtubeSupplementUrl`**: a supplementary YouTube link shown as
  a small badge over an exercise's own VIDEO/GIF media (never shown when
  `mediaType` is YOUTUBE — that case's `mediaUrl` already IS the YouTube
  link). `updateExerciseMedia` supports 2 things it didn't before:
  - **Updating VIDEO/GIF without a new file** — `mediaDataUrl` is now
    optional when the exercise already IS that same media type (e.g. admin
    only wants to add/edit the supplement link on an existing video). Still
    required the FIRST time an exercise switches to VIDEO/GIF (`mediaUrl`
    can't stay null). `adminRepository.updateExerciseMedia` takes a partial
    `data` object now (was 2 positional args) — `undefined` fields are
    left untouched by Prisma, `null` clears explicitly.
  - **Auto-carrying the old YouTube link forward**: if `youtubeSupplementUrl`
    is absent from the request body (not sent, vs. sent as `""`) AND the
    exercise's PREVIOUS `mediaType` was YOUTUBE, the old `mediaUrl` is
    reused as the new supplement automatically — the admin frontend also
    pre-fills this same value into the form field the moment YOUTUBE gets
    switched to VIDEO/GIF, so in practice this backend fallback is a safety
    net for non-UI callers, not load-bearing for the real form. Switching
    TO YOUTUBE always clears `youtubeSupplementUrl` (never valid in that
    state) regardless of what the client sends.
- SELF templates (`origin: "SELF"`) are the only workout programs a student
  can apply without a Personal relationship; the aluno only *copies*, never
  edits — enforced by other domains, not this one, but this is where they are
  authored.
- **Fase 80 — `DELETE /api/admin/users/:id`** (permanent user removal), same
  2 guards as `updateUserRole` (can't remove yourself; can't remove the last
  ADMIN), then a manual cascade in `adminRepository.deleteUser` — see the
  long comment right above that function for the full rationale. Short
  version: **no table in this schema has a real DB-level FK to `User`**
  (every `userId`/`alunoId`/`personalId`-style column is a bare `String`,
  no `@relation` declared), so deleting a `User` row alone would never
  throw an FK-violation — but it WOULD leave orphaned rows in ~10 tables if
  nothing else were done. The cascade deletes data that only makes sense
  WITH this user (Anamnesis, Notification, LoginLog, ContactMessage, any
  2-sided relation where this user is either side — ClientRelation,
  ConnectionRequest/Message, SupportThread/Message, DietPlan), but for a
  `WorkoutProgram`/`Workout` this user created as `personalId` FOR A
  DIFFERENT SURVIVING ALUNO, it only nulls out `personalId` — deleting the
  Personal must never destroy an unrelated aluno's real workout history.
  `AdminAccessLog`/`AdminAuditLog` are deliberately NEVER touched (audit
  trail survives the deleted actor/target on purpose).

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
- `deleteUser`'s cascade runs inside a single `$transaction` with a raised
  20s timeout (default is 5s) — a Personal with many alunos/programs can
  have a lot to touch. If you add a NEW table with a `userId`-style column
  in the future, you must add it to this cascade by hand — nothing enforces
  this automatically (no FK means no DB-level safety net either way).

## Current state

All routes are mounted under `/api/admin/*` and require authentication
(`fastify.authenticate`) plus the `assertAdmin` role check inside each
handler (route-level `preHandler` only checks the JWT is valid, not the
role). Covered by `__tests__/admin.test.ts` (overview/users/logins/SLA/
access-logs + cross-domain "wide view" cases for relations/workouts/support/
anamnesis), `admin-user-role.test.ts` (role-edit guards), `admin-delete-user.test.ts`
(guards + cascade correctness, incl. the "Personal removed, aluno's program
survives with personalId nulled" case), and dedicated suites for exercise
CRUD, exercise media upload, and SELF template curation.
- Fase 80: `GET /api/admin/users` also returns `name`/`avatarUrl` now (was
  email-only before) — the frontend user list shows a `UserAvatar` + name
  (falling back to email when `name` is null), same component the app
  header already uses.
