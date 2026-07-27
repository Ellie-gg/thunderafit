# Auth Domain

## Purpose

Owns account creation, credential verification, JWT issuance/rotation, and the
authenticate middleware used by every other domain. Also owns a few
self-service "my account" endpoints that don't belong to any other domain:
avatar upload and explicit locale choice. Does NOT own role changes/promotion,
admin bootstrap, or password reset — those live in `src/admin`.

## Main entities (Prisma)

- `User` — the only model this domain writes to directly.
  - `passwordHash` — bcrypt, 12 salt rounds, **nullable since Fase 77**: an
    account created via Google SSO never has one. `login()` checks for
    `null` first and returns a friendly "use Google instead" error rather
    than calling `bcrypt.compare` against `null`.
  - `googleId` — nullable, `@unique`, Fase 77. The Google `sub` claim
    (stable identity, unlike email). `null` until the first Google
    sign-in — set either at account creation (new Google-only account) or
    linked onto an existing password account the first time it signs in
    via Google.
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
- **Fase 77 — Google SSO auto-links by e-mail, on purpose.** If a Google
  idToken's `email` matches an existing password account, `POST
  /api/auth/google` logs into THAT account (and sets `googleId` on it) —
  no separate confirmation step. This is safe specifically because Google
  itself verified `email_verified` before issuing the token (an unverified
  email is rejected with 401 before any lookup happens) — same trust model
  every major SSO provider uses. Don't extend this same "trust the
  provider's verified email" auto-link logic to a lower-trust identity
  provider without re-evaluating this assumption.
- Google SSO reuses `SELF_SERVICE_ROLES` (`PERSONAL|ALUNO|NUTRICIONISTA`) —
  same restriction as traditional `/register`, `ADMIN` still can't be
  self-created through either path. The frontend's role-picker step
  (`signup-role`) only ever offers `ALUNO`/`PERSONAL` as chips today
  (`SignupRole` type in `frontend/app/login/page.tsx`) — `NUTRICIONISTA` is
  accepted server-side but has no UI entry point via either signup path,
  pre-existing behavior unrelated to Fase 77.

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
  `getEnv()` throws immediately if missing, no silent fallback. Same for
  `GOOGLE_CLIENT_ID` (Fase 77) — required by `loginOrRegisterWithGoogle`,
  same `getEnv()` pattern.
- **`POST /api/auth/google` is a single endpoint serving 2 distinct calls**,
  told apart by whether `role` is present in the body — not 2 routes. 1st
  call (no `role`): verify idToken, login if the account exists, else
  return `{ needsRole: true, email }` WITHOUT creating anything. 2nd call
  (idToken + role, only reached if the 1st said `needsRole: true`): create
  the account. The frontend re-sends the SAME idToken on the 2nd call
  (`googleIdToken` state in `login/page.tsx`) — the backend re-verifies it
  from scratch both times, it never trusts a client-echoed payload.
- Google Identity Services (the "Entrar com o Google" button,
  `frontend/components/google-sign-in-button.tsx`) is loaded via a plain
  `<script>` tag, not an npm package — avoids a new client dependency for
  what's fundamentally just `window.google.accounts.id.initialize/
  renderButton`. If `NEXT_PUBLIC_GOOGLE_CLIENT_ID` isn't set, the button
  (and its "ou"/divider on the login page) renders nothing — never throws —
  so a local dev environment without Google credentials configured still
  has a fully working traditional login/signup flow.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` must be present at **Next.js build time**
  (baked into the client bundle), not just at Cloud Run runtime — wired as
  a Docker `--build-arg` in `infra/cloudbuild.tf`'s frontend trigger, sourced
  from the same `var.google_client_id` Terraform variable the backend's
  runtime `GOOGLE_CLIENT_ID` env var uses. Changing the Client ID requires a
  new frontend build, not just a Cloud Run env var update.

## Current state

Live endpoints (all under `/api/auth`):
- `POST /register` — public, creates `PERSONAL|ALUNO|NUTRICIONISTA`.
- `POST /login` — public, rate-limited, sets httpOnly cookies + returns
  tokens in body (for non-browser clients).
- `POST /google` — public, Fase 77 SSO Google (see "Handle with care" above
  for the 2-call shape). Not rate-limited like `/login`/`/check-email` —
  the real anti-abuse control is Google's own idToken verification/expiry,
  not this domain's IP+email limiter.
- `PUT /me/password` — authenticated, any role, Fase 80 "change password"
  button (perfil screens). Not rate-limited — unlike `/login`, a wrong
  `currentPassword` here requires an already-valid session token, so brute
  forcing it is a much smaller attack surface (session hijack, not a public
  credential guess).
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
