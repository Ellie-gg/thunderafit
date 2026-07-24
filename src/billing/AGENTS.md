# billing — AGENTS.md

For Stripe env vars, webhook setup (Stripe CLI, production proxy path), and the
manual test-mode walkthrough, see `BILLING_SETUP.md` in this folder — not
repeated here.

## Purpose

Owns subscription tiers for professional users (PERSONAL / NUTRICIONISTA):
Stripe Checkout (hosted, subscription mode), the Stripe Customer Portal
(manage/cancel), a signature-verified webhook that is the single writer of
plan state, and a `GET /status` read for the UI. No payment method or card
data ever touches this backend — Stripe hosts both Checkout and the Portal.

Routes (`routes/billing.routes.ts`):
- `POST /api/billing/webhook` — public (Stripe can't send our JWT), authenticated by signature instead.
- `GET /api/billing/status`, `POST /api/billing/checkout-session`, `POST /api/billing/portal` — behind the normal `authenticate` preHandler.

## Main entities

Billing has no tables of its own — all state lives on `User` (`prisma/schema.prisma`):
- `planoAssinatura: PlanoAssinatura` (`FREE | BASE | PLUS`, default `FREE`)
- `limiteAlunos: Int` (default 3) — the actual enforcement value read elsewhere (e.g. `fitness/services/relations.service.ts`); the tier is just a label, this number is what gates new student links.
- `stripeCustomerId: String? @unique` — set on first checkout or on any webhook that carries a customer id; `@unique` is what allows the webhook's reverse lookup (`findUserByStripeCustomerId`).
- `stripeSubscriptionId: String?` — the *current* subscription id; used as a guard (see below), not just a record.
- `availableForNewStudents: Boolean` — belongs to the `connections` domain, but billing zeroes it on downgrade (see gotcha below).

Tier limits are constants in `stripe.ts`, not DB config: `FREE_LIMITE_ALUNOS=3`, `BASE_LIMITE_ALUNOS=20`, `PLUS_LIMITE_ALUNOS=1_000_000` (PLUS is "unlimited" simulated as a large int since `limiteAlunos` is a plain `Int` — reuses the same `count >= limiteAlunos` check everywhere instead of a separate "unlimited" code path).

## Key rules / authorization

- Only `PERSONAL` and `NUTRICIONISTA` roles can call checkout-session or portal (403 otherwise); `ALUNO`/`ADMIN` have no billing surface. Enforced in `controllers/billing.controller.ts`, not in the service.
- The webhook is the **only** writer of `planoAssinatura`/`limiteAlunos`/`stripeSubscriptionId`. Nothing else in the codebase mutates those fields directly — don't add a shortcut that sets plan state outside `billing.service.ts`.
- Tier-gated features live in *other* domains, not here: `connections.service.ts` blocks turning `availableForNewStudents` on when `planoAssinatura === "FREE"` (turning it off is always allowed at any tier). If a future feature is gated by tier, follow that pattern — check `planoAssinatura` at the point of use, don't duplicate tier logic in `billing`.
- `customer.subscription.updated`/`.deleted` only act when the event's subscription id equals the user's *current* `stripeSubscriptionId` (strict equality, `null` never matches). This is deliberate protection against Stripe's out-of-order/duplicate delivery — see "Handle with care" below.
- Downgrade (`applyFreePlan`) never removes existing `ClientRelation` rows past the new limit — the limit only blocks *new* links going forward. Don't "fix" this into a retroactive cutoff without checking with product first; it's a documented decision, not an oversight.

## Handle with care

- **Webhook signature verification is on the raw body, not the parsed JSON.** `app.ts` installs a custom `application/json` content-type parser that stashes the exact byte buffer on `request.rawBody` before parsing, specifically so `stripe.webhooks.constructEvent(rawBody, signature, secret)` sees the untouched bytes. If you ever touch that parser or add another one ahead of it, the webhook will start failing signature checks silently for real Stripe traffic (tests would still pass if they reuse the same buffer path — check `__tests__/billing.test.ts`'s `signed()`/`postWebhook()` helpers, which send a raw string for this exact reason).
- **In production the webhook is reached through the frontend proxy**, not directly (Cloud Run backend is IAM-restricted). The proxy must forward the exact raw bytes (`arrayBuffer()`) and the `Stripe-Signature` header unchanged — any re-serialization there breaks verification. See `BILLING_SETUP.md` §5.
- **Missing env vars fail closed, not open, and lazily rather than at boot:**
  - No `STRIPE_SECRET_KEY` → `getStripe()` throws only when first called (checkout/portal/webhook signature check), not at server startup — a deployment with billing unused never needs this var.
  - No `STRIPE_WEBHOOK_SECRET` → webhook handler returns 500 immediately, before touching the signature or body.
  - Missing `STRIPE_PRICE_ID_<TIER>_<INTERVAL>` → `createCheckoutSession` throws 500 for that specific tier/interval combo only (checked lazily per-call via `requireEnv`), so e.g. enabling BASE without PLUS prices configured yet works fine.
  - Unknown/unconfigured price id on `customer.subscription.updated` → `tierForPriceId` does **not** throw; it silently grants **BASE** (never guesses PLUS). Confirmed by test: "price desconhecido... concede BASE por segurança".
- **Async payment methods (boleto/Pix) are handled explicitly**: `checkout.session.completed` only upgrades the plan if `payment_status` is `paid` or `no_payment_required`; otherwise it stores the customer/subscription ids (via `linkStripe`) without changing the plan, and waits for `checkout.session.async_payment_succeeded` to actually confirm. Don't collapse these two event types into one path — the pending-payment state is intentional.
- **Reordering/redelivery guard**: since Stripe doesn't guarantee delivery order, a stale `customer.subscription.updated(active)` arriving *after* a `.deleted` must not resurrect the plan — this only works because `.deleted` zeroes `stripeSubscriptionId` first, so the stale event's id no longer matches. If you ever change downgrade to *not* clear `stripeSubscriptionId`, you reopen this race.
- All webhook handling is effectively idempotent (reapplying the same plan state is a no-op) but there is **no idempotency table keyed on `event.id`** — a truly duplicate event just reapplies the same DB write. Fine at current volume; noted as a gap in `BILLING_SETUP.md`.

## Current state

Three tiers exist and are live in code: `FREE` (3 students, no directory access), `BASE` (20 students, can opt into the professional directory), `PLUS` (effectively unlimited students, priority placement in the directory — priority ordering itself lives outside this domain). Checkout supports monthly and annual intervals for both paid tiers (4 Stripe Price IDs total). Real Stripe products/prices and a live webhook endpoint are not yet configured in any environment (test-mode only, per `BILLING_SETUP.md`) — going live is a manual, explicit step (swap test keys for live keys and deploy), not a code change.
