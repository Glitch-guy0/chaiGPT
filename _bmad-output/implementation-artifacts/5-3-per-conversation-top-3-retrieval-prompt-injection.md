# Story 5.3: Per-Conversation Top-3 Retrieval & Prompt Injection

Status: ready-for-dev

## Story

As a user,
I want the model to use my uploaded docs for the current conversation,
so that answers are grounded in my files.

## Acceptance Criteria

1. Given a chat request in conversation C with linked assets
   When `QdrantStore.search(embed(lastUser), C, k=3)` runs
   Then only the top-3 chunks linked to C's assets are returned (FR-14)

2. And retrieval latency is < 300 ms p95 (NFR-4)

3. And retrieved context is injected into the prompt before completion (FR-15)

## Tasks / Subtasks

### T1: Embed + Search Pipeline (AC1)
- **T1.1** In `ChatService.send()`, after receiving the user message, call `QdrantStore.embed(lastUserMessage)` to generate the query vector.
- **T1.2** Call `QdrantStore.search(vec, conversationId, k=3)` scoped to the current conversation's linked assets. Ensure only chunks belonging to assets linked to the conversation are returned.
- **T1.3** Verify the returned `Hit[]` array contains at most 3 entries, each with `chunkId`, `assetId`, `score`, and `text`.
- **T1.4** If the conversation has no linked assets, skip retrieval entirely and proceed with an ungrounded completion. Log a debug-level message noting "no linked assets for conversation."

### T2: Prompt Injection (AC3)
- **T2.1** Create a `formatRagContext(hits: Hit[]): string` utility function (in a new file `src/lib/rag/inject.ts` or inside `src/services/chat.service.ts`).
- **T2.2** Format output as:
  ```
  [RAG Context]
  [1] (asset: <assetId>, chunk: <chunkId>, score: <score>) <text>
  [2] (asset: <assetId>, chunk: <chunkId>, score: <score>) <text>
  [3] (asset: <assetId>, chunk: <chunkId>, score: <score>) <text>
  [/RAG Context]
  ```
- **T2.3** Inject the formatted string into the system prompt or prepend to the user message context before passing to `AiProvider.stream()` / `AiProvider.complete()`. The exact injection point depends on the AiProvider prompt construction. Default: prepend to the system prompt, after any existing system instructions.
- **T2.4** If no hits are returned (empty array), produce an empty string and skip injection. The prompt should fall back to the model's general knowledge.

### T3: Citation Response Metadata (AC1, AC3)
- **T3.1** Include citation metadata in the chat response payload. Extend `ChatResponse` type (or a new `Citation` interface) to carry:
  ```ts
  interface Citation {
    chunkId: string;
    assetId: string;
    score: number;
    snippet: string; // first 120 chars of the chunk text
  }
  ```
- **T3.2** Populate the `citations` field from the `Hit[]` results before streaming/completing.
- **T3.3** Ensure the stream chunks themselves do NOT include the raw RAG context text — only the final response metadata should carry citations.

### T4: Performance — Latency Budget (AC2)
- **T4.1** Measure end-to-end retrieval latency (embed + search) and log it. Use `Date.now()` or `performance.now()` delta.
- **T4.2** Log a warning if retrieval exceeds 200 ms (early warning before 300 ms hard cap).
- **T4.3** Log an error if retrieval exceeds 300 ms p95. Include `conversationId`, `assetCount`, and `latencyMs` in the log.
- **T4.4** Defer heavy optimizations to Story 5.4 (Redis cache). Story 5.3 should ensure the code path is instrumented and that no unnecessary work is done inline (e.g., no re-fetching assets, no re-chunking).

### T5: Branch-Awareness (AC1)
- **T5.1** Verify that `QdrantStore.search(vec, convId, k)` uses the correct `convId` for the active branch. Since `findMessageChain` (Story 4.3) resolves the active branch, ensure the `convId` passed to `search` is the branch's conversation ID, not a stale parent.
- **T5.2** If a conversation is forked/branched, the new branch inherits the linked assets from the parent. Retrieval on the new branch should still work against the same asset set.

