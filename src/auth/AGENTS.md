# Auth Domain

## Purpose

Owns account creation, credential verification, JWT issuance/rotation, and the
authenticate middleware used by every other domain. Also owns a few
self-service "my account" endpoints that don't belong to any other domain:
avatar upload, explicit locale choice, change/reset password, e-mail
verification, and self-service account deletion (Fase 81). Does NOT own role
changes/promotion or admin-initiated user deletion — those live in
`src/admin` (which reuses `src/lib/user-deletion.ts#deleteUserCascade`, the
same cascade this domain's self-delete calls).

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
  - `emailVerifiedAt` — nullable `DateTime`, Fase 81. `null` until the
    confirmation link is clicked (or, for Google SSO, set immediately at
    account creation — Google already verified `email_verified` before
    issuing the idToken, see the Fase 77 note below).
  - `emailVerificationTokenHash`/`emailVerificationTokenExpiresAt` — sha256
    hash (not bcrypt — the raw token already has 256 bits of entropy, so
    bcrypt's cost factor buys nothing) + a 24h expiry. Only ONE active token
    per user at a time (a new call overwrites the previous one, same
    "single active token" pattern as `refreshTokenHash`). **Never** returned
    from any service function — see `toSafeUser()` below.
  - `passwordResetTokenHash`/`passwordResetTokenExpiresAt` — same hashing
    scheme, 1h expiry (OWASP Forgot Password Cheat Sheet recommends
    15–60min). Also never returned from any service function.
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
- Never return `passwordHash`, `refreshTokenHash`, or (Fase 81)
  `emailVerificationTokenHash`/`emailVerificationTokenExpiresAt`/
  `passwordResetTokenHash`/`passwordResetTokenExpiresAt` from any service
  function — use the shared `toSafeUser(user)` helper at the top of
  `auth.service.ts`, which strips all 6 fields at once. A real bug this
  exact fase: the first version of this code only stripped the original 2
  fields via an inline destructure repeated ~8 times, so the 4 new token
  fields leaked into every `/register`/`/login`/etc JSON response
  (hashed, so not directly exploitable, but still a needless secret-shaped
  leak) until caught in a manual smoke test — this is why the helper exists
  now instead of another inline destructure. If you add a new sensitive
  field to `User`, add it to `toSafeUser()`, not to a one-off destructure.
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
- **Fase 81 — "esqueci minha senha" is anti-enumeration by design.**
  `requestPasswordReset(email)` NEVER throws and the controller ALWAYS
  responds with the same generic message/200, whether or not the account
  exists — don't add a distinct response path for "email not found" here,
  that's the exact leak OWASP's cheat sheet warns against.
- **Fase 81 — password reset invalidates all sessions.** `resetPassword()`
  calls `authRepository.updateRefreshTokenHash(userId, null)` after
  changing the password — if an attacker had a stolen session, changing the
  password (even by the legitimate owner) kicks it out immediately. Don't
  remove this call to "preserve the current session" without reconsidering
  this tradeoff.
- **Fase 81 — email verification is idempotent.** Clicking an already-used
  (or already-verified-by-other-means, e.g. later linking Google) link
  returns 200 with the current user, not an error — `verifyEmail()` checks
  `user.emailVerifiedAt` first and short-circuits before even looking at the
  token. Don't turn the "already verified" case into a 400; a stale
  double-click (e.g. browser prefetch, email client re-fetching the link
  for preview) shouldn't look like a failure to the user.
- **Fase 81 — self-delete-account reuses the admin's last-ADMIN guard.**
  `deleteMyAccount()` calls `authRepository.countAdmins()` and blocks with
  400 if the caller is `role: "ADMIN"` and is the only one left — otherwise
  the last admin could delete their own account and lock everyone out of
  `/nimbus`. Mirror `admin.service.ts`'s equivalent guard if you touch
  either one.
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
- `POST /resend-verification` — authenticated, Fase 81, re-sends the
  confirmation e-mail; 400 if the account is already verified.
- `POST /verify-email` — public, Fase 81, body `{ uid, token }`, confirms
  the e-mail. Idempotent (see above).
- `POST /forgot-password` — public, Fase 81, rate-limited by `(IP, email)`
  via the same `loginRateLimiter`, always 200 with a generic message.
- `POST /reset-password` — public, Fase 81, rate-limited by `(IP, uid)`,
  body `{ uid, token, newPassword }`, invalidates all sessions on success.
- `DELETE /me` — authenticated, any role, Fase 81 self-service account
  deletion, body `{ password? }` (required only if the account has a
  password set). Clears auth cookies on success, same helper `logoutHandler`
  uses.
- `GET /protected` — authenticated smoke-test route for the middleware.

On successful `ALUNO` login, this domain triggers
`relationsService.checkAndFireDueReminders` (payment reminder check) — a
cross-domain call into `fitness`; not this domain's data, just the trigger
point.
