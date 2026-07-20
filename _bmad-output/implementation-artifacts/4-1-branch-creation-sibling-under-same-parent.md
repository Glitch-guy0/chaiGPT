# Story 4.1: Branch Creation (Sibling Under Same Parent)

Status: ready-for-dev

## Story

As a user,
I want to branch from any assistant message,
So that I can explore alternatives.

## Acceptance Criteria

1. **Given** an assistant message with `parentId` P in conversation C, **When** `ConversationService.branch(id, messageId, userId)` runs, **Then** a new conversation is created sharing `rootConversationId` of C and the branched message becomes a sibling under the same `parentId`. (FR-8)

2. **Given** a new branch is created, **When** the operation completes, **Then** the new branch is scoped to the same `userId`. (FR-2)

3. **Given** a non-existent or cross-user conversation `id`, **When** `branch` runs, **Then** the service signals a 404 (NotFoundError) — the resource must never be leaked across users. (FR-2)

4. **Given** a non-existent or cross-user `messageId`, **When** `branch` runs, **Then** the service signals a 404 (NotFoundError). (FR-2)

5. **Given** a message that exists but is not an assistant message (e.g. role `user`), **When** `branch` runs, **Then** the service rejects with a clear error — branching is only allowed from assistant messages. (FR-8, UX intent)

6. **Given** a valid branch request, **When** the branch conversation is persisted, **Then** the new conversation's `rootConversationId` is set to C's `rootConversationId` (if C is already a branch) or C's own `id` (if C is a root conversation). (FR-8)

7. **Given** a valid branch request, **When** messages are copied from source to branch, **Then** all messages up to and including the branched-from assistant message are copied to the new conversation with their original `id`, `parentId`, and ordering preserved — only `conversationId` is updated to the new branch's ID. (FR-8)

8. **Given** the branch-point message is an assistant message with `parentId` P, **When** messages are copied, **Then** the copied assistant message retains `parentId` P in the new conversation so future user messages in the branch are siblings sharing `parentId` P. (FR-8, FR-9)

9. **Given** the source conversation's `lastMessageId` references a message after the branch point, **When** the branch is created, **Then** the new conversation's `lastMessageId` is set to the copied branch-point assistant message's ID — the branch starts at the branch point. (FR-8)

10. **Given** `ConversationRepository.branch(id, messageId, userId)` is called, **When** it runs, **Then** it creates a new conversation row with `userId`, `title` = `"{source.title} (branch)"`, `rootConversationId` = `source.rootConversationId ?? source.id`, `model` = `source.model`, and `lastMessageId` = the copied branch-point message's ID, then copies all messages from source up to `messageId` into the new conversation. (FR-8)

## Tasks / Subtasks

