# Story 3.6: Regenerate Stopped Message (Re-run, Same ID)

Status: ready-for-dev

## Story

As a user,
I want to regenerate a stopped assistant message,
So that I can get a fresh completion without making a branch.

## Acceptance Criteria

1. **Given** an assistant message with `status: stopped`, **When** `ChatService.regenerate(messageId, userId)` runs, **Then** the same `messageId` is set to `status: processing`, re-streamed via SSE, and overwritten with `status: complete` (FR-18, epics.md L450-454).
2. **And** no new sibling message or conversation branch is created — the original message row is mutated in place (FR-18, epics.md L455-456).
3. **Given** a `messageId` that does not belong to `userId`, **When** `regenerate` runs, **Then** the call returns a 404 / scoped-not-found error and no status change occurs (FR-2 user-scoping, E1 `findById(id, userId)` contract).
4. **Given** a `messageId` whose current `status` is not `stopped` (e.g. `complete` or `processing`), **When** `regenerate` runs, **Then** the call is rejected (no-op) so that only stopped messages are re-runnable (FR-18 re-runnable semantics; mirrors Epic 4.2 "retries on an already-branched message are ignored").
5. **Given** an active SSE stream in progress for `regenerate`, **When** client termination occurs, **Then** the same overwrite-with-`stopped` semantics from `send` apply: content `"user terminated the response"` with `status: stopped`, preserving the same `messageId` (FR-6 termination contract, reused from 3.3).
6. **And** streaming honors the same time-to-first-token < 1 s budget as `send` (NFR-5), reusing the 3.3 streaming path rather than a diverging implementation.
7. **And** tokens stream to the client via SSE live AND accumulate in a server-side `streamBuffer`, exactly as in `ChatService.send` (FR-19; 03-sequence.md L35-46).

## Tasks / Subtasks

