# connections domain

## Purpose

Discovery + connection flow between professionals (PERSONAL/NUTRICIONISTA) and
students (ALUNO): a public opt-in directory of professionals, and a manual
approval request flow that gates the creation of the real `ClientRelation`
(owned by the `fitness` domain, see `relations.service`).

## Main entities

- **`User` public profile fields** (not a separate model — fields live on
  `User` itself): `availableForNewStudents`, `bio`, plus `planoAssinatura`
  (surfaced read-only for the search result to highlight Plus).
- **Fase 75 — structured city/state + specialties**: `city`/`state` (2-letter
  UF, validated against the fixed `BR_STATES` list in
  `src/connections/constants.ts`) replaced the old free-text `location`
  field (still present in the schema/DB, but dead — nothing reads or writes
  it anymore; not dropped to avoid a destructive migration for a field that
  never had a real UI in front of it). `specialties: Specialty[]` is a fixed
  enum (10 values) for multiple-choice tagging. Both the ALUNO (their saved
  search city) and the professional (their public profile city) use the
  exact same two fields — search matches by equality (case-insensitive on
  `city`), not `contains`, so the two sides always agree on format.
  `avatarUrl` is now also in the public-profile select, for the search
  result/preview card.
- **`ConnectionRequest`** — one row per (alunoId, professionalId) pair
  (`@@unique([alunoId, professionalId])`). `status`: `PENDENTE` → `ACEITA` |
  `RECUSADA`. Re-requesting after a rejection reuses the same row (upsert),
  flipping it back to `PENDENTE` instead of creating a new one.

## Key rules / authorization

- Directory visibility requires ALL of: `role` matches requested type
  (PERSONAL/NUTRICIONISTA), `availableForNewStudents = true`, AND
  `planoAssinatura != FREE`. The plan check is enforced twice: once as a gate
  when *turning on* availability (`updateMyProfile` throws 403 for FREE), and
  again as a `where` filter in `searchProfessionals` itself — defense in
  depth against stale/inconsistent rows (e.g. a downgrade that didn't clear
  the flag). Turning availability *off* is always allowed, on any plan.
- Search results are ordered Plus-first, then Base, then by `createdAt` asc —
  relies on Prisma sorting the `PlanoAssinatura` enum by declaration order
  (FREE, BASE, PLUS) with `desc`. Reordering the enum's declaration silently
  breaks this.
- Only `ALUNO` can create a request (403 otherwise); only
  PERSONAL/NUTRICIONISTA can accept/reject (403 otherwise), and only the
  targeted `professionalId` may act on a given request (403 if not theirs).
- A request can only be created against a professional with
  `availableForNewStudents = true` (409 otherwise), and not if one is already
  `PENDENTE` or `ACEITA` for that pair (409).
- Accepting delegates to `relationsService.createRelation`, which enforces
  the Freemium student-limit for the professional. If that throws (limit
  reached, invalid student, already linked), the error propagates as-is and
  the `ConnectionRequest` **stays `PENDENTE`** — it is only marked `ACEITA`
  after the `ClientRelation` is actually created. The professional must free
  up a slot / upgrade and accept again.
- Both accept and reject require the request to currently be `PENDENTE`
  (409 if already answered).
- Accept/reject/create all fire a notification via `notificationsService`
  (`connection_request`, `connection_accepted`, `connection_rejected`).

## Handle with care

- `searchProfessionals` and `listRequests` return only the public-profile
  shape (`id`, `email`, `role`, `location`, `bio`, `planoAssinatura`) —
  never leak other `User` fields through these endpoints.
- `listRequests` enriches each request with the counterpart's public info
  looked up in bulk; if the counterpart user was deleted, it falls back to a
  placeholder (`"(usuário removido)"`) rather than failing — don't assume
  the counterpart always resolves.
- The `@@unique([alunoId, professionalId])` upsert means there is no request
  history — rejecting then re-requesting overwrites the same row, so
  `createdAt`/id are stable across cycles but any audit trail of prior
  rejections is not retained.
- Plan-gate logic lives in this domain's service, not in `billing` — keep it
  in sync if the plan model or its downgrade behavior changes elsewhere
  (e.g. `applyFreePlan`, referenced in service comments, must keep clearing
  `availableForNewStudents`).
- `updateMyProfile`'s role check is per-field, not per-request: `city`/`state`
  can be set by ANY authenticated role (this is how the ALUNO persists their
  search city via the exact same `PUT /api/professionals/me` endpoint used
  by the professional's own profile screen) — only
  `availableForNewStudents`/`bio`/`specialties` are professional-only (403
  for ALUNO). Don't tighten the role check back to "professionals only" for
  the whole endpoint without re-routing the aluno's city save somewhere else
  first.

## Current state

- NUTRICIONISTA role is supported end-to-end in this domain's logic, but the
  frontend only exposes PERSONAL search; `role` query param defaults to
  PERSONAL and only accepts these two values.
- No pagination on `searchProfessionals` or `listRequests`.
- No cancel/withdraw endpoint for the ALUNO side of a pending request.
- Fase 75: the "use my current location" button
  (`frontend/components/city-state-input.tsx`) calls the free, keyless
  Nominatim (OpenStreetMap) reverse-geocoding API directly from the browser
  — no backend proxy, no API key, but it's a third-party service with no SLA
  and a fair-use rate limit; if it fails or the browser denies permission,
  typing the city manually always still works.
- The Personal profile form
  (`frontend/app/personal/perfil/page.tsx`) only reveals city/UF/specialties/
  bio/preview when `availableForNewStudents` is on — since those fields are
  gated behind that toggle, there's no race between a slow profile fetch and
  the user typing (the inputs don't exist until data has loaded). The
  aluno-facing city forms (`/profissionais`, `/perfil`) do NOT have that
  luxury — their fields render immediately, so both guard against the
  prefill effect clobbering fast-typed input with a `userEditedRef`; don't
  remove that guard when touching either page.
