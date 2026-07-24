# notifications domain

## Purpose

In-app notifications only: a per-user feed and unread counter that other
domains write to (support, connections, fitness) and that the frontend
notification bell reads. There is no push (APNs/FCM) and no WebSocket —
delivery is entirely pull-based from the client.

## Main entities

- **`Notification`** — `id`, `userId`, `type` (free-form string, not an
  enum — e.g. `support_new_thread`, `support_reply`, `connection_request`,
  `connection_accepted`, `connection_rejected`, `payment_reminder`),
  `message` (pre-rendered, human-readable text — no i18n key/template, the
  string is fixed at creation time in the caller's language), `read`
  (boolean, default false), `createdAt`. Indexed on `[userId, createdAt]`
  and `[userId, read]` — these back the two hottest queries in the app
  (list feed, unread count), since the bell polls on every authenticated
  page.

## Key rules / authorization

- All four routes (`GET /api/notifications`, `GET
  /api/notifications/unread-count`, `POST /api/notifications/:id/read`,
  `POST /api/notifications/read-all`) require only a valid session
  (`fastify.authenticate`) — no role check. Every route implicitly scopes
  to `request.user.sub`; there is no way to read or mark another user's
  notifications through the API.
- `markRead` fetches the notification first and checks `notification.userId
  === userId`; a mismatch (or a non-existent id) throws a 404, not a 403 —
  callers can't distinguish "not yours" from "doesn't exist."
- `listForUser` returns at most the 50 most recent, ordered by `createdAt`
  desc. No pagination beyond that cap.
- Writing a notification is a one-way call: `notificationsService.notify(userId,
  type, message)`. It has no return-path/ack — the caller (support, connections,
  fitness) fires it and moves on; a failure here does not roll back the
  caller's own operation (calls are `await`ed inline but not wrapped in a
  try/catch by most callers — see Handle with care).

## Handle with care

- `notify()` is intentionally the only extension point for a future real push
  channel — the service header comment documents that a `notify()` should
  eventually call both `create()` (in-app) and a push dispatcher, without
  changing any of today's callers. Don't build a parallel push path
  elsewhere; extend this function.
- `type` is a plain string, not backed by an enum/union at the DB or Prisma
  level — the values above are simply the ones currently in use by callers.
  Adding a new notification type doesn't require a migration, but also means
  there's no compile-time or DB-level guard against typos in `type`.
- `message` is stored fully rendered (already interpolated with names,
  subjects, etc.) at write time — there's no template stored separately, so
  changing copy going forward does not affect already-created rows, and
  there is no i18n on read (whatever language the caller composed the
  string in is what's stored and served).
- Because `notify()` calls are awaited directly in the caller's request
  flow (support thread creation/reply, connection request/accept/reject,
  the aluno-login payment-reminder check in `fitness/relations.service`),
  a thrown error here can surface as a failure of the *caller's* endpoint.
  Keep this service's error surface minimal (it currently only throws from
  `markRead`, which callers don't invoke) if you don't want, e.g., a support
  reply to fail because a notification insert failed.

## Current state

- **Delivery is polling-only**, confirmed in
  `frontend/components/notification-bell.tsx`: the unread-count query polls
  every 30s (`refetchInterval: 30_000` via TanStack Query); the list query
  only fetches when the bell dropdown is opened (`enabled: open`). There is
  no WebSocket, SSE, or real push (APNs/FCM) — this was a deliberate choice
  documented in both the frontend component and `notifications.service.ts`
  to avoid adding WebSocket infra for what was originally just the Support
  (Dúvidas) feature.
- Current callers, all one-directional (write-only, fire-and-forget) into
  this domain: `src/support/services/support.service.ts` (new thread /
  reply), `src/connections/services/connections.service.ts` (request /
  accept / reject), `src/fitness/services/relations.service.ts` (payment
  reminder, fired from `checkAndFireDueReminders` on aluno login — a cron
  substitute, since the platform has no scheduler infra). No domain reads
  notifications back except through this domain's own routes.
- No delete endpoint — notifications accumulate indefinitely (only `read`
  flips); there's no retention/cleanup job.
