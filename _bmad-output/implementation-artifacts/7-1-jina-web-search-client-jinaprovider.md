# Story 7.1: Jina Web-Search Client (`JinaProvider`)

Status: ready-for-dev

## Story

As a Maintainer,
I want a thin Jina client module,
So that the model can fetch live web results.

## Acceptance Criteria

1. **Given** the E1 `WebSearchProvider` contract (`src/lib/websearch/jina.ts`)
   **When** concrete `JinaProvider` class is implemented in `src/lib/websearch/jina.ts`
   **Then** it reads `JINA_API_KEY` from environment variables, failing closed with an explicit `Error` ("JINA_API_KEY environment variable is missing") if unconfigured or empty (FR-25).

2. **And** it issues HTTP search requests to Jina Search API (`https://api.jina.ai/v1/search`) with header `Authorization: Bearer ${apiKey}` (FR-24).

3. **And** normalizes API responses into `WebResult[]` (`{ title: string, url: string, snippet: string }`) array (FR-24).

4. **And** query latency is < 1.5 s p95 (NFR-10), enforced with an `AbortController` timeout budget of 1500 ms.

## Tasks / Subtasks

### T1: Environment Config & Validation (AC1)
- **T1.1** Read `process.env.JINA_API_KEY` in `JinaProvider`.
- **T1.2** Throw explicit `Error("JINA_API_KEY environment variable is missing")` when key is absent or empty string.

### T2: Jina API Fetch & Normalization (AC2, AC3)
- **T2.1** Implement `search(query: string): Promise<WebResult[]>` in `JinaProvider` class in `src/lib/websearch/jina.ts`.
- **T2.2** Issue POST HTTP request to `https://api.jina.ai/v1/search` with headers:
  ```json
  {
    "Authorization": "Bearer <JINA_API_KEY>",
    "Accept": "application/json",
    "Content-Type": "application/json"
  }
  ```
  Payload: `{ "q": query }`.
- **T2.3** Parse JSON response data items into `WebResult[]`:
  - `title`: `item.title || ""`
  - `url`: `item.url || ""`
  - `snippet`: `item.content || item.snippet || item.description || ""`
- **T2.4** Handle non-200 HTTP response statuses by throwing detailed `Error`.

### T3: Timeout & Latency Instrumentation (AC4)
- **T3.1** Wrap `fetch` call with `AbortController` timeout of 1500 ms.
- **T3.2** Log warning if latency > 1000 ms; reject with timeout `Error` if > 1500 ms.

### T4: Unit Testing & Mocks
- **T4.1** Create unit tests in `tests/unit/lib/websearch/jina.test.ts` testing 200 success, missing API key error, non-200 status error, and 1500 ms timeout.
- **T4.2** Verify zero regressions against `MockJinaProvider` in `tests/fixtures/mock-jina-provider.ts`.

## Dev Notes

### Contracts & Type Rules
- Must implement `WebSearchProvider` interface defined in `src/lib/websearch/jina.ts`:
  ```ts
  export interface WebResult {
    title: string;
    url: string;
    snippet: string;
  }

  export interface WebSearchProvider {
    search(query: string): Promise<WebResult[]>;
  }
  ```
- Do NOT alter interface signatures or create competing types (`docs/type-discipline.md`).

### Environment Variables
- `JINA_API_KEY`: Required string from environment.
