# Anamnesis domain

## Purpose

Stores the student's (Aluno) health/intake questionnaire: goals, health
conditions, medications, injuries, activity level, training preferences,
basic biometrics (height/weight/birth date). One record per student,
filled in by the student and read by their linked coaching professional to
plan training. This is sensitive health data.

## Main entities

- `Anamnesis` (Prisma model, `prisma/schema.prisma`) — one row per
  `alunoId` (`@unique`), free-text fields for health conditions,
  medications, injuries, goals, activity level, past experience, training
  preferences, plus `heightCm`/`weightKg`/`birthDate`. No soft delete.
- Relies on `ClientRelation` (owned by the `fitness`/relations domain) to
  check whether a professional is linked to the student — queried
  directly via Prisma in `repository/anamnesis.repository.ts` rather than
  importing the other domain's service, to avoid cross-domain coupling.
- Relies on `AdminAccessLog` (owned by `src/admin`) to audit admin reads.

## Key rules / authorization

Verified directly in `controllers/anamnesis.controller.ts` and
`services/anamnesis.service.ts`:

- **Write (POST/PUT)**: only the student themself (`role === "ALUNO"`),
  and only for their own record (`user.sub` is used as `alunoId`, never a
  body/query param). No professional or admin can write. POST 409s if a
  record already exists; PUT 404s if it doesn't yet.
- **Read own** (`GET /api/anamnesis` with no `alunoId`): only `ALUNO`,
  returns their own record (`null` if not yet filled — not an error).
- **Read by professional** (`GET /api/anamnesis?alunoId=...`): allowed for
  `PERSONAL` and `NUTRICIONISTA` roles, read-only, **only if** a
  `ClientRelation` row links that professional to the student
  (`findRelation(professionalId, alunoId)`), otherwise 403. No relation
  check is bypassed for either professional type — same code path serves
  both since `ClientRelation` stores `professionalType`.
- **Read by admin** (`GET /api/anamnesis?alunoId=...`): `ADMIN` role
  bypasses the `ClientRelation` check entirely (admin does not need to be
  linked to the student) but every successful read is audit-logged, see
  below.
- Any other role hitting either GET form gets 403.

## Handle with care

- This is health data (medical conditions, medications, injuries). Do not
  log field values, do not include them in error messages, and do not
  widen any endpoint to return other students' data without an explicit
  authorization check mirroring the ones above.
- **Admin reads are mandatory-audited**: `anamnesisService.getForAdmin`
  calls `adminRepository.createAccessLog(adminId, "anamnesis", alunoId)`
  (writes to `AdminAccessLog`) immediately after a successful read. The
  log is only written when an anamnesis actually exists and is returned —
  a 404 (student hasn't filled it in) does not create a log entry, since
  no content was disclosed. If you add any other admin-facing read path
  for anamnesis data (e.g. a new report/export), it must call
  `adminRepository.createAccessLog` the same way — do not add a silent
  admin read path.
- `AdminAccessLog` is distinct from `AdminAuditLog` (generic admin write
  actions, e.g. role changes) — don't conflate the two when auditing new
  admin behavior in this domain.
- Professional access is strictly read-only; there is no endpoint letting
  a `PERSONAL`/`NUTRICIONISTA` edit a student's anamnesis.

## Current state

- Three routes only: `GET/POST/PUT /api/anamnesis`, all behind
  `fastify.authenticate`. No DELETE endpoint.
- No versioning/history of edits — POST/PUT overwrite in place
  (`updatedAt` tracks last change only).
- Tests in `__tests__/anamnesis.test.ts` cover: student self create/edit,
  409 on double-create, 404 on edit-before-create, professional-role
  rejection on write, linked-vs-unlinked professional read (200 vs 403),
  and non-ALUNO/non-professional roles getting 403. No test currently
  asserts on `AdminAccessLog` row creation for the admin read path — verify
  that behavior manually if you touch `getForAdmin`.
