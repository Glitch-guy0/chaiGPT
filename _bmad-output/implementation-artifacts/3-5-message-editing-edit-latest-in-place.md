# Story 3.5: Message Editing (Edit-Latest, In-Place)

Status: ready-for-dev

## Story

As a user,
I want to edit my latest user message in place,
So that I can correct a typo without creating a branch.

## Acceptance Criteria

1. **Given** the most recently created sibling user message in a conversation
   **When** `MessageService.editLatest(userId, convId, content)` runs
   **Then** only that message and its trailing assistant reply are updated content-only, preserving the same message IDs (FR-11).

2. **Given** `editLatest` completes
   **When** the conversation's branching structure is inspected
   **Then** branching is unaffected and `Conversation.lastMessageId` remains unchanged (FR-10, FR-11).

3. **Given** a conversation with earlier user messages
   **When** the UI or service evaluates editability
   **Then** only the latest user message is editable; all earlier messages are disabled (brief #7, UX-DR6).

4. **Given** a request to edit a non-latest message
   **When** `editLatest` is invoked against it (or the guard is checked)
   **Then** the edit is rejected / no-op and no message content is modified.

5. **Given** the trailing assistant reply is present
   **When** `editLatest` updates content
   **Then** the assistant reply content is overwritten/stale-aware (content-only) on the same ID, and further conversation continues from that latest sibling (FR-10, FR-11).

## Tasks / Subtasks

- [ ] Task 1: Add `editLatest` to the `MessageService` interface and concrete implementation (AC: #1, #2)
  - [ ] Subtask 1.1: Declare `editLatest(userId: string, convId: string, content: string): Promise<EditLatestResult>` in the E1 `MessageService` interface contract (epics.md Story 1.2).
  - [ ] Subtask 1.2: Implement `editLatest` in `src/services/MessageService.ts` returning the updated user message + trailing assistant message (same IDs).

- [ ] Task 2: Identify the latest user message via a repository query, scoped and branch-aware (AC: #1, #3, #4)
  - [ ] Subtask 2.1: Add `findLatestUserMessage(convId, userId)` (or `findLatestSibling(userId, convId, role='user')`) to `MessageRepository` (E1 `MessageRepository` contract, Story 1.2) honoring `userId` scoping (FR-2).
  - [ ] Subtask 2.2: Resolve the latest user message by `createdAt` DESC among siblings of the active branch (same `parentId` lineage / `rootConversationId`), not the whole tree — consistent with branch-aware model (FR-8, FR-9, Story 4.2).
  - [ ] Subtask 2.3: Add a guard: if the target message is not the latest user message, throw/return a rejected result (no mutation) (AC #4, brief #7).

- [ ] Task 3: Content-only update of the latest user message (AC: #1)
  - [ ] Subtask 3.1: Update only `content` (and `model`/`updatedAt` as needed) on the resolved user message; preserve `id`, `parentId`, `role`, `userId`, `conversationId`, `status` (FR-11).
  - [ ] Subtask 3.2: Persist via `MessageRepository.save` / `update` without changing the message ID or creating a new row.

- [ ] Task 4: Content-only update of the trailing assistant reply (AC: #1, #5)
  - [ ] Subtask 4.1: Locate the trailing assistant message (the assistant reply created directly after the latest user message under the same parent/branch) via repo query.
  - [ ] Subtask 4.2: Mark the assistant reply as stale (e.g. reset `content` to a placeholder / `status` to `processing` awaited by regenerate) OR leave it and let downstream regenerate overwrite it — content-only on the same ID, preserving the ID (FR-11).
  - [ ] Subtask 4.3: Do NOT create a new assistant sibling; reuse the existing trailing assistant ID so branching is unaffected (FR-10, FR-11).

- [ ] Task 5: Preserve branching and `lastMessageId` (AC: #2)
  - [ ] Subtask 5.1: Ensure `Conversation.lastMessageId` is NOT reassigned by `editLatest` (FR-10, FR-11) — update neither the conversation pointer nor `rootConversationId`.
  - [ ] Subtask 5.2: Ensure no new `parentId`/`rootConversationId` relationships are introduced (no branch creation) (FR-8, FR-10).

- [ ] Task 6: Route-handler + validation entry point (AC: #1, #3)
  - [ ] Subtask 6.1: Expose `editLatest` via a route handler (e.g. `app/api/conversations/[id]/messages/edit-latest/route.ts`) reading `userId` via the E1 `auth` contract (`auth()` from `@clerk/nextjs/server`, FR-1, FR-23).
  - [ ] Subtask 6.2: Validate the inbound request with a Zod schema (E1 `lib/validation/schemas.ts`, FR-20); enforce the 500-char limit (FR-7) on `content` before persistence.
  - [ ] Subtask 6.3: Return 404 when the conversation belongs to another user (FR-2, E2 `getById` behavior).

- [ ] Task 7: Unit tests with mocked externals (AC: all)
  - [ ] Subtask 7.1: Colocate `MessageService.test.ts` next to the service (FR-29); mock `MessageRepository`, `ConversationRepository`, `AiProvider`, Clerk, LangChain, Qdrant (FR-30, NFR-8).
  - [ ] Subtask 7.2: Assert: only latest user message + trailing assistant updated; IDs preserved; `lastMessageId` unchanged; non-latest edit rejected; branching structure unchanged.
  - [ ] Subtask 7.3: Maintain ≥80% coverage of `MessageService` (NFR-7, FR-31).

## Dev Notes

- **Layered architecture (FR-21, NFR-1):** Dependency direction is `app (route handlers) -> services -> {repositories | ai | vector | cache}`. No port/adapter layer. `MessageService` holds the edit use-case logic and depends on `MessageRepository` (and possibly `ConversationRepository` for a read-only `lastMessageId` check) via the E1 interfaces, never on concrete TypeORM directly.

- **Sibling / branch model (critical to "editing doesn't branch"):**
  - Sibling messages share the same `parentId`; branched conversations share `rootConversationId` (FR-8). An assistant message's `parentId` points to the user message that preceded it.
  - "Latest user message" = the most recently created (`createdAt` DESC) user-role message in the active branch lineage, resolved by `userId` + `conversationId` + `role='user'` + branch/parent scope (Story 4.2: only the most recently created sibling is updated; FR-10).
  - The "trailing assistant reply" is the assistant message whose `parentId` equals the latest user message's `id` (its direct child), created right after it.
  - `editLatest` mutates content in place on existing rows and never inserts new rows, so no new sibling/branch is created and `lastMessageId` is untouched (FR-10, FR-11). This is the key differentiator from `ConversationService.branch` (Story 4.1), which DOES create a new conversation + sibling.

- **Dependency on Story 3.1 repos:** `editLatest` builds directly on the `MessageRepository` implemented in Story 3.1 — specifically `findByConversation`, `save`, `updateStatus` (epics.md Story 3.1 AC). A new query method (`findLatestUserMessage` / `findLatestSibling`) extends that repo contract; it must continue to enforce `userId` scoping on every query (FR-2).

- **Interaction with Story 3.6 (Regenerate, FR-18):** After `editLatest` replaces the user content, the trailing assistant reply is now stale. The intended flow is for the client to call `ChatService.regenerate(messageId, userId)` (Story 3.6), which overwrites the SAME assistant message ID (`processing` -> `complete`) without creating a branch. `editLatest` itself should NOT auto-stream; it only performs the content-only mutation and leaves the stale assistant reply for the regenerate step (or marks it stale). Both operations preserve IDs and branching — they are complementary, not conflicting.

- **Interaction with Story 3.7 (Large-Paste-to-TXT, FR-7):** The `content` passed to `editLatest` must still respect the 500-char hard cap (FR-7). If the edited content exceeds 500 chars or a paste > 200 chars, the over-length portion is converted to a `.txt` asset (Story 3.7 / Story 5.1 upload pipeline) and the inline message body stays within 500 chars — same rule as `ChatService.send`. Edit-mode asset references on the trailing assistant reply remain visible with a remove option (FR-17, Story 5.6, UX-DR7).

- **Edit affordance (UX-DR6, brief #7):** Only the most recent user message is editable; earlier user messages and the trailing assistant's edit control are disabled in the UI (Story 6.4). The service-level guard in Task 2.3 enforces this server-side so the UI cannot edit non-latest messages even if it tried.

- **Status enum (FR-5):** `Message.status` is `'processing' | 'complete' | 'stopped'`. `editLatest` does not change the user message's `role` or the assistant's `status` by itself; regeneration (3.6) drives the assistant `status` lifecycle.

- **Testing standards (FR-29, FR-30, NFR-7, NFR-8):** Vitest, colocated `*.test.ts`, externals (OpenAI/LangChain, Qdrant, Jina, Clerk) mocked so tests run offline/deterministically. Coverage gate ≥80% on services + repositories enforced in CI (FR-31). Seedable `MessageRepository` fixtures from the E2.5 testing foundation.

### Project Structure Notes

- Aligns with the unified structure from `01-package.md`: `src/app/` (route handlers), `src/services/` (`MessageService.ts`), `src/lib/db/repositories/` (`MessageRepository.ts`), `src/lib/auth/` (Clerk session helper), `src/lib/validation/schemas.ts` (Zod), `src/types/` (shared `Role`, `ChatRequest` shapes from E1 1.4).
- No new top-level modules required; `editLatest` is a new method on existing `MessageService` and `MessageRepository` contracts defined in E1 (Story 1.2).
- Naming: method `editLatest(userId, convId, content)` matches the E1 `MessageService` shape list (`editLatest`) — keep signature stable for downstream UI (Epic 6) and regenerate (3.6) integration.
- No conflict with branching stories (Epic 4): `editLatest` deliberately avoids `ConversationService.branch`; if invoked inside a branched conversation it operates within that branch's active sibling set (Story 4.2), consistent with FR-10.

### References

- Epic 3 Story 3.5 — requirements (epics.md:428-442)
- Epic 1 Story 1.2 — `MessageService` / `MessageRepository` interface contracts incl. `editLatest` (epics.md:190-205)
- Epic 1 Story 1.1 — `Message` / `Conversation` entity shapes, `status` union (epics.md:172-188)
- Epic 1 Story 1.3 — `auth` contract `session()` returning `userId` (epics.md:206-226)
- Epic 1 Story 1.4 — Zod schemas in `lib/validation/schemas.ts`, `src/types` (epics.md:228-244)
- Epic 3 Story 3.1 — concrete `MessageRepository` (`findByConversation`, `save`, `updateStatus`), `userId` scoping (epics.md:362-377)
- Epic 3 Story 3.6 — Regenerate (overwrites same assistant ID, no branch, FR-18) (epics.md:444-457)
- Epic 3 Story 3.7 — 500-char limit & large-paste-to-txt (FR-7) (epics.md:458-471)
- Epic 4 Story 4.2 — edit targets most-recent sibling; branching continues (FR-10) (epics.md:490-503)
- Epic 4 Story 4.1 — branch creates new conversation + sibling (contrast with edit) (epics.md:476-489)
- FR-10 / FR-11 — edit updates only most-recent sibling, content-only, same IDs, branching & `lastMessageId` unchanged (epics.md:37-38)
- FR-2 — `userId` scoping on every query (epics.md:29)
- FR-5 — `Message.status` enum (epics.md:32)
- FR-7 — 500-char cap / large-paste-to-txt (epics.md:33)
- FR-8 / FR-9 — sibling `parentId`, `rootConversationId` branch model (epics.md:34-35)
- FR-20 — Zod validation of inbound requests (epics.md:47)
- FR-21 / NFR-1 — layered architecture, dependency direction (epics.md:48, 65)
- FR-29 / FR-30 / FR-31 / NFR-7 / NFR-8 — Vitest, colocated tests, mocked externals, ≥80% coverage (epics.md:56-58, 71-72)
- brief #7 — edit affordance / Markdown / only latest editable (epics.md:86, 97, UX-DR6)
- UX-DR6 / UX-DR7 — edit-latest affordance, edit-mode asset references (epics.md:97-98)
- Project Context — stack: Next.js 16 App Router, route handlers under `app/api/`, `@/*` path alias, TypeScript strict (project-context.md:9-22)

## Dev Agent Record

### Agent Model Used

subagent

### Debug Log References

TODO

### Completion Notes List

TODO

### File List

TODO
