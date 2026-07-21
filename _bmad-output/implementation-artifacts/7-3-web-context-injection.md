# Story 7.3: Web Context Injection

Status: ready-for-dev

## Story

As a user,
I want web results included when relevant,
So that answers cite live sources.

## Acceptance Criteria

1. **Given** a chat request where LLM agent executes `WebSearchTool`
   **When** `ChatService` / `AiProvider` builds prompt and processes completion
   **Then** Jina web search results are injected alongside Qdrant top-3 RAG context (FR-15, FR-26).

2. **And** each web result carries its source URL for citation (FR-26), surfaced in response citations / stream metadata.

3. **And** web context supplements per-conversation RAG and does not replace or overwrite it (FR-14).

## Tasks / Subtasks

### T1: ChatService & AiProvider Integration (AC1, AC3)
- **T1.1** In `src/services/chat.service.ts` and `src/lib/ai/langchain.ts`, ensure `WebSearchTool` is passed to agent tools array during `AiProvider.stream()` / `AiProvider.complete()`.
- **T1.2** Ensure prompt assembly maintains both Qdrant top-3 RAG context (from uploaded asset chunks) and Web Search context without collision.

### T2: Citation Metadata Extraction (AC2)
- **T2.1** Extract web citations (`{ title, url }`) from `WebSearchTool` executions.
- **T2.2** Include extracted web citations in `ChatResponse` metadata / SSE stream event payload.

### T3: Integration Testing & Verification
- **T3.1** Integration test `ChatService.send()` with `MockQdrantStore` and `MockJinaProvider`: verify both RAG context and web citations are present when web search is triggered.
- **T3.2** Verify fallback behavior when web search fails or returns zero results — RAG context remains unaffected.

## Dev Notes

### Architecture & Coexistence Rules
- RAG context is per-conversation (top 3 chunks from Qdrant).
- Web search context is generated on-demand by LLM tool calls.
- Both context sources coexist in prompt and response citations.
- Follow `docs/project-context.md` and preserve existing API contracts (`ChatService`, `AiProvider`).
