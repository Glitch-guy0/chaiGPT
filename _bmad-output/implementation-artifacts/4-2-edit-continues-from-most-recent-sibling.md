# Story 4.2: Edit Continues from Most-Recent Sibling

Status: ready-for-dev

## Story

As a user,
I want edits to target the most recently created sibling,
So that branching continues from my latest message.

## Acceptance Criteria

1. **Given** multiple sibling messages under one `parentId` (after Story 4.1 branching)
   **When** the user edits via `MessageService.editLatest`
   **Then** only the most recently created sibling (by `createdAt` DESC among same `parentId`) is updated content-only, preserving the same message ID (FR-10, FR-11).

2. **Given** the most recent sibling was edited
   **When** further conversation continues
   **Then** assistant replies chain from that (now-edited) sibling — the sibling's `id` is the anchor for subsequent messages' `parentId` (FR-10).

3. **Given** a sibling set where an earlier (non-latest) sibling already has a branched conversation referencing it
   **When** a retry/edit is attempted on that earlier sibling
   **Then** the edit/regenerate is silently ignored / rejected — the system refuses to mutate a branched-from message (FR-10, FR-18).

4. **Given** a conversation with NO siblings (single linear chain — non-branched)
   **When** the user edits
   **Then** behavior is identical to Story 3.5: the one-and-only latest user message is updated, trailing assistant cleared (regression guard).

5. **Given** the user edits a message in a branched conversation
   **When** `editLatest` completes
   **Then** `Conversation.lastMessageId` is unchanged; no new conversation or `rootConversationId` is introduced (FR-11, NFR-1).

## Tasks / Subtasks