- [ ] Task 1: Validate preconditions and user-scoping (AC: #1, #3, #4)
  - [ ] 1.1 In `ChatService.regenerate(messageId, userId)`, load the message via `MessageRepository.findById`/`findByConversation` with `userId` scoping; return 404/not-found when unscoped (FR-2, E1 interface `findById(id, userId)`).
  - [ ] 1.2 Assert the loaded message has `role: assistant` and `status === 'stopped'`; reject (no-op) otherwise (AC #4, FR-18, Epic 4.2 retry-ignored rule).
  - [ ] 1.3 Confirm `conversationId` is resolvable for building history/context (no new branch — AC #2).

- [ ] Task 2: Flip status to processing and reuse the 3.3 send/stream pipeline (AC: #1, #6, #7)
  - [ ] 2.1 Call `MessageRepository.updateStatus(messageId, 'processing')` on the **same id** (03-sequence.md L143).
  - [ ] 2.2 Reuse the existing `ChatService.send` streaming routine / shared private helper (build messages + RAG context, `AiProvider.streamChat(messages, onChunk)`, token buffer) rather than duplicating streaming logic. See `ChatService.send` (Story 3.3, 03-sequence.md L34-46) and `AiProvider.streamChat` (Story 3.4, E1 contract).
  - [ ] 2.3 Stream each token to the client via SSE and append to the local `streamBuffer` (FR-19, NFR-5).

- [ ] Task 3: Overwrite content in place, same ID, status complete (AC: #1, #2)
  - [ ] 3.1 After the stream closes, persist the assembled `streamBuffer` as the message content with `status: complete` **on the same `messageId`** — use an update/overwrite path, NOT a new append (03-sequence.md L152; FR-18).
  - [ ] 3.2 Assert no new `Message` row / sibling is created; verify `parentId` and `conversationId` remain unchanged (no-branch constraint, FR-8/FR-18).
  - [ ] 3.3 Emit SSE `[DONE]` terminator (FR-19).

- [ ] Task 4: Apply termination/stopped semantics identically to send (AC: #5)
  - [ ] 4.1 On explicit client termination during regenerate, flush `"user terminated the response"` with `status: stopped` on the same id (FR-6 reused from 3.3).
  - [ ] 4.2 Ensure no partial new sibling is left behind on termination.

- [ ] Task 5: Wire route handler + auth (AC: #1, #3)
  - [ ] 5.1 Add `POST /api/chat/regenerate/:messageId` route handler that resolves `userId` via `auth()` (Clerk, FR-1/FR-23) and delegates to `ChatService.regenerate(messageId, userId)` (03-sequence.md L139-142).
  - [ ] 5.2 Return 401/redirect for unauthenticated (FR-3); 404 for non-owned message.

- [ ] Task 6: Tests (AC: #1–#7)
  - [ ] 6.1 Unit test (Vitest, colocated `*.test.ts`): stopped message → processing → complete, same id, content overwritten (FR-29).
  - [ ] 6.2 Unit test: no new sibling/branch created (assert row count unchanged, same id) (FR-18).
  - [ ] 6.3 Unit test: non-stopped status rejected; non-owned message 404 (FR-2).
  - [ ] 6.4 Mock AiProvider, QdrantStore, RedisCache, Clerk in unit tests — offline/deterministic (FR-30, NFR-8).
  - [ ] 6.5 Coverage of `regenerate` path kept ≥80% per service/repo gate (NFR-7, FR-31).
  - [ ] 6.6 (Optional) Playwright e2e smoke: regenerate a stopped message overwrites same id without branching (FR-32/FR-33, NFR-9).

## Dev Notes

- **Architecture:** Layered, Next.js App Router → `ChatService` (src/services) → `MessageRepository` (src/lib/db/repositories) + `AiProvider` (src/lib/ai/langchain.ts). No port/adapter layer; coupling to Next.js/TypeORM is approved (FR-21, 05-architecture.md).
- **Core contract — `ChatService.regenerate(messageId: string, userId: string)`**: This story adds the `regenerate` method declared in the E1 `ChatService` interface (epics.md L202: `send`, `regenerate`, etc.) and `02-class.md` ChatService (L132: `+regenerate(messageId)`). It is a thin orchestration over the **existing** `send` streaming path:
  1. Load+scope the message (fail if not `stopped`).
  2. `MessageRepository.updateStatus(messageId, 'processing')` — same id.
  3. Build full message history + RAG context (per-conversation, k=3) exactly as `send` (03-sequence.md #1, #6).
  4. `AiProvider.streamChat(messages, onChunk)`; accumulate `streamBuffer`; forward tokens as SSE.
  5. `MessageRepository` update content=`streamBuffer` + `status: 'complete'` — **same id, in place**.
  - Termination reuses FR-6: `"user terminated the response"` + `status: stopped`, same id.
- **Same-ID overwrite (critical):** The persistence step MUST be an update/overwrite of the existing `Message` row keyed by `messageId`. Do NOT call `MessageRepository.append(...)` to create a new assistant row, and do NOT invoke `ConversationService.branch(...)` (FR-8/FR-18). `parentId`, `conversationId`, `role`, `userId` are preserved untouched.
- **No-branch constraint (critical):** The regenerate flow deliberately omits the branch path. It operates on the existing conversation and existing message only. This is what distinguishes it from Story 4.1 (branch) and keeps it consistent with Epic 4.3 (regenerate within a branch also overwrites in place, no new branch).
- **Reuse (not reimplement):** Streaming, RAG retrieval + Redis cache, and AiProvider invocation should be factored into the shared send/stream helper so `send` and `regenerate` share one implementation. Avoid divergence that would break NFR-5 time-to-first-token parity.
- **Dependencies already delivered by prerequisite stories:**
  - 3.1 — Concrete `MessageRepository` with `updateStatus(id, status)` and `findByConversation` (epics.md L376).
  - 3.3 — `ChatService.send` SSE streaming + status lifecycle + `streamBuffer` (epics.md L394-412).
  - 3.4 — `AiProvider.streamChat(messages, onChunk)` concrete LangChain module (epics.md L414-426).
  - 3.5 — `MessageService.editLatest` establishes the edit/regenerate UX adjacency (edit-latest, in-place) that `regenerate` parallels (no branch).
- **Source tree (from 02-class.md / 05-architecture.md):**
  - `src/services/ChatService.ts` — add/implement `regenerate`.
  - `src/lib/db/repositories/MessageRepository.ts` — `updateStatus`, `findByConversation` (existing).
  - `src/lib/ai/langchain.ts` — `AiProvider.streamChat` (existing, 3.4).
  - `src/lib/vector/qdrant.ts` — `QdrantStore.search` (existing, FR-14).
  - `src/lib/cache/redis.ts` — `RedisCache.get/set` (existing, 5.4).
  - `src/app/api/chat/regenerate/[messageId]/route.ts` — new route handler (05-architecture.md routes layer).
  - `src/types` / `lib/validation/schemas.ts` — `ChatRequest`/`MessageStatus` types (existing, E1).
- **Testing standards (from epics.md FR-29..FR-31, NFR-7/8):** Vitest, colocated `*.test.ts`; mock OpenAI/LangChain, Qdrant, Jina, Clerk so tests run offline/deterministically; ≥80% coverage of services+repositories enforced in CI; Playwright e2e optional smoke (FR-32/FR-33).

### Project Structure Notes

- Aligns with unified layered structure: `app -> services -> {repositories | ai | vector | cache}` (01-package.md, 05-architecture.md L47-53). `regenerate` adds no new layer — it is a method on `ChatService` plus one new route handler, consistent with the existing `chat` route.
- No conflict with branching (Epic 4): `regenerate` intentionally avoids `branch()`; Epic 4.3 reuses this exact behavior inside a branch. Keep the no-branch invariant explicit in code (do not call `ConversationService.branch`).
- `Message.status` enum (`processing | complete | stopped`) is defined in E1 (epics.md L188, 02-class.md `MessageStatus` L54-59). `regenerate` only accepts `stopped` as input and only emits `processing`→`complete` (or `stopped` on termination).

### References

- epics.md L444-456 — Story 3.6 definition and acceptance criteria (FR-18).
- epics.md L33-34 — FR-5/FR-6 message status enum + lifecycle (`processing`/`complete`/`stopped`, `"user terminated the response"`).
- epics.md L45 — FR-18 re-runnable stopped message, overwrite same id, no branch.
- epics.md L122, L201-202 — FR-18 coverage (E3, E4); E1 `ChatService` method shapes incl. `regenerate`, `send`.
- epics.md L188, L200, L216 — E1 Message `status` union; `ConversationRepository`/`MessageRepository` `findById(id, userId)` + `updateStatus`; `AiProvider.streamChat`.
- epics.md L362-456 — prerequisite stories 3.1 (repos), 3.3 (send/SSE/status), 3.4 (AiProvider), 3.5 (edit-latest).
- epics.md L474-514 — Epic 4 (branching) and 4.3 regenerate within a branch reuses this behavior.
- 02-class.md L54-59 (`MessageStatus`), L97-108 (`Message`), L124-133 (`ChatService` + `regenerate`), L169-174 (`MessageRepository`), L187-191 (`AiProvider`).
- 03-sequence.md L5-49 — Send flow (shared streaming/buffer/termination reused by regenerate).
- 03-sequence.md L128-155 — Sequence #5 "Regenerate a Stopped Message (re-run, same ID)" — authoritative flow for this story.
- 03-sequence.md L157-177 — Cache + vector RAG context reuse (used by regenerate to build history context).
- 05-architecture.md — Layered dependency graph; `ChatService --> MessageRepository / AiProvider / QdrantStore / RedisCache`.
- project-context.md — Stack: Next.js 16 App Router route handlers (`app/api/`), TypeScript strict, path alias `@/*`.

## Dev Agent Record

### Agent Model Used

subagent

### Debug Log References

TODO

### Completion Notes List

TODO

### File List

TODO
