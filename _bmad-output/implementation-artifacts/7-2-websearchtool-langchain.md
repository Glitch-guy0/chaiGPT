# Story 7.2: WebSearchTool (LangChain)

Status: ready-for-dev

## Story

As a Maintainer,
I want a LangChain tool wrapping the Jina client,
So that the LLM decides when to search the web.

## Acceptance Criteria

1. **Given** E1 `WebSearchTool` contract (`src/lib/websearch/webSearchTool.ts`) and Zod `WebSearchArgsSchema` in `@/lib/validation/schemas` (FR-28)
   **When** tool is registered with agent / `AiProvider` (`src/lib/ai/langchain.ts`)
   **Then** on LLM invocation, it routes execution to `WebSearchProvider.search(args.query)` (FR-24).

2. **And** results and source URLs are captured into formatted output string for citation and observability (FR-26).

3. **And** if Jina API is unavailable, unconfigured, or throws, tool degrades gracefully returning error string (`"Web search unavailable: <reason>"`) without crashing agent execution loop (FR-28).

## Tasks / Subtasks

### T1: LangChain Tool Implementation (AC1)
- **T1.1** In `src/lib/websearch/webSearchTool.ts`, implement concrete `WebSearchTool` wrapping `WebSearchProvider`.
- **T1.2** Bind tool schema to `WebSearchArgsSchema` (`{ query: z.string().min(1) }`) imported from `@/lib/validation/schemas`.
- **T1.3** Implement `run(args: WebSearchArgs): Promise<string>`.

### T2: Result Formatting & Citation Capture (AC2)
- **T2.1** Format `WebResult[]` items into structured text:
  ```text
  Web Search Results for "${args.query}":
  [1] Title: ${item.title}
  URL: ${item.url}
  Snippet: ${item.snippet}
  ```
- **T2.2** If results array is empty, return `"No web search results found for: ${args.query}"`.

### T3: Graceful Error Handling (AC3)
- **T3.1** Wrap `provider.search()` call in try/catch block within tool execution.
- **T3.2** Return `"Web search unavailable: ${error.message}"` when error occurs (e.g. missing API key or HTTP failure), preventing unhandled rejections in agent execution loop.

### T4: AiProvider Tool Registration & Testing
- **T4.1** Export tool instance / factory for registration with `AiProvider` in `src/lib/ai/langchain.ts`.
- **T4.2** Add unit tests in `tests/unit/lib/websearch/webSearchTool.test.ts` for successful search, empty results, and graceful failure handling.

## Dev Notes

### Contracts & Type Discipline
- Interface defined in `src/lib/websearch/webSearchTool.ts`:
  ```ts
  import type { WebSearchArgs } from '@/lib/validation/schemas';

  export interface WebSearchTool {
    run(args: WebSearchArgs): Promise<string>;
  }
  ```
- Must import `WebSearchArgs` and `WebSearchArgsSchema` from `@/lib/validation/schemas`.
- Inject `WebSearchProvider` dependency into constructor or tool factory function.
