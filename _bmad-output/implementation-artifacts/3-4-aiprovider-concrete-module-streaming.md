# Story 3.4: AiProvider Concrete Module (Streaming)

Status: ready-for-dev

## Story

As a Maintainer,
I want the concrete `AiProvider` implementing the E1 interface with LangChain `ChatOpenAI` streaming,
So that I can swap the model without rewriting services.

## Acceptance Criteria

1. **Given** the `lib/ai/langchain.ts` module implementing the E1 `AiProvider` contract,
   **When** `ChatService` calls `AiProvider.streamChat(messages, onChunk)`,
   **Then** tokens are emitted to `onChunk` for each streamed chunk and the stream completes (promise resolves) at end of stream (FR-22, Epic 3 Story 3.4).

2. **Given** the E1 `AiProvider` interface declares `streamChat(messages: ChatMessage[], onChunk: (token: string) => void): Promise<void>` (and `complete(messages: ChatMessage[]): Promise<string>`),
   **When** the concrete module is written,
   **Then** the exported concrete provider satisfies that exact signature contract — `messages` typed as `ChatMessage[]` from `@/types`, `onChunk` invoked per token — with no signature drift from the E1 interface (epics.md#Story 1.3; src/lib/ai/langchain.ts:3-5).

3. **Given** the `streamChat` implementation,
   **When** LangChain `ChatOpenAI` produces a streaming response,
   **Then** each `AIMessageChunk.content` token is mapped to a `string` and pushed to `onChunk`, the accumulated content is NOT re-buffered here (buffering is the responsibility of `ChatService` per Story 3.3), and the method resolves after the last chunk.

4. **Given** the concrete module configures `ChatOpenAI`,
   **When** it is instantiated,
   **Then** the default model is `gpt-4o-mini` and the model is fully isolated to this module (read from a single `MODEL` constant / config object) so it can be swapped by changing ONLY this module — never the services (FR-22, Epic 3 Story 3.4; 02-class.md AiProvider has `-chat: ChatOpenAI`).

5. **Given** the module depends on a key from the environment,
   **When** the OpenAI API key is missing,
   **Then** the module fails closed with a clear error (no hard-coded key) — consistent with FR-25's "fails closed" posture for integration modules — and does not silently emit an empty stream.

6. **Given** the concrete provider is wired into `ChatService`,
   **When** `ChatService` (Story 3.3) depends on the `AiProvider` interface and receives this module via DI/composition,
   **Then** `ChatService` holds the provider as `ai: AiProvider` (02-class.md `ChatService` `-ai: AiProvider`) and is unaware of `gpt-4o-mini`, OpenAI, or LangChain specifics — confirming the swappability boundary (FR-22).

## Tasks / Subtasks

- [ ] Task 1: Define the `AiProvider` interface contract (if not already present) — `streamChat(messages, onChunk)` and `complete(messages)` (AC: #2)
  - [ ] Subtask 1.1: Confirm `src/lib/ai/langchain.ts:3-5` exports `interface AiProvider` with `complete(messages: ChatMessage[]): Promise<string>` and `streamChat(messages: ChatMessage[], onChunk: (token: string) => void): Promise<void>` matching E1 (epics.md#Story 1.3:216).

- [ ] Task 2: LangChain `ChatOpenAI` setup with swappable model config (AC: #4, #5)
  - [ ] Subtask 2.1: Import `ChatOpenAI` from `@langchain/openai` (deps present: `@langchain/openai@^1.5.5`, `@langchain/core@^1.2.3` per package.json:28-29).
  - [ ] Subtask 2.2: Declare a single module-local model constant/config, default `gpt-4o-mini`, e.g. `const DEFAULT_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini"`. All model selection is contained here.
  - [ ] Subtask 2.3: Read the API key from `process.env.OPENAI_API_KEY` (never hard-coded); construct `new ChatOpenAI({ model: DEFAULT_MODEL, apiKey, streaming: true })`; if key is absent, throw a clear error at construction/use (fail closed).
  - [ ] Subtask 2.4: Document (README/comment-free per rules) via the export that swapping the model requires editing only this module's `DEFAULT_MODEL` / env var.

- [ ] Task 3: Implement `streamChat(messages, onChunk)` against the E1 signature (AC: #1, #2, #3)
  - [ ] Subtask 3.1: Map incoming `ChatMessage[]` (`@/types`, role: `Role = 'user'|'assistant'|'system'`, content: `string` — src/types/index.ts:1-6) to LangChain message format (`SystemMessage`/`HumanMessage`/`AIMessage` from `@langchain/core/messages`).
  - [ ] Subtask 3.2: Call `chat.stream(messages)` and `for await` over the async iterator.
  - [ ] Subtask 3.3: For each `AIMessageChunk`, extract `content` as `string`, and invoke `onChunk(token)` per token/chunk.
  - [ ] Subtask 3.4: Resolve the returned `Promise<void>` only after the stream is exhausted; propagate upstream errors to the caller (do not swallow — `ChatService` owns status lifecycle).

- [ ] Task 4: Implement `complete(messages)` (AC: #2)
  - [ ] Subtask 4.1: Use `chat.invoke(mappedMessages)` and return `content` as `Promise<string>` (non-streaming fallback used by tests and non-SSE paths).

- [ ] Task 5: Export a concrete singleton/instance implementing `AiProvider` (AC: #6)
  - [ ] Subtask 5.1: Export e.g. `export const aiProvider: AiProvider = new LangChainAiProvider();` (or a factory) so `ChatService` imports the interface-typed instance, keeping services unaware of the concrete class (02-class.md: ChatService `-ai: AiProvider`).
  - [ ] Subtask 5.2: Ensure `ChatService` (Story 3.3) receives this via composition/DI, never importing `ChatOpenAI` directly.

- [ ] Task 6: Unit tests with mocked LangChain/OpenAI (AC: #1, #2, #3; FR-29, FR-30, NFR-8, NFR-7)
  - [ ] Subtask 6.1: Colocate `src/lib/ai/langchain.test.ts`. Mock `@langchain/openai` so no network; assert `streamChat` calls `onChunk` with expected tokens and resolves; assert `complete` returns the joined string.
  - [ ] Subtask 6.2: Assert default model is `gpt-4o-mini` and that changing only the module-local config/env changes the model used (swappability proof).
  - [ ] Subtask 6.3: Assert fail-closed behavior when `OPENAI_API_KEY` is missing.
  - [ ] Subtask 6.4: Verify the concrete type is assignable to `AiProvider` (signature conformance), e.g. reuse `tests/fixtures/mock-ai-provider.ts` `MockAiProvider` pattern for contract parity.

## Dev Notes

- **Architecture / dependency rule (FR-21, NFR-1):** Tightly-layered, no port/adapter indirection. Direction: `app → services → {repositories | ai | vector | cache}`. `ChatService` (Story 3.3) depends on the `AiProvider` *interface* (declared in this module), not the concrete LangChain class. This module is the sole integration point for OpenAI/LangChain streaming — the only place that knows the model id, key, and SDK.
- **Swappability is the core requirement (FR-22):** The model id and provider config MUST live exclusively in `src/lib/ai/langchain.ts`. Services (`ChatService`, etc.) must never reference `gpt-4o-mini`, `ChatOpenAI`, or `OPENAI_API_KEY`. To change model → edit one constant/env in this module. This is the thin-module boundary, not a hard port (epics.md#FR-22).
- **Message contract (E1, src/types/index.ts):** `ChatMessage { role: Role; content: string }` where `Role = 'user' | 'assistant' | 'system'`. `streamChat` receives `ChatMessage[]`; the module maps to LangChain message classes. `onChunk` receives a `string` token per chunk.
- **Streaming conformance (Story 3.3 consumption):** `ChatService.send` creates the assistant message `status: processing`, calls `ai.streamChat(history, onChunk)`, accumulates tokens in a server-side buffer AND forwards to the SSE client, then persists `status: complete` on completion / `stopped` on termination (FR-6, FR-19). This module only emits tokens via `onChunk` and resolves; it does NOT manage message status or SSE framing.
- **Testing standards (FR-29, FR-30, NFR-8, NFR-7):** Vitest, colocated `*.test.ts`. External deps (OpenAI/LangChain) MUST be mocked so tests run offline/deterministically. Coverage gate ≥80% on services + repositories (this module's unit tests contribute but the gate targets services/repos). Follow the `MockAiProvider` fixture pattern (tests/fixtures/mock-ai-provider.ts) for contract parity.
- **Env handling:** Key via `process.env.OPENAI_API_KEY`; model via `process.env.AI_MODEL` (optional override) defaulting to `gpt-4o-mini`. Never hard-code secrets (FR-25 posture).

### Project Structure Notes

- Target module: `src/lib/ai/langchain.ts` (already exists, currently only declares the `AiProvider` interface at lines 1-5 — extend it in place with the concrete implementation; do not move the interface elsewhere, `MockAiProvider` and other modules import `AiProvider` from `@/lib/ai/langchain`).
- Aligned with `01-package.md` layered layout: `lib/ai` is the integration module for the AI provider (05-architecture.md subgraph `integ → ai["ai/langchain.ts (ChatOpenAI, stream)"]`).
- `ChatService` (Story 3.3, not yet implemented) will live in `src/services` and import `{ aiProvider }` (interface-typed) from this module — no variance, dependency direction preserved (`services → ai`).
- Test file: `src/lib/ai/langchain.test.ts` (colocated, per FR-29).
- No conflict with existing skeleton: `src/lib/ai/langchain.ts` already exists and only defines the contract; this story fills the concrete implementation.

### References

- E1 `AiProvider` contract — [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3 (lines 206-226), especially line 216: "`AiProvider` declares `complete(messages)` and `streamChat(messages, onChunk)` (FR-22)"]
- Story 3.4 requirement — [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4 (lines 414-426), AC: `streamChat` emits tokens to `onChunk` + completes; default model `gpt-4o-mini`, swappable by changing only this module (FR-22)]
- FR-22 thin `AiProvider` module — [Source: _bmad-output/planning-artifacts/epics.md#FR-22 (line 49)]
- ChatService depends on `AiProvider` — [Source: _bmad-output/planning-artifacts/02-class.md (ChatService `-ai: AiProvider`; AiProvider `-chat: ChatOpenAI` + `streamChat(msgs, onChunk)`)]
- Architecture integration placement — [Source: _bmad-output/planning-artifacts/05-architecture.md (integ subgraph `ai/langchain.ts (ChatOpenAI, stream)`; flow `svc --> ai`)]
- `ChatMessage` / `Role` types — [Source: src/types/index.ts:1-6]
- Existing `AiProvider` interface declaration — [Source: src/lib/ai/langchain.ts:1-5]
- Mock contract parity reference — [Source: tests/fixtures/mock-ai-provider.ts (MockAiProvider implements AiProvider)]
- LangChain deps — [Source: package.json:28-29 (`@langchain/core@^1.2.3`, `@langchain/openai@^1.5.5`)]
- Streaming/SSE consumption by ChatService — [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3 (lines 394-412), FR-6/FR-19/NFR-5]
- Testing standards — [Source: _bmad-output/planning-artifacts/epics.md#FR-29, FR-30, NFR-7, NFR-8]

## Dev Agent Record

### Agent Model Used

subagent

### Debug Log References

TODO

### Completion Notes List

TODO

### File List

TODO
