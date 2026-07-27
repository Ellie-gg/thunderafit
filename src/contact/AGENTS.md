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
- **Email delivery is Gmail SMTP via nodemailer** (`src/lib/mailer.ts`), not
  a transactional email service (no SendGrid/Mailgun/Postmark/etc — zero
  cost, zero new third-party signup). Requires `CONTACT_GMAIL_USER` +
  `CONTACT_GMAIL_APP_PASSWORD` (a Google **App Password**, not the account's
  real password — requires 2FA enabled on that Gmail account, generated at
  myaccount.google.com/apppasswords). `CONTACT_EMAIL_TO` is optional
  (defaults to `CONTACT_GMAIL_USER` itself — sends to the same account that
  sends). **Without these env vars, `sendMail()` returns `false` without
  throwing** — the feature degrades gracefully (message still saved,
  `emailSent: false`) rather than breaking in environments that haven't
  configured SMTP yet (e.g. local dev).
- There is **no admin UI to browse `ContactMessage` rows** — if email
  delivery is broken/unconfigured, the only way to see a message is a
  direct DB query. This was accepted as an explicit scope cut for Fase 78,
  not an oversight — add one if repeated silent email failures become a
  real problem.
- `src/lib/mailer.ts`'s transporter is a module-level singleton created
  lazily on first use (not at import time) — cheap to import even when SMTP
  isn't configured, and avoids reconnecting on every call.

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