### T6: Edge Cases
- **T6.1** **No linked assets**: Skip retrieval, proceed with ungrounded prompt. Return empty citations array.
- **T6.2** **Empty conversation / no user message**: Guard against `lastUser` being undefined. Return empty hits.
- **T6.3** **Very long chunks**: If a chunk exceeds 2000 chars, truncate the `text` field in `Hit` to 2000 chars before formatting. Log a debug note.
- **T6.4** **Qdrant unavailable**: Catch errors from `QdrantStore.search()`. Log the error, proceed with ungrounded completion, and include a `ragDegraded: true` flag in the response metadata so the UI can optionally show a warning.
- **T6.5** **Embed failure**: If `QdrantStore.embed()` throws, fall back to ungrounded completion. Do not block the chat flow.

### T7: Testing
- **T7.1** Unit test `formatRagContext()`: verify correct formatting with 0, 1, and 3 hits; verify truncation of long chunks.
- **T7.2** Integration test `ChatService.send()` with a mocked `QdrantStore`: verify that when assets are linked, the prompt includes RAG context; when no assets, it does not.
- **T7.3** Latency test: mock `embed` and `search` to simulate realistic latencies; verify that the system logs warnings at 200 ms+ and errors at 300 ms+.
- **T7.4** Edge case tests: no assets, empty hits, embed failure, search failure.

## Dev Notes

### Prompt Injection Format
The injected context block uses a clearly delimited format so the model can distinguish it from the conversation:
```
[RAG Context]
[1] (asset: asset-abc, chunk: chunk-001, score: 0.87) The company policy states that...
[2] (asset: asset-abc, chunk: chunk-014, score: 0.82) In the event of a...
[3] (asset: asset-def, chunk: chunk-003, score: 0.79) Employees must submit...
[/RAG Context]

User question: What is the policy on remote work?
```

The model should be instructed (via system prompt) to use the RAG Context when answering, and to cite the `[N]` reference when possible.

### Citation Format
Citations returned to the frontend use the structure:
```ts
interface Citation {
  chunkId: string;   // e.g. "chunk-001"
  assetId: string;   // e.g. "asset-abc"
  score: number;     // 0.0–1.0 relevance score
  snippet: string;   // first 120 chars of chunk text for preview
}
```

### Performance Considerations
- `QdrantStore.search()` should hit a pre-built HNSW index in Qdrant — expected sub-50ms for k=3.
- `QdrantStore.embed()` depends on the embedding model. For OpenAI `text-embedding-3-small`, expect 50–150ms per call. This is the dominant cost.
- Total budget: embed (~100ms) + search (~30ms) + formatting (~1ms) ≈ 131ms typical. Well within 300 ms p95.
- Story 5.4 will add Redis caching of the search results to skip re-embedding on repeated queries within the same conversation.

### Files to Create
- `src/lib/rag/inject.ts` — `formatRagContext(hits: Hit[]): string` utility

### Files to Modify
- `src/services/chat.service.ts` — wire embed → search → inject into send/stream methods; extend `ChatResponse` with `citations` and `ragDegraded` fields
- `src/lib/vector/qdrant.ts` — no changes expected; the interface is already defined. If `embed` or `search` signatures need adjustment, update here.
- `src/lib/ai/langchain.ts` — may need to accept an optional `ragContext` parameter if the AiProvider doesn't already support it

### Dependency on Prior Stories
- **Story 5.1/5.2**: Assets are chunked and embedded into Qdrant. Without this, search returns nothing. Story 5.3 assumes assets are already stored.
- **Story 4.3**: `findMessageChain` provides branch-aware conversation resolution. Use this to get the correct `convId` for scoping.

### Testing Approach
- **Framework**: Use the project's existing test runner (check `package.json` for test scripts — likely Vitest or Jest).
- **Mock strategy**: Create a mock `QdrantStore` that returns predefined `Hit[]` arrays. No need to spin up Qdrant for unit tests.
- **Latency tests**: Use `performance.now()` in tests; mock `embed` with a configurable delay to simulate slow responses.
- **Integration tests**: Test the full `ChatService.send()` path with mocked `AiProvider` and `QdrantStore`.

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled by dev agent)

### Completion Notes List
(To be filled by dev agent)

### File List
(To be filled by dev agent)
