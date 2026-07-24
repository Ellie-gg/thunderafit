# support domain

## Purpose

Q&A / support threads between a student (ALUNO) and a linked professional
(PERSONAL or NUTRICIONISTA). The student opens a thread with a question for a
specific professional they are linked to; the professional replies; either
side can keep posting messages on the same thread afterward.

## Main entities

- **`SupportThread`** (`prisma/schema.prisma`) — `alunoId`, `personalId`
  (holds the professional's user id, regardless of whether that professional
  is a Personal or a Nutricionista), `subject`, `status`
  (`SupportThreadStatus`: `ABERTO` | `RESPONDIDO`, default `ABERTO`),
  `createdAt`/`updatedAt`. Indexed on `[alunoId, updatedAt]` and
  `[personalId, updatedAt]` since `findThreadsForUser` filters by exactly one
  of those columns.
- **`SupportMessage`** — `threadId`, `authorId`, `text`, `createdAt`. Ordered
  chronologically (`asc`) when a full thread is fetched; only the latest
  message (`desc`, `take: 1`) is included in the thread list view.
- No separate "read" flag — status is the only signal of where a thread
  stands.

## Key rules / authorization

- **Who can create a thread**: only `ALUNO` (enforced in the controller). The
  service then re-checks that a `ClientRelation` exists between that student
  and the given `personalId` (`supportRepository.findRelation`) — 403 if not
  linked. There is no domain-level lookup for "personals of a student"; the
  repository queries `ClientRelation` directly via Prisma since that table is
  shared and no such reverse lookup exists yet in `fitness`.
- **Who can view a thread**: only the thread's `alunoId` or `personalId`, or
  role `ADMIN` (`getThread`) — 403/404 otherwise. `listThreads` scopes by
  `alunoId` for students and by `personalId` for professionals (Personal and
  Nutricionista use the same code path).
- **Who can reply**: either party on the thread (`addMessage` checks
  `authorId` is the thread's `alunoId` or `personalId`) — not open to
  arbitrary linked professionals, only the specific one the thread was opened
  with.
- **Status transitions** happen only as a side effect of `addMessage`, driven
  by the *role* of the poster, not by an explicit "close/answer" action:
  - Professional (`PERSONAL` or `NUTRICIONISTA`) posts → status forced to
    `RESPONDIDO` + notifies the student (`support_reply`).
  - Student posts while status is `RESPONDIDO` → status flips back to
    `ABERTO` ("reopens" the thread) + notifies the professional
    (`support_new_thread`).
  - Student posts while already `ABERTO` → no status change, no notification.
- `listMyPersonals` (student-only endpoint) returns the linked professionals
  with `professionalType` so the frontend can label Personal vs
  Nutricionista when picking a recipient.

## Handle with care

- `addMessage`'s reopen logic branches on `role === "ALUNO"` reaching the
  `else if`; if a third role is ever introduced without updating this
  three-way branch, messages could silently skip both the "answered" and
  "reopened" notifications.
- `personalId` is a misleading name for a column that may hold a
  Nutricionista's id — don't assume `PERSONAL` role when reading it.
- `supportRepository` reaches into `ClientRelation`/`prisma.user` directly
  instead of going through `src/fitness`; if the fitness domain gains a
  proper reverse lookup, consider migrating this to avoid duplicated query
  logic.
- No pagination on `listThreads` or on a thread's messages — fine at current
  volume, worth revisiting if threads/messages grow large.

## Current state

Fully implemented: list linked professionals, create thread (with first
message), list threads (role-scoped), get single thread with full message
history, post message (with status auto-transition + notifications).
Notifications (`support_new_thread`, `support_reply`) are fired via
`notificationsService.notify` on create and on professional reply. Covered by
`src/support/__tests__/support.test.ts`, including the not-linked (403),
not-a-participant (403), and reopen-on-student-reply flows.
