# Story 3.3: ChatService Send with SSE Stream & Status Lifecycle

Status: ready-for-dev

## Story

As a user,
I want to send a message and watch the reply stream live,
So that I get fast feedback and a persisted record.

## Acceptance Criteria

1. **Given** an authenticated user sends a `ChatRequest`
   **When** `ChatService.send(req, userId)` runs
   **Then** the inbound user message is saved (via `MessageRepository.save`) and a trailing assistant message is created with `status: processing` (FR-6)

2. **Given** streaming has begun
   **When** tokens are produced by `AiProvider.streamChat`
   **Then** each token is (a) pushed to the client live over Server-Sent Events (SSE) and (b) appended to a server-side buffer (FR-19)

3. **Given** the SSE stream completes normally
   **When** `AiProvider.streamChat` signals completion
   **Then** the assistant message is persisted from the buffer with `status: complete` (FR-6)

4. **Given** the client requests explicit termination mid-stream
   **When** the AbortController/stream is cancelled
   **Then** the assistant message content is set to exactly `"user terminated the response"` with `status: stopped` (FR-6)

5. **Given** a normal send
   **When** time-to-first-token is measured from request start to first SSE chunk
   **Then** it is `< 1 s` (NFR-5)

6. **Given** the request references an existing conversation
   **When** building the prompt
   **Then** per-conversation RAG context is retrieved (via `QdrantStore.search`/Redis cache, scoped by `conversationId`) and injected before completion (FR-15, FR-14, NFR-4)

## Tasks / Subtasks

