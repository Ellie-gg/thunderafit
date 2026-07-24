# connections domain

## Purpose

Discovery + connection flow between professionals (PERSONAL/NUTRICIONISTA) and
students (ALUNO): a public opt-in directory of professionals, and a manual
approval request flow that gates the creation of the real `ClientRelation`
(owned by the `fitness` domain, see `relations.service`).

## Main entities

- **`User` public profile fields** (not a separate model — fields live on
  `User` itself): `availableForNewStudents`, `location` (free text, no geo),
  `bio`, plus `planoAssinatura` (surfaced read-only for the search result to
  highlight Plus).
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

## Current state

- NUTRICIONISTA role is supported end-to-end in this domain's logic, but the
  frontend only exposes PERSONAL search; `role` query param defaults to
  PERSONAL and only accepts these two values.
- No pagination on `searchProfessionals` or `listRequests`.
- No cancel/withdraw endpoint for the ALUNO side of a pending request.