- [ ] **Task 1 — Repository: add `findLatestSibling` and `findSiblingsByParentId` queries** (AC: #1, #3, #4)
  - [ ] Subtask 1.1: Add `findLatestSibling(parentId: string, conversationId: string, userId: string): Promise<Message | null>` to `MessageRepository` interface — finds the most recently created (`createdAt` DESC) message with matching `parentId`, `conversationId`, `userId` (FR-2). Excludes `role` filter so it finds any-role siblings (needed to detect sibling existence for AC #3).
  - [ ] Subtask 1.2: Add `findSiblingsByParentId(parentId: string, conversationId: string, userId: string): Promise<Message[]>` to `MessageRepository` interface — returns all siblings under the same `parentId`, ordered by `createdAt` ASC, for use in active-branch detection and AC #3 guard.
  - [ ] Subtask 1.3: Implement both in `MessageRepositoryImpl` using TypeORM `find`/`findOne` with `where: { parentId, conversationId, userId }` and `order: { createdAt: 'DESC' }` / `ASC` — scoped to `userId` on every query (FR-2).

- [ ] **Task 2 — Refactor `MessageService.editLatest` to be branch-aware** (AC: #1, #2, #4)
  - [ ] Subtask 2.1: Change `editLatest` resolution from `findLatestUserMessage(conversationId, userId)` (global) to branch-aware sibling resolution: (a) get conversation's `lastMessageId`; (b) if set, trace the active leaf's parentId chain to determine the active `parentId` context; (c) find the latest user message that is a sibling in that active context via `findSiblingsByParentId` + filter `role: 'user'` pick most recent.
  - [ ] Subtask 2.2: If `lastMessageId` is null (empty conversation), fall back to original `findLatestUserMessage(conversationId, userId)` for backward compatibility.
  - [ ] Subtask 2.3: After resolving the target user message, confirm it is the MOST RECENT user sibling under its `parentId` using `findLatestSibling` — if not, reject the edit (throw `Error` / return 400) to satisfy AC #3 (non-latest sibling rejection).
  - [ ] Subtask 2.4: Content mutation is unchanged from Story 3.5: update `content` only on the target user message (same `id`), clear trailing assistant content on the same `id` (FR-11). No new message rows, no `parentId`/`lastMessageId` changes.

- [ ] **Task 3 — Guard: retries on already-branched messages are ignored** (AC: #3) (refs: epics.md FR-10, FR-18)
  - [ ] Subtask 3.1: In `editLatest`, before mutating, check if the resolved sibling has already been branched FROM — i.e., exists a `Message` whose `parentId` equals the resolved sibling's `id` AND that message's `conversationId` differs from current conversation (indicating a branch-away). If found, skip the edit silently (return `{ skipped: true }` or throw domain error).
  - [ ] Subtask 3.2: This check also applies to `ChatService.regenerate` for Epic 4.3 — but for Story 4.2, implement the check only in `editLatest` (call it a `isBranchedAway` helper or inline); the regenerate guard will be extended in Story 4.3.
  - [ ] Subtask 3.3: The check queries: `messageRepo.findByParentId(siblingId)` (to be added in subtask 1.2 — `findSiblingsByParentId`) and checks if any result has `conversationId != currentConvId`. If yes → branched-away, skip.

- [ ] **Task 4 — Route handler stays unchanged; no new route** (AC: all) (refs: `src/app/api/conversations/[id]/edit/route.ts`)
  - [ ] Subtask 4.1: The existing `PATCH /api/conversations/[id]/edit` route handler in `src/app/api/conversations/[id]/edit/route.ts` already calls `MessageServiceImpl.editLatest(userId, id, content)`. No route changes needed — the refactored service handles branch-aware logic.
  - [ ] Subtask 4.2: Validation remains: `EditSchema` enforces `content: z.string().min(1).max(500)` (FR-7). No schema changes needed.

- [ ] **Task 5 — Tests: branch-aware `editLatest`** (AC: all) (refs: epics.md FR-29/30/31, NFR-7/8)
  - [ ] Subtask 5.1: Extend `src/services/message.service.test.ts` with new describe block `"branch-aware editLatest"`. Add `findLatestSibling`, `findSiblingsByParentId`, `findByParentId` mocks to `createMockMessageRepo()`.
  - [ ] Subtask 5.2: Test AC #1 — mock 3 siblings under same `parentId` (e.g., parentId "P-1" with user siblings created at T1, T2, T3). Assert `editLatest` picks the T3 sibling, updates only its content, leaves T1/T2 siblings untouched.
  - [ ] Subtask 5.3: Test AC #2 — after edit, assert `lastMessageId` unchanged, no new conversation created, no new rows in messageRepo.save beyond the 2 existing rows (user + assistant).
  - [ ] Subtask 5.4: Test AC #3 — mock a sibling that has been branched away (a message with `parentId = siblingId` but different `conversationId`). Assert edit is rejected/skipped.
  - [ ] Subtask 5.5: Test AC #4 — regression: single linear chain (no siblings) behaves identically to Story 3.5 — same assertions as existing `editLatest` tests.
  - [ ] Subtask 5.6: Test AC #5 — assert `conversationRepo.save` is never called (lastMessageId unchanged).
  - [ ] Subtask 5.7: Repository-level tests: extend `message.repository.test.ts` with `findLatestSibling`, `findSiblingsByParentId` query tests against seeded sibling data, confirming `userId` scoping.

- [ ] **Task 6 — E2E test (branch-aware edit scenario)** (refs: epics.md FR-32/33/34)
  - [ ] Subtask 6.1: Add an E2E scenario: branch from assistant → create sibling user message → edit the sibling → assert correct sibling was modified (verify content via GET conversation).
  - [ ] Subtask 6.2: Add E2E scenario: branch from assistant → create sibling → try to edit the original (pre-branch) user message → assert edit is rejected (no-op or 400).

## Dev Notes

- **Branch model context (CRITICAL):** In the branching model (Story 4.1), each branch is a separate `Conversation` sharing `rootConversationId`. Within a conversation, sibling messages share the same `parentId`. Siblings can be of any role (user, assistant). `editLatest` must distinguish between:
  - The "current branch tip" — traced via `Conversation.lastMessageId` → walk `parentId` chain → determine the active leaf's parent context.
  - "Siblings under same parentId" — messages (user, assistant, any role) where `message.parentId === X`. Among these, the most recently created user-role sibling is the editable candidate.
  - "Branched-away" — a sibling under a `parentId` that has been used as the source of a branch (another conversation references it). These are frozen — no edits allowed.

- **How `editLatest` changes from Story 3.5 to Story 4.2:**

  **Before (Story 3.5 — global latest):**
  ```
  1. findLatestUserMessage(convId, userId)  // global, ignores parentId structure
  2. update content
  3. findTrailingAssistantMessage(convId, userMsg.id, userId)
  4. clear assistant content
  ```

  **After (Story 4.2 — branch-aware sibling):**
  ```
  1. Get conversation (existing)
  2. Determine active branch parentId context from lastMessageId chain
  3. find all user-role siblings under that parentId context
  4. Pick the sibling with latest createdAt
  5. Verify: is this the MOST RECENT sibling among all roles under this parentId?
     (use findLatestSibling — if it's not a user message or has different id → reject)
  6. Verify: has this sibling been branched away? (check findByParentId for foreign conversationId)
  7. If all guards pass: update content, clear trailing assistant (same as 3.5)
  ```

  The key addition: **Step 2, 5, 6** — active-branch context resolution, most-recent-sibling guard, and branched-away guard.

- **Active-branch resolution strategy:**
  - Given `conversation.lastMessageId`, fetch that message.
  - If the message is an assistant message, its `parentId` points to the preceding user message. That preceding user message is the active user sibling.
  - If the message is a user message, it IS the active user sibling.
  - Among siblings sharing that `parentId`, the latest user sibling = target for editing. If there are multiple user siblings (e.g., user-edited a message, creating a new user sibling under the same parent), only the latest one is editable.

- **Sibling set vs. all messages in conversation:** `findSiblingsByParentId(parentId, convId, userId)` returns only messages sharing a specific parent — this is the sibling set. The "latest sibling" is the most recent message (any role) under that parentId. The "latest user sibling" is the most recent user-role message under that parentId.

- **Dynamic query addition for `MessageRepository`:**
  - `findLatestSibling(parentId, conversationId, userId)` — returns single most recent message under parentId (used for guard in AC #1).
  - `findSiblingsByParentId(parentId, conversationId, userId)` — returns all messages under parentId (used for active sibling set).
  - `findByParentId(parentId, userId)` — returns all messages with this parentId across ALL conversations (used for branched-away detection in AC #3). This cross-conversation query is an exception to the single-conversation scope — it intentionally checks if ANY conversation branched from this message.

- **Existing method `findLatestUserMessage` is NOT removed** — it is still used as a fallback when `lastMessageId` is null or the active-branch resolution fails (empty conversation). However, its use is deprecated for branch-aware conversations. Consider marking it internal/narrow it later.

- **No new route handler needed.** The existing `PATCH /api/conversations/[id]/edit` route at `src/app/api/conversations/[id]/edit/route.ts` calls `editLatest(userId, id, content)` which is the method being refactored. Client-side changes (UI edit affordance) are Story 6.4.

- **Dependency on Story 4.1:** This story depends on `Conversation.lastMessageId` being correctly maintained by the branching flow (Story 4.1 ensures this). It also depends on `ConversationRepository.branch` creating sibling relationships correctly.

- **Dependency on Story 3.5:** This story builds directly on the `editLatest` implementation from Story 3.5. The existing `EditLatestResult` type, `MessageService.editLatest` interface signature, and route handler are preserved. Only the internal resolution logic changes.

- **Asset references and edit mode (FR-17):** If the edited user message has asset references (Story 3.7), they are carried forward as-is — `editLatest` updates only `content` on the user message and clears content on the trailing assistant reply. Asset reference lifecycle (remove in edit mode) is Story 5.6.

- **Status enum (FR-5):** `editLatest` does not change `role` or `status` on any message. Only `content` and `updatedAt` change. Assists remain as-is (content cleared to empty, status preserved).

- **500-char limit (FR-7):** The existing `content.length > 500` guard in `MessageService.editLatest` remains. Branch-aware editing does not change content validation rules.

- **Error handling:**
  - Branched-away message edit → throw `Error('Cannot edit a message that has been branched from')` → route handler returns 400.
  - Non-latest sibling edit → throw `Error('Can only edit the most recent sibling')` → route handler returns 400.
  - Conversation not found → `NotFoundError` → 404 (existing).
  - No user messages found → `NotFoundError` → 404 (existing).

### Project Structure Notes

- **Alignment:** Refactoring `MessageService.editLatest` internal logic only; no new files required. Repository methods added to existing `MessageRepository` interface + `MessageRepositoryImpl`. Same file structure as E1/E3.
- **Conflicts / variances:** The cross-conversation query `findByParentId(parentId, userId)` breaks the single-conversation scope convention used by all other MessageRepository queries. This is intentional and necessary for branched-away detection. Document this as the sole exception.
- **Query naming:** `findLatestSibling` (no role filter) vs. `findLatestUserMessage` (filtered role='user') are distinct. Use precise naming to avoid confusion.
- **Test mocking:** The new `findLatestSibling`, `findSiblingsByParentId`, and `findByParentId` methods must be added to the mock factory in tests.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 Story 4.2] — FR-10, FR-18 requirements, AC (L490–503).
- [Source: _bmad-output/planning-artifacts/epics.md#FR-10] — "Editing updates only the most recently created sibling; branching continues from that message." (L37).
- [Source: _bmad-output/planning-artifacts/epics.md#FR-11] — "Editing is content-only, in place (same IDs); does not affect branching; lastMessageId unchanged." (L38).
- [Source: _bmad-output/planning-artifacts/epics.md#FR-18] — "A stopped assistant message is re-runnable… does not create a branch." (L45).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 Story 4.1] — Branch creates new conversation + sibling under same parentId (L476–489).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3 Story 3.5] — Original `editLatest` implementation (L428–443). This story refactors the internal logic.
- [Source: _bmad-output/planning-artifacts/epics.md#FR-2] — userId scoping on every query (L29).
- [Source: _bmad-output/planning-artifacts/epics.md#FR-7] — 500-char cap on content (L34).
- [Source: _bmad-output/implementation-artifacts/3-5-message-editing-edit-latest-in-place.md] — Story 3.5 implementation, `editLatest` signature, `EditLatestResult` type, route handler.
- [Source: src/services/message.service.ts] — Current `editLatest` implementation (L24–46). Target of refactoring.
- [Source: src/services/message.service.test.ts] — Existing `editLatest` tests (L77–170). Extend for branch-aware.
- [Source: src/lib/db/repositories/message.repository.ts] — Current repository interface + impl (L6–51). Add `findLatestSibling`, `findSiblingsByParentId`, `findByParentId`.
- [Source: src/lib/db/entities/message.entity.ts] — Message entity with `parentId` column for sibling relationships (L1–52).
- [Source: src/lib/db/entities/conversation.entity.ts] — Conversation entity with `lastMessageId` for active-branch tip tracking (L1–43).
- [Source: src/app/api/conversations/[id]/edit/route.ts] — Existing edit route handler — no changes needed (L1–52).
- [Source: src/app/api/chat/regenerate/[messageId]/route.ts] — Regenerate route (referenced for AC #3 interaction) (L1–45).

## Dev Agent Record

### Agent Model Used

subagent

### Debug Log References

TODO

### Completion Notes List

TODO

### File List

- `src/lib/db/repositories/message.repository.ts` — add `findLatestSibling`, `findSiblingsByParentId`, `findByParentId` to interface + impl
- `src/services/message.service.ts` — refactor `editLatest` internal resolution to be branch-aware
- `src/services/message.service.test.ts` — add branch-aware edit tests
- `src/lib/db/repositories/message.repository.test.ts` — add sibling query tests
