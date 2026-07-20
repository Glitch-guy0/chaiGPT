# Story 4.3: Regenerate Within a Branch

Status: ready-for-dev

## Story

As a user,
I want to regenerate a stopped message inside a branch,
So that I can retry without leaving the branch.

## Acceptance Criteria

1. **Given** a stopped assistant message within a branched conversation (message has `parentId` set, conversation has `rootConversationId`), **When** `ChatService.regenerate(messageId, userId)` runs, **Then** the same `messageId` is set to `status: processing`, re-streamed via SSE, and overwritten with `status: complete` — same in-place mutation as Story 3.6, no new branch created (FR-18, epics.md L512-514).

2. **Given** the regenerated message belongs to a branch chain, **When** history is built for the AI prompt, **Then** only ancestor messages (walked via `parentId` chain) are included — sibling messages from parallel branches are excluded (branch-aware history, FR-8/FR-11).

3. **Given** a `messageId` whose `parentId` chain is empty (root-level message, non-branched), **When** regenerate runs, **Then** behavior is identical to 3.6 — `findByConversation` fallback for backward compatibility (FR-18).

4. **Given** a stopped assistant message whose `parentId` chain includes a deleted/orphaned parent, **When** regenerate builds history, **Then** the chain-walk terminates gracefully — available ancestors are included, the orphan gap is omitted (no crash, FR-8 graceful degradation).