- [ ] **Task 1 — Enhance `ConversationRepository.branch` to copy messages (AC: #6, #7, #8, #9, #10)** (refs: `src/lib/db/repositories/conversation.repository.ts`)
  - [ ] Subtask 1.1: Update `ConversationRepositoryImpl.branch` to use `messageId`: after creating the branch conversation, retrieve all messages from the source conversation (via the internal `repo.manager` / DataSource) ordered by `createdAt` ASC, up to and including the message matching `messageId`.
  - [ ] Subtask 1.2: For each copied message, create a new entity instance with all fields identical EXCEPT `conversationId` which is set to the new branch conversation's `id` — preserve the original `id`, `parentId`, `userId`, `role`, `content`, `model`, `status`, `assetIds`, `createdAt`, `updatedAt`. This ensures parentId references remain valid across the copy.
  - [ ] Subtask 1.3: After copying messages, update the branch conversation's `lastMessageId` to the copied branch-point message's `id`.
  - [ ] Subtask 1.4: Persist the branch conversation with `lastMessageId` set (second save or update) after messages are copied.
  - [ ] Subtask 1.5: If the source conversation has no messages or `messageId` is not found among source messages, throw `Error('Message not found in conversation')`.

- [ ] **Task 2 — Implement `ConversationService.branch` (AC: #1, #2, #3, #4, #5)** (refs: `src/services/conversation.service.ts`, `ConversationService` interface)
  - [ ] Subtask 2.1: Accept `id: string`, `messageId: string`, `userId: string` matching the existing interface signature `branch(id: string, messageId: string, userId: string): Promise<Conversation>`.
  - [ ] Subtask 2.2: Verify the source conversation exists and belongs to `userId` via `repo.findById(id, userId)`; throw `NotFoundError` if missing. (AC: #3)
  - [ ] Subtask 2.3: Verify the branched-from message exists and belongs to `userId` — delegate to a `MessageRepository` (inject into service constructor); if message not found, throw `NotFoundError`. (AC: #4)
  - [ ] Subtask 2.4: Validate the message `role` is `'assistant'` — if not, throw `Error('Can only branch from assistant messages')`. (AC: #5)
  - [ ] Subtask 2.5: Validate the message has a `parentId` — if missing, this is an edge case; the AC requires the message to have `parentId` P. If absent, throw `Error('Message has no parentId — cannot branch from root message')`. (FR-8)
  - [ ] Subtask 2.6: Delegate to `repo.branch(id, messageId, userId)` which creates the branch conversation and copies messages. (AC: #6, #7, #8, #9, #10)
  - [ ] Subtask 2.7: Return the new `Conversation` (with messages already copied). (AC: #1, #2)
  - [ ] Subtask 2.8: Inject `MessageRepository` into `ConversationServiceImpl` constructor — this is a signature change. Update the existing constructor to accept `(private repo: ConversationRepository, private messageRepo: MessageRepository)`.

- [ ] **Task 3 — Create route handler `POST /api/conversations/[id]/branch` (AC: #1–#5, integration)** (refs: `src/app/api/conversations/[id]/branch/route.ts`)
  - [ ] Subtask 3.1: Create new file `src/app/api/conversations/[id]/branch/route.ts` following the pattern from `src/app/api/conversations/[id]/edit/route.ts`.
  - [ ] Subtask 3.2: Export `POST` handler that reads `{ userId }` from `auth()` (Clerk), returns 401 if unauthenticated.
  - [ ] Subtask 3.3: Extract `id` from `params` (the conversation ID from the URL path).
  - [ ] Subtask 3.4: Parse request body with Zod `BranchRequestSchema` (see Task 4): `{ messageId: z.string().uuid() }`. Return 400 on parse failure.
  - [ ] Subtask 3.5: Instantiate `ConversationRepositoryImpl` + `MessageRepositoryImpl` via `getDatabase()`, construct `ConversationServiceImpl`, call `service.branch(id, messageId, userId)`.
  - [ ] Subtask 3.6: Return the new conversation as JSON with status 201.
  - [ ] Subtask 3.7: Catch `NotFoundError` → 404, validation errors → 400, others → 500.

- [ ] **Task 4 — Add `BranchRequestSchema` to Zod schemas (AC: validation)** (refs: `src/lib/validation/schemas.ts`)
  - [ ] Subtask 4.1: Export `BranchRequestSchema = z.object({ messageId: z.string().uuid() })` matching the pattern of existing schemas.
  - [ ] Subtask 4.2: Export `type BranchRequest = z.infer<typeof BranchRequestSchema>`.

- [ ] **Task 5 — Unit tests for `ConversationRepository.branch` (AC: #6, #7, #8, #9, #10)** (refs: `src/lib/db/repositories/conversation.repository.test.ts`)
  - [ ] Subtask 5.1: Add test "creates branch conversation with rootConversationId set" — verify `rootConversationId` = source id when source is root, and = source's rootConversationId when source is already a branch.
  - [ ] Subtask 5.2: Add test "copies messages up to branch point into new conversation" — seed source conv with 4 messages (user→assistant→user→assistant); branch from the 2nd assistant (index 3); verify new conv has exactly 4 messages with the same IDs and parentIds, only `conversationId` differs.
  - [ ] Subtask 5.3: Add test "does not copy messages after branch point" — seed with 4 messages, branch from the 2nd message (index 1); verify only 2 messages copied.
  - [ ] Subtask 5.4: Add test "sets lastMessageId to branch-point message id" — verify `branch.lastMessageId` equals the copied branch-point assistant message's id.
  - [ ] Subtask 5.5: Add test "throws on branch with non-existent messageId" — use a UUID not in the source conv; expect throw.
  - [ ] Subtask 5.6: Add test "preserves parentId in copied messages" — verify the copied assistant message retains the original `parentId` value.
  - [ ] Subtask 5.7: Update existing "branch a conversation" test to include message copying assertion.

- [ ] **Task 6 — Unit tests for `ConversationService.branch` (AC: #1–#5)** (refs: `src/services/conversation.service.test.ts`)
  - [ ] Subtask 6.1: Add mock `MessageRepository` to test setup (`createMockMessageRepo()` with `findById`, `findByConversation`). Update `ConversationServiceImpl` construction to pass both repos.
  - [ ] Subtask 6.2: Add test "branch creates new conversation with rootConversationId" — mock repo.branch to return a branch conv; verify service returns it.
  - [ ] Subtask 6.3: Add test "throws NotFoundError on non-existent conversation" — repo.findById returns null; expect NotFoundError.
  - [ ] Subtask 6.4: Add test "throws NotFoundError on non-existent message" — messageRepo.findById returns null; expect NotFoundError.
  - [ ] Subtask 6.5: Add test "rejects non-assistant messages" — message is a user role; expect descriptive error.
  - [ ] Subtask 6.6: Add test "rejects messages without parentId" — message has no parentId; expect descriptive error.
  - [ ] Subtask 6.7: Add test "delegates to repo.branch with correct params" — mock all lookups to pass; verify repo.branch called with (id, messageId, userId).
  - [ ] Subtask 6.8: Assert coverage ≥80% of the new branch method (NFR-7, FR-31).

- [ ] **Task 7 — E2E test for branch creation (AC: all)** (refs: `e2e/`, existing `branchFromMessage` helper at `e2e/helpers/helpers.ts`)
  - [ ] Subtask 7.1: Extend `branchFromMessage` helper or add a dedicated test that creates a conversation, sends messages, then triggers branch via the API.
  - [ ] Subtask 7.2: Verify the new conversation appears in `GET /api/conversations` with expected `rootConversationId` and `title` containing "(branch)".
  - [ ] Subtask 7.3: Verify the new conversation's messages match the source up to the branch point.
  - [ ] Subtask 7.4: This test runs against Docker Compose (Postgres) and counts toward NFR-9 / FR-34 smoke gate.

## Dev Notes

- **Nature of the change:** This is the first branching story. It implements the server-side branch creation logic at both the repository and service layers, plus the API route. The `ConversationService.branch` interface is already declared (Story 1.2 / E1) — the current implementation is a stub that throws `Error('branch not yet implemented')`. This story fills in that stub.

- **Two-layer approach:**
  - `ConversationRepositoryImpl.branch` currently creates only a conversation clone, ignoring `messageId`. This story enhances it to also copy messages up to the branch point into the new conversation, preserving IDs and parentIds. The repository owns the data copy because it has direct access to both the `Conversation` and `Message` TypeORM repositories via the shared DataSource.
  - `ConversationServiceImpl.branch` is the orchestration layer: validates inputs, checks business rules (assistant-only, requires parentId), delegates to the repository.

- **MessageRepository injection into ConversationService:** The current `ConversationServiceImpl` constructor takes only `ConversationRepository`. Branch needs `MessageRepository` to validate the branch-point message exists and has the right role/parentId. Change the constructor to `constructor(private repo: ConversationRepository, private messageRepo: MessageRepository)`. Update all existing callers (edit route handler, tests) accordingly. The `edit/route.ts` already passes both repos — that pattern is correct.

- **ID preservation on copy:** Messages copied from source to branch conversation must keep their original `id` and `parentId` values. Only `conversationId` changes. This ensures:
  - The parentId chain within the copied messages stays valid (messages reference each other by ID across the copy)
  - The branched-from assistant message retains `parentId` P, so future user messages in this branch can also use `parentId` P, becoming siblings
  - UI rendering works without remapping IDs

- **lastMessageId semantics:** After branching, `lastMessageId` on the new conversation points to the copied branch-point assistant message. This is the last message in the branch at creation time. When `ChatService.send` processes the next user message in this branch, it should update `lastMessageId` as usual (as implemented in Story 3.3).

- **rootConversationId propagation (FR-8):**
  - If source conversation C has no `rootConversationId` (it's a root), the branch gets `rootConversationId = C.id`
  - If C already has `rootConversationId` R (it's already a branch), the new branch gets `rootConversationId = R`
  - All branches in a tree share the same `rootConversationId` (the original root conversation's ID)
  - This is already implemented in `ConversationRepositoryImpl.branch` — no change needed for `rootConversationId` logic

- **`lastMessageId` not set on source during branch:** The source conversation's `lastMessageId` is NOT changed by branching. Branching is a fork — it does not modify the original conversation.

- **Message ordering in copy:** Use `createdAt ASC` to determine message order. Since messages may be bulk-inserted with the same timestamp, also sort by `createdAt ASC, id ASC` for deterministic ordering.

- **Architecture / layering (FR-21):** `ConversationService` continues to be a pure orchestrator. `ConversationRepository` now does the data-copy work (messages) which is a repository concern. Route handlers (`POST /api/conversations/[id]/branch`) remain thin — auth, parse, delegate, respond.

- **Dependency on Story 3.1 / 3.2:** This story depends on `ConversationRepositoryImpl` (Story 3.1) and `ConversationServiceImpl` (Story 3.2) existing. The `branch` interface is already declared in both. No new entities or repositories are introduced — only enhancements to existing ones.

- **API route pattern:** `POST /api/conversations/[id]/branch` follows the same pattern as `POST /api/conversations/[id]/edit` at `src/app/api/conversations/[id]/edit/route.ts`. Both are nested under a conversation ID, both use `auth()` → `getDatabase()` → instantiate repos → instantiate service → call method → respond.

- **Validation (FR-20):** `BranchRequestSchema` validates the request body at the route handler level. At the service level, business rule validation (role must be assistant, must have parentId) is explicit precondition checks.

- **Testing standards (FR-29/30/31, NFR-7/8):** Vitest, colocated `*.test.ts`. Repository tests use `createTestDataSource()` (real Postgres in-memory or test container). Service tests mock both `ConversationRepository` and `MessageRepository`. No network/real AI calls. Coverage gate ≥80%.

### Project Structure Notes

- **Files to modify:**
  - `src/services/conversation.service.ts` — implement `branch` method body; add `messageRepo` to constructor
  - `src/lib/db/repositories/conversation.repository.ts` — enhance `branch` to copy messages using `messageId`
  - `src/lib/validation/schemas.ts` — add `BranchRequestSchema` export
  - `src/services/conversation.service.test.ts` — add branch tests with mock MessageRepository
  - `src/lib/db/repositories/conversation.repository.test.ts` — add message-copying branch tests
  - `src/services/chat.service.test.ts` — update `createMockConversationRepo` test helper (no change needed, `branch` already in mock)
  - `src/services/message.service.test.ts` — update mock if `ConversationRepository` interface changes (no change expected)

- **Files to create:**
  - `src/app/api/conversations/[id]/branch/route.ts` — new route handler

- **Files that need no change (existing contracts already declare branch):**
  - `src/lib/db/entities/conversation.entity.ts` — already has `rootConversationId`, `lastMessageId`
  - `src/lib/db/entities/message.entity.ts` — already has `parentId`, `siblings` relation
  - `src/lib/db/repositories/message.repository.ts` — already has `findById`, `findByConversation`, `save`
  - `src/lib/db/repositories/asset.repository.ts` — unrelated
  - `src/services/chat.service.ts` — unrelated (branch is separate from send/regenerate)

- **Alignment with unified structure (`01-package.md`):** Matches `src/services` (use-case logic), `src/lib/db/repositories` (persistence), `src/lib/validation` (schemas), `src/app/api` (routes). No variance.

- **Conflicts/variances:** The `ConversationServiceImpl` constructor signature changes — all instantiation sites must be updated. In the codebase, the route handler at `src/app/api/conversations/[id]/edit/route.ts` already passes both repos, so it's compatible once the service constructor is updated.

### References

- Epic 4 Story 4.1 requirement — [_bmad-output/planning-artifacts/epics.md#Story 4.1](epics.md) (lines 476–490)
- FR-8 (sibling branching, rootConversationId) — [_bmad-output/planning-artifacts/epics.md#FR-8](epics.md) (line 35)
- FR-2 (userId scoping) — [_bmad-output/planning-artifacts/epics.md#FR-2](epics.md) (line 29)
- FR-9 (sibling-only sidebar) — [_bmad-output/planning-artifacts/epics.md#FR-9](epics.md) (line 36)
- FR-20 (Zod validation) — [_bmad-output/planning-artifacts/epics.md#FR-20](epics.md) (line 48)
- FR-21 (layered architecture) — [_bmad-output/planning-artifacts/epics.md#FR-21](epics.md) (line 48)
- Existing ConversationService interface (branch declared) — `src/services/conversation.service.ts` (lines 8–16)
- Existing ConversationService stub — `src/services/conversation.service.ts` (lines 49–51)
- Existing ConversationRepository branch (ignores messageId) — `src/lib/db/repositories/conversation.repository.ts` (lines 30–40)
- Existing ConversationRepository branch test — `src/lib/db/repositories/conversation.repository.test.ts` (lines 87–103)
- Conversation entity fields — `src/lib/db/entities/conversation.entity.ts` (lines 13–43)
- Message entity fields (parentId, siblings) — `src/lib/db/entities/message.entity.ts` (lines 8–52)
- Edit route pattern (reference for branch route) — `src/app/api/conversations/[id]/edit/route.ts` (lines 1–52)
- Testing standards (Vitest, colocated, ≥80% coverage, mocked externals) — [_bmad-output/planning-artifacts/epics.md#FR-29/FR-30/FR-31/NFR-7/NFR-8](epics.md) (lines 56–58, 71–72)
- E2E branch helper — `e2e/helpers/helpers.ts` (lines 35–38)

## Dev Agent Record

### Agent Model Used

subagent

### Debug Log References

TODO

### Completion Notes List

TODO

### File List

TODO
