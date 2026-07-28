# contact domain

## Purpose

"Fale Conosco" (Fase 78) — any authenticated role sends a title + message
(≤500 chars) straight to the founder. Not a support/Q&A thread (that's
`src/support`, aluno↔professional) — this is app-user → founder, one-way.

## Main entities

- **`ContactMessage`** — `userId`, `role`, `title` (≤120 chars), `message`
  (≤500 chars), `emailSentAt` (nullable), `createdAt`. Every submission is
  written here **first and unconditionally** — email delivery is a
  best-effort layer on top, never a precondition for the row existing.

## Key rules / authorization

- Any authenticated role can call `POST /api/contact` — no role
  restriction, unlike most other domains that gate by ALUNO vs.
  PERSONAL/NUTRICIONISTA.
- Validation lives in `contact.service.ts`: title and message both
  required (400 if blank after trim), capped at 120/500 chars
  respectively. Enforced server-side even though the frontend also caps
  the textarea at 500 — never trust the client-side cap alone.

## Handle with care

- **Email failure never fails the request.** `contactService.send()`
  always creates the `ContactMessage` row first, then *tries* `sendMail()`
  inside a try/catch — a thrown error (SMTP down, bad credentials) is
  logged (`console.error`) and swallowed; the API still returns 201 with
  `emailSent: false`. The message is never lost even if email is
  completely broken — don't restructure this so email failure blocks or
  rolls back the DB write.
- **Email delivery is Resend** (`src/lib/mailer.ts`), not Gmail SMTP anymore
  — Fase 78 used `nodemailer` + a personal Gmail account (zero cost, zero
  new signup); Fase 83 switched to Resend once `thunderafit.com.br` was
  DNS-verified there (SPF/DKIM/DMARC), for a professional sender address
  (`no-reply@thunderafit.com.br`) and better deliverability. Still free at
  this app's volume (3,000 emails/month on Resend's free tier). Requires
  only `RESEND_API_KEY` (no separate "app password" — one secret). Sender
  is hardcoded (`MAIL_FROM` in `mailer.ts`), not an env var — it's tied to
  the verified domain, not a per-environment setting. `CONTACT_EMAIL_TO` is
  **required** (no fallback since Fase 83 — there's no more sender-email env
  var to default to). **Without `RESEND_API_KEY` configured, `sendMail()`
  returns `false` without throwing** — the feature degrades gracefully
  (message still saved, `emailSent: false`) rather than breaking in
  environments that haven't configured it yet (e.g. local dev).
- There is **no admin UI to browse `ContactMessage` rows** — if email
  delivery is broken/unconfigured, the only way to see a message is a
  direct DB query. This was accepted as an explicit scope cut for Fase 78,
  not an oversight — add one if repeated silent email failures become a
  real problem.
- `src/lib/mailer.ts`'s Resend client is a module-level singleton created
  lazily on first use (not at import time) — cheap to import even when
  `RESEND_API_KEY` isn't configured.

## Current state

- Live endpoint: `POST /api/contact` (authenticated, any role) — the only
  route in this domain.
- Frontend: `/fale-conosco` (`frontend/app/fale-conosco/page.tsx`), linked
  from the nav for ALUNO, PERSONAL, and NUTRICIONISTA
  (`frontend/components/app-header.tsx`). No admin equivalent.
- Tests (`src/contact/__tests__/contact.test.ts`) mock `src/lib/mailer.ts`'s
  `sendMail` (same `jest.mock` pattern used elsewhere in this repo for
  external dependencies, e.g. `admin-exercise-media.test.ts` for storage)
  — never hits real Gmail SMTP in CI/local test runs.