- [ ] Task 1: SSE endpoint & transport design (AC: #2, #5)
  - [ ] Define `POST /api/chat` route handler (App Router) that authenticates via the E1 `auth` contract (`auth()` from `@clerk/nextjs/server`) and returns a `ReadableStream` with `Content-Type: text/event-stream` headers (`Cache-Control: no-cache`, `Connection: keep-alive`)
  - [ ] Implement the SSE framing: emit `data: {token}\n\n` chunks per token, and terminal `event: done` / `event: stopped` control events carrying final status
  - [ ] Wire an `AbortSignal` from the client (e.g. `?abort` or a second control channel) so the route can cancel the upstream `AiProvider.streamChat` call
  - [ ] Ensure the route handler stays stateless and delegates all logic to `ChatService.send` (FR-21, NFR-2)

- [ ] Task 2: `ChatService.send(req, userId)` orchestration (AC: #1, #3, #4, #6)
  - [ ] Validate `req` against `ChatRequestSchema` (E1 `lib/validation/schemas.ts`) → produce a typed `ChatRequest` (FR-20)
  - [ ] Resolve/persist the user message: `MessageRepository.save({ conversationId, userId, role: "user", content, parentId?, model, status: "complete" })`
  - [ ] Create trailing assistant message immediately with `role: "assistant"`, empty `content`, `status: processing` via `MessageRepository.save` — return its `id` so the client can correlate (FR-6)
  - [ ] Call the per-conversation RAG context hook (Task 5) to build the prompt with retrieved + web context
  - [ ] Invoke `AiProvider.streamChat(messages, onChunk)` (depends on Story 3.4) and feed `onChunk` into both the SSE response and the server-side buffer

- [ ] Task 3: `AiProvider.streamChat` integration & buffering (AC: #2, #5)
  - [ ] Depend on the E1 `AiProvider` interface (`lib/ai`) contract: `streamChat(messages, onChunk)` (Story 3.4 delivers the concrete LangChain `ChatOpenAI` module)
  - [ ] In `onChunk(token)`, append `token` to the in-memory `buffer` string AND enqueue the token to the SSE stream — no disk/DB writes per token
  - [ ] Measure and log time-to-first-token (request start → first `onChunk`); guard so the first chunk is flushed `< 1 s` (NFR-5) — implement a fallback: if the provider has not yielded within budget, still flush whatever is ready and continue

- [ ] Task 4: Status lifecycle state machine (AC: #1, #3, #4)
  - [ ] Implement the assistant message status transition precisely:
    - `created → processing`: set at message creation (Task 2, FR-6)
    - `processing → complete`: on normal `streamChat` completion → `MessageRepository.updateStatus(id, "complete")` after persisting `content = buffer` (FR-6)
    - `processing → stopped`: on abort/`AbortController` signal → `MessageRepository.save/update` with `content = "user terminated the response"` and `status: "stopped"` (FR-6)
    - No transitions out of `complete` or `stopped` from this path (regenerate is Story 3.6)
  - [ ] Persist terminal content exactly once on completion/termination to avoid partial writes; flush final SSE control event (`done` / `stopped`) only after DB commit

- [ ] Task 5: Per-conversation RAG context retrieval hook (AC: #6)
  - [ ] Implement `getContextForConversation(userId, conversationId)`:
    - On cache hit (`RedisCache.get(convId)` per E1 `RedisCache` contract, Story 5.4) return stored context
    - On miss, embed last user message via `QdrantStore.embed(text)`, call `QdrantStore.search(vec, conversationId, k=3)` scoped to the conversation's linked assets (FR-14), inject into prompt, then `RedisCache.set(convId, ctx, ttl)` (NFR-2, Architecture 03-sequence #6)
  - [ ] Enforce retrieval latency `< 300 ms` p95 (NFR-4); if RAG store is unavailable, degrade gracefully (empty context) so streaming still starts within TTFT budget
  - [ ] (Deferred: web-search context injection is Story 7.3 — leave a documented extension point)

- [ ] Task 6: Testing (AC: all — FR-29, FR-30, FR-31, NFR-7, NFR-8)
  - [ ] Colocate `ChatService.test.ts` next to `src/services/ChatService` (FR-29)
  - [ ] Mock `AiProvider` (emit tokens then complete / abort), `MessageRepository`, `QdrantStore`, `RedisCache`, and Clerk `auth` so the suite runs offline/deterministically (FR-30, NFR-8)
  - [ ] Assert: user msg saved + assistant msg `processing` created; tokens streamed AND buffered; `complete` persisted from buffer; abort yields `"user terminated the response"` + `stopped`; TTFT mocked `< 1 s`
  - [ ] Ensure coverage of `ChatService` meets the ≥80% gate enforced in CI (FR-31, NFR-7)

## Dev Notes

- **Architecture**: Tightly coupled layered design approved in FR-21 — `app/ (route handler) → services/ (ChatService) → {repositories | lib/ai | lib/vector | lib/cache}`. No port/adapter abstraction; depend on E1 interfaces directly.
- **Source tree targets** (per `01-package.md` / FR-21, `02-class.md`):
  - `src/services/ChatService.ts` — new `ChatService` with `send(req: ChatRequest, userId: string): Promise<ReadableStream>` (and a `regenerate` stub reserved for Story 3.6)
  - `src/app/api/chat/route.ts` — SSE route handler (App Router Route Handler) reading `auth()` from `@clerk/nextjs/server` (FR-1, FR-23)
  - `src/lib/ai/langchain.ts` — consumed via E1 `AiProvider` interface (delivered by Story 3.4)
  - `src/lib/vector/qdrant.ts` — E1 `QdrantStore` (`embed`, `search`, `upsertChunks`) used by Task 5 (Story 5.2/5.3)
  - `src/lib/cache/redis.ts` — E1 `RedisCache` (`get`, `set`) used by Task 5 (Story 5.4)
  - `src/lib/db/repositories/MessageRepository.ts`, `ConversationRepository.ts` — used by Task 2/4 (Story 3.1)
  - `src/lib/validation/schemas.ts` — `ChatRequestSchema` (Story 1.4, FR-20)
  - `src/types` — `ChatRequest`, `ChatResponse`, `Role` (Story 1.4, FR-21)
- **E1 `AiProvider` contract (exact)**: `complete(messages)` and `streamChat(messages, onChunk)` (epics.md Story 1.3) — `ChatService` depends only on this interface; the concrete LangChain `ChatOpenAI` module (default `gpt-4o-mini`, swappable without touching services — FR-22) is delivered by Story 3.4.
- **E1 `Message` entity (exact shape, Story 1.1 / FR-5)**: `id`, `conversationId`, `userId`, `parentId?`, `role`, `content`, `model?`, `status`, `createdAt`; `status ∈ processing | complete | stopped`.
- **E1 `MessageRepository` interface (exact, Story 1.2 / FR-2)**: `findById(id, userId)`, `findAll(userId)`, `save`, `updateStatus(id, status)`; plus `findByConversation` (Story 3.1, FR-5/FR-6). Every query carries `userId` for scoping.
- **SSE transport convention (FR-19, existing behavior preserved)**: tokens stream via SSE; client renders progressively (UX-DR3, Story 6.3). Stream must be flushed incrementally — do NOT buffer the whole response before sending (protects NFR-5).
- **Status lifecycle state machine (precise)**:
  - `∅ → processing` at assistant-message creation (save with `status: processing`, empty content) — FR-6
  - `processing → complete` on stream end: `content = buffer`, `updateStatus(id, "complete")` — FR-6
  - `processing → stopped` on abort: `content = "user terminated the response"`, `updateStatus(id, "stopped")` — FR-6
  - Terminal states `complete`/`stopped` are not re-entered here (regenerate overwrites in place — Story 3.6, FR-18)
- **RAG/context (FR-14, FR-15, NFR-4, NFR-2)**: per-conversation top-3 retrieval scoped to linked assets; Redis cache keyed by `conversationId` (03-sequence #6); injected before completion. Graceful degradation keeps TTFT `< 1 s` if the store is slow/unavailable.
- **TTFT (NFR-5)**: start timer at handler entry; first `onChunk` must flush `< 1 s`. Keep provider warm-up and RAG retrieval inside this budget; abort RAG if it threatens the budget.
- **Dependencies**: Story 3.1 (repositories: `MessageRepository`, `ConversationRepository`) and Story 3.4 (`AiProvider` concrete streaming module) must land first. `QdrantStore`/`RedisCache` (Story 5.2/5.3/5.4) are optional at runtime (graceful degradation) but the hook must be wired.
- **Testing standards (FR-29/FR-30/FR-31, NFR-7/NFR-8)**: Vitest colocated `*.test.ts`; externals (OpenAI/LangChain, Qdrant, Redis, Clerk) mocked; ≥80% coverage of services + repositories enforced in CI; deterministic, offline.

### Project Structure Notes

- Aligns with unified `01-package.md` structure: `app/`, `services/`, `lib/db/repositories`, `lib/ai`, `lib/vector`, `lib/cache`, `lib/auth`, `lib/validation`, `types/` (FR-21).
- Dependency direction `app → services → {repositories | ai | vector | cache}` with no extra abstraction layer (NFR-1); `ChatService` imports E1 interfaces from `types/` and `lib/*` only.
- No conflict with E2 layered skeleton; the SSE route handler is a standard Next.js 16 App Router Route Handler (API routes under `app/api/`).
- `regenerate` method left as a thin reserved stub here to avoid scope creep; fully implemented in Story 3.6.

### References

- Epic 3 / Story 3.3 — epics.md#Story-3.3 (lines 394–412) — requirement & AC source
- Epic 1 / Story 1.1 — epics.md#Story-1.1 (lines 172–188) — `Message` entity & `status` union
- Epic 1 / Story 1.2 — epics.md#Story-1.2 (lines 190–204) — `MessageRepository`/`ChatService` interface signatures
- Epic 1 / Story 1.3 — epics.md#Story-1.3 (lines 206–226) — `AiProvider`, `QdrantStore`, `RedisCache`, `auth` contracts
- Epic 1 / Story 1.4 — epics.md#Story-1.4 (lines 228–244) — `ChatRequestSchema`, `ChatRequest`, `Role`
- FR-6 — epics.md#FR-6 (line 33) — status lifecycle on send
- FR-19 — epics.md#FR-19 (line 46) — SSE streaming preserved
- FR-14 / FR-15 — epics.md#FR-14 (line 41), FR-15 (line 42) — per-conversation RAG & prompt injection
- FR-20 / FR-21 / FR-22 — epics.md#FR-20 (line 47), FR-21 (line 48), FR-22 (line 49) — Zod validation, layered arch, AiProvider
- FR-1 / FR-23 / FR-2 — epics.md#FR-1 (line 28), FR-23 (line 50), FR-2 (line 29) — Clerk auth, middleware helpers, userId scoping
- NFR-5 — epics.md#NFR-5 (line 69) — TTFT < 1 s
- NFR-4 / NFR-2 — epics.md#NFR-4 (line 68), NFR-2 (line 66) — RAG latency, stateless/externalized stores
- NFR-7 / NFR-8 / FR-29 / FR-30 / FR-31 — epics.md#NFR-7 (line 71), NFR-8 (line 72), FR-29 (line 56), FR-30 (line 57), FR-31 (line 58) — testing & coverage
- Architecture 03-sequence #6 — RAG context cache reuse keyed by conversationId
- UX-DR3 — epics.md#UX-DR3 (line 94) — streaming chat view / live SSE render
- Story 3.1 (repositories) — epics.md#Story-3.1 (lines 362–376)
- Story 3.4 (AiProvider) — epics.md#Story-3.4 (lines 414–426)
- Story 5.2/5.3/5.4 (RAG + cache) — epics.md#Story-5.2 (536), 5.3 (552), 5.4 (568)
- Story 3.6 (regenerate) — epics.md#Story-3.6 (lines 444–456)
- project-context.md — Technology Stack (Next.js 16 App Router, Route Handlers, `@/*` alias)

## Dev Agent Record

### Agent Model Used

subagent

### Debug Log References

TODO

### Completion Notes List

TODO

### File List

TODO