5. **Given** a `messageId` that does not belong to `userId`, **When** regenerate runs, **Then** 404 returned (FR-2 user-scoping, same as 3.6 AC #3).

6. **Given** a `messageId` whose `status` is not `stopped`, **When** regenerate runs, **Then** rejected as no-op (FR-18, same as 3.6 AC #4).

7. **Given** an active SSE stream during regenerate within a branch, **When** client terminates, **Then** `"user terminated the response"` with `status: stopped` overwrites the same `messageId` — same termination semantics as 3.6 AC #5 (FR-6).

8. **And** streaming honors time-to-first-token < 1 s (NFR-5), reuses the existing `createStream` path (no diverging implementation), token buffer and SSE events identical to 3.6.

9. **And** `parentId`, `conversationId`, `role`, `userId` are preserved untouched on the overwritten message (no-branch invariant).

## Tasks / Subtasks

- [ ] **Task 1: Add `findMessageChain` to MessageRepository (AC: #2, #3, #4)**
  - [ ] 1.1 Add `findMessageChain(conversationId: string, fromMessageId: string, userId: string): Promise<Message[]>` to the `MessageRepository` interface in `src/lib/db/repositories/message.repository.ts`.
  - [ ] 1.2 Implement in `MessageRepositoryImpl`: load the message by `fromMessageId` + `userId`, then iteratively walk `parentId` references (TypeORM `findOne({ where: { id: message.parentId, userId, conversationId } })`) until `parentId` is null or the root is reached.
  - [ ] 1.3 Return messages in chronological order (root-first, deepest-child-last) — same ordering as `findByConversation` so the AI gets a coherent history.
  - [ ] 1.4 Implement iterative walk (not recursive) to avoid stack-depth issues — max 500 iterations guard (practical branch limit).
  - [ ] 1.5 If `parentId` is null on the starting message (non-branched), fall back to `findByConversation` for backward compatibility (AC #3).
  - [ ] 1.6 Handle orphaned parent gracefully: if `parentId` references a missing message, log a warning and terminate chain at that point (AC #4).

- [ ] **Task 2: Update `ChatService.regenerate` for branch-aware history (AC: #1, #2, #3)**
  - [ ] 2.1 In `src/services/chat.service.ts`, replace `messageRepo.findByConversation(message.conversationId, userId)` on line 210 with a branch-aware call:
    - If `message.parentId` is set, call `messageRepo.findMessageChain(message.conversationId, message.id, userId)`.
    - If `message.parentId` is null/undefined, use existing `findByConversation` (AC #3 backward compat).
  - [ ] 2.2 The built `messages` array for AI must preserve the same ordering: system prompt → (optional RAG context) → ancestor messages in chronological order.
  - [ ] 2.3 Verify `createStream(messageId, messages, userId)` is called with same `messageId` (in-place overwrite) — no new branch, no new conversation, no call to `ConversationService.branch` (AC #1).
  - [ ] 2.4 **Critical:** Do NOT introduce a new `ConversationService.branch` call — the regenerate flow within a branch stays in the same conversation, same message ID (FR-18, no-branch invariant from 3.6).

- [ ] **Task 3: Verify route handler needs no changes (AC: #1, #5)**
  - [ ] 3.1 The existing `POST /api/chat/regenerate/:messageId` route handler (`src/app/api/chat/regenerate/[messageId]/route.ts`) already delegates to `ChatService.regenerate(messageId, userId)`. No routing change needed.
  - [ ] 3.2 Confirm 401/404/400 error handling remains unchanged from 3.6.

- [ ] **Task 4: Tests (AC: #1–#9)**
  - [ ] 4.1 Unit test (Vitest, colocated): `findMessageChain` walks parentId chain correctly — mock 3 messages chained via `parentId`, assert returned in root-first order, assert sibling messages excluded.
  - [ ] 4.2 Unit test: `findMessageChain` falls back to `findByConversation` when `parentId` is null (AC #3).
  - [ ] 4.3 Unit test: `findMessageChain` handles orphaned parent gracefully — chain stops at gap, no throw (AC #4).
  - [ ] 4.4 Unit test: `ChatService.regenerate` within a branch — stopped assistant message with `parentId` set → status flips to processing, `findMessageChain` called instead of `findByConversation`, same-id overwrite on completion, no new message row created (AC #1, #2).
  - [ ] 4.5 Unit test: `ChatService.regenerate` within a branch on abort — `parentId` preserved, `stopped` status set on same ID, no branch (AC #7).
  - [ ] 4.6 Unit test: Non-stopped status rejected; non-owned message 404 — same as 3.6 (AC #5, #6).
  - [ ] 4.7 Unit test: `findByConversation` NOT called when `parentId` is set — verify `findMessageChain` is used instead (ensures branch-aware path is taken).
  - [ ] 4.8 Coverage of new code paths kept ≥80% per service/repo gate (NFR-7, FR-31).
  - [ ] 4.9 (Optional) Playwright e2e: send message → branch → regenerate stopped message in branch → confirm same message displayed, no new branch created (FR-32/FR-33, NFR-9).

## Dev Notes

- **What changes from Story 3.6:** The core `regenerate` method already exists and works for flat conversations. This story replaces the history-building step (`findByConversation` → `findMessageChain`) to make it branch-aware. Everything else — status lifecycle, SSE streaming, same-ID overwrite, termination semantics — is identical to 3.6.

- **Branch-aware history (the critical change):** In a branched conversation, `findByConversation` returns ALL messages including those from sibling branches. This would confuse the AI with out-of-context messages from parallel branches. Instead, `findMessageChain` walks the `parentId` pointer from the regenerated message back to the root, returning only direct ancestors. This is the single architectural change that distinguishes 4.3 from 3.6.

- **No-branch invariant (unchanged from 3.6):** The regenerate flow overwrites the existing message row in place. It does NOT call `ConversationService.branch()`, does NOT create a new sibling, does NOT change `conversationId` or `parentId`. This invariant is already enforced in 3.6 and must be preserved.

- **`findMessageChain` implementation detail (iterative walk):**
  ```
  function findMessageChain(conversationId, fromMessageId, userId):
    const result = []
    let current = fromMessageId
    let guard = 0
    while (current && guard++ < 500):
      const msg = repo.findOne({ id: current, userId, conversationId })
      if (!msg) break  // orphan guard
      result.unshift(msg)  // prepend so final order is root-first
      current = msg.parentId
    return result
  ```
  - The `parentId` field is nullable (Message entity, line 18-19). When null, the message is a root-level message — fall back to `findByConversation`.
  - Prepending (unshift) during the walk produces chronological order (root first) without a final reverse.

- **Dependencies:** Story 4.3 builds directly on:
  - 3.6 — `ChatService.regenerate` method (src/services/chat.service.ts:200-221) — the method being modified.
  - 3.1 — `MessageRepository` with `findById`, `findByConversation`, `save`, `updateStatus` (src/lib/db/repositories/message.repository.ts:6-14).
  - 3.3 — `ChatService.createStream` private method (src/services/chat.service.ts:114-193) — reused unchanged.
  - 4.1 — Branch entity support (`parentId` on Message, `rootConversationId` on Conversation) — these fields already exist in entities.
  - 4.2 — Most-recent-sibling semantics (not directly needed but adjacent — regenerate in a branch does not need to find latest sibling, it targets a specific `messageId`).

- **Source tree (files to modify):**
  - `src/lib/db/repositories/message.repository.ts` — add `findMessageChain` to interface (L6-14) + implement in `MessageRepositoryImpl` (L16+).
  - `src/services/chat.service.ts` — modify line 210: replace `this.messageRepo.findByConversation(message.conversationId, userId)` with branch-aware history dispatch (Task 2).
  - `src/services/chat.service.test.ts` — add branch-aware regenerate tests in the `regenerate` describe block (L554+).
  - `src/lib/db/repositories/message.repository.test.ts` — add `findMessageChain` unit tests (L57+).

- **Files NOT modified (reused as-is):**
  - `src/app/api/chat/regenerate/[messageId]/route.ts` — unchanged from 3.6.
  - `src/lib/ai/langchain.ts` — unchanged.
  - `src/services/conversation.service.ts` — unchanged (no branch call in regenerate).
  - `src/lib/db/entities/message.entity.ts` — unchanged (`parentId` already exists).
  - `src/lib/db/entities/conversation.entity.ts` — unchanged.

- **Testing standards (from epics.md FR-29..FR-31, NFR-7/8):** Vitest, colocated `*.test.ts`; mock OpenAI/LangChain, Qdrant, Jina, Clerk so tests run offline/deterministically; ≥80% coverage of services+repositories enforced in CI; Playwright e2e optional smoke (FR-32/FR-33).

### Project Structure Notes

- Aligns with unified layered structure: `app` (route handler, unchanged) → `ChatService` → `MessageRepository`. No new layers, no new service classes.
- The `findMessageChain` method is a natural extension of `MessageRepository` — it belongs in the repository layer alongside `findByConversation`, not in the service layer. This keeps the service orchestrating rather than walking pointers.
- No conflict with Epics 5/6/7 — this is a self-contained extension of existing regenerate logic.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 Story 4.3] — AC L504-514 (FR-18 regenerate within branch, no new branch).
- [Source: _bmad-output/planning-artifacts/epics.md#FR-18] — "Re-run a stopped assistant message overwriting same message ID in place" (L45).
- [Source: _bmad-output/planning-artifacts/epics.md#FR-8] — Branching creates sibling under same `parentId`, shares `rootConversationId` (L35).
- [Source: _bmad-output/planning-artifacts/epics.md#FR-11] — Branches scoped to same `userId` (L38).
- [Source: _bmad-output/planning-artifacts/epics.md#FR-2] — User scoping on all operations (L32).
- [Source: _bmad-output/planning-artifacts/epics.md#FR-6] — Termination semantics (L33-34).
- [Source: _bmad-output/implementation-artifacts/3-6-regenerate-stopped-message-re-run-same-id.md] — Full 3.6 implementation reference, identical in-place overwrite pattern.
- [Source: src/services/chat.service.ts#L200-L221] — Current `regenerate` implementation (3.6).
- [Source: src/services/chat.service.ts#L210] — Line to change: `findByConversation` call.
- [Source: src/lib/db/repositories/message.repository.ts#L6-L14] — `MessageRepository` interface to extend.
- [Source: src/lib/db/entities/message.entity.ts#L18-L19] — `parentId` nullable column on Message.
- [Source: src/lib/db/entities/conversation.entity.ts#L20-L21] — `rootConversationId` nullable column on Conversation.
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml#L84] — Story 4.3 status: `backlog`.
- [Source: src/services/chat.service.test.ts#L554-L645] — Existing regenerate tests (3.6 pattern to extend).

## Dev Agent Record

### Agent Model Used

subagent

### Debug Log References

TODO

### Completion Notes List

TODO

### File List

TODO
