# Auth Domain

## Purpose

Owns account creation, credential verification, JWT issuance/rotation, and the
authenticate middleware used by every other domain. Also owns a few
self-service "my account" endpoints that don't belong to any other domain:
avatar upload and explicit locale choice. Does NOT own role changes/promotion,
admin bootstrap, or password reset — those live in `src/admin`.

## Main entities (Prisma)

- `User` — the only model this domain writes to directly.
  - `passwordHash` — bcrypt, 12 salt rounds. Never returned by any handler.
  - `refreshTokenHash` — bcrypt hash of the *current* refresh token, or
    `null` (logged out / never logged in / invalidated). Never the raw
    token.
  - `role` — `Role` enum: `PERSONAL | ALUNO | NUTRICIONISTA | ADMIN`. Set at
    creation, immutable from this domain (see Key rules).
  - `name` — nullable `String`. Required by the real signup form but not by
    the API itself (see Key rules).
  - `avatarUrl` — nullable `String` holding a full `data:image/...;base64,...`
    URI (no file storage/bucket), capped at ~140KB.
  - `locale` — nullable `Locale` enum (`PT | EN | ES`). `null` = "never
    chose, frontend auto-detects" — distinct from any real value.
  - `lastLoginAt` — updated on every successful login.
  - `planoAssinatura`/`limiteAlunos` — set to `FREE`/`3` defaults at
    registration; this domain never changes them afterward (billing does).
- `LoginLog` — append-only row per *successful* login (`userId`,
  `ipAddress`, `createdAt`). Failed attempts never reach the DB, only the
  in-memory rate limiter.

## Key rules / authorization

- **Register only allows self-serve roles**: the controller whitelists
  `PERSONAL | ALUNO | NUTRICIONISTA` for `role` in the request body.
  `ADMIN` accounts cannot be created through `/api/auth/register` — they are
  provisioned directly against the DB (or promoted via `src/admin`, which is
  a separate domain, separately audited). `authService.register()` itself
  does **not** re-validate `role` — the enforcement point is the controller
  only.
- `name` is required by the real signup form (frontend) but optional at the
  API layer on purpose — many existing tests/fixtures call `/register`
  without it. Don't tighten this to a 400 without checking test fixtures
  across the whole test suite first.
- Avatar and locale updates are self-only: both handlers take the user id
  from `request.user.sub` (the authenticated token), never from the body —
  there's no "update someone else's avatar" path here, by any role.
- `checkEmailExists` (`/api/auth/check-email`) returns **only** `{ exists }`,
  never the user record, role, or id — it's a public, unauthenticated
  endpoint used by the unified signup/login flow, keep it that way to avoid
  turning it into an account-enumeration/info-leak endpoint.

## Handle with care

- **Cookie beats header, on purpose.** `authenticate` middleware picks
  `cookies.access_token` before `Authorization: Bearer`. This is required
  because in production the frontend's proxy injects its own
  `Authorization: Bearer <Google ID token>` on every request; if the header
  won the auth check would always fail. Don't "fix" the precedence without
  re-reading the comment in `middlewares/authenticate.ts`.
- **Refresh token reuse detection.** If the presented refresh token doesn't
  match the stored hash, `refresh()` treats it as possible theft and wipes
  `refreshTokenHash` (forces re-login for that user), rather than just
  rejecting the single request. Don't relax this to a plain rejection.
- Refresh tokens are rotated on every `/api/auth/refresh` call (new
  access+refresh pair, new stored hash) — callers must swap both tokens on
  refresh, the old refresh token stops working immediately.
- Never return `passwordHash` or `refreshTokenHash` from any service
  function — every mutator manually strips both before returning `safeUser`.
  Follow the same pattern if you add a new field-update function.
- Avatar validation (size cap + `data:image/(png|jpeg|jpg|webp);base64,...`
  regex) happens server-side deliberately, not just client-side — the
  comment in `auth.service.ts` explains why (client-side resize can't be
  trusted). Keep both checks if you touch this function.
- Login rate limiting is in-memory (`Map`, keyed by `IP + email`, 5
  consecutive failures -> 15 min block, resets on success), not
  `@fastify/rate-limit`/Redis — state is lost on process restart, and is
  shared with `/api/auth/check-email` (same limiter, same key scheme, so it
  resets/blocks together with login attempts for that IP+email pair).
- `checkEmailHandler` calls `recordFailedAttempt` unconditionally on every
  call (even when the email exists) — it's using the login limiter purely as
  a call-throttle, not a failure counter; don't assume a "success" concept
  applies there.
- JWT secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`) are required env vars —
  `getEnv()` throws immediately if missing, no silent fallback.

## Current state

Live endpoints (all under `/api/auth`):
- `POST /register` — public, creates `PERSONAL|ALUNO|NUTRICIONISTA`.
- `POST /login` — public, rate-limited, sets httpOnly cookies + returns
  tokens in body (for non-browser clients).
- `POST /check-email` — public, rate-limited, `{ exists }` only.
- `POST /refresh` — public, reads refresh token from body or cookie, rotates
  tokens.
- `POST /logout` — authenticated, invalidates stored refresh token hash and
  clears cookies.
- `PUT /me/avatar` — authenticated, any role, set/clear avatar.
- `PUT /me/locale` — authenticated, any role, set/clear explicit locale.
- `GET /protected` — authenticated smoke-test route for the middleware.

On successful `ALUNO` login, this domain triggers
`relationsService.checkAndFireDueReminders` (payment reminder check) — a
cross-domain call into `fitness`; not this domain's data, just the trigger
point.
