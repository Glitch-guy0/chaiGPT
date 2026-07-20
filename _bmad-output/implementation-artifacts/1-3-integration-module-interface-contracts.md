---
baseline_commit: 0169a4cd615e3e4e8e31d00c3f96a2681fb08144
---
# Story 1.3: Integration Module Interface Contracts

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Maintainer,
I want the integration module interface contracts defined,
so that services depend on interfaces, not concrete providers.

## Acceptance Criteria

1. `AiProvider` interface is declared with methods: `complete(messages)` and `streamChat(messages, onChunk)`. [FR-22] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — AiProvider]
2. `QdrantStore` interface is declared with methods: `embed(text)` returning `number[]`, `search(vec, convId, k)` returning `Hit[]`, `upsertChunks(assetId, chunks)`. [FR-14] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — QdrantStore]
3. `RedisCache` interface is declared with methods: `get(key)`, `set(key, value, ttl)`. [NFR-2] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — RedisCache]
4. `auth` (session helper) contract is declared with a `session()` function/method returning `userId` (or `null`/throwing when unauthenticated — exact failure behavior deferred to Story 2.3, this story only fixes the return shape). [FR-1, FR-23] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3]
5. `WebSearchProvider` interface is declared with `search(query)` returning normalized results `WebResult[]` where `WebResult` is `{ title: string, url: string, snippet: string }`. [FR-24] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — WebSearchProvider, WebResult]
6. `WebSearchTool` interface/contract is declared with `run(query)` and a Zod-validated input schema (`WebSearchArgsSchema` shape referenced here as a placeholder; the canonical schema itself is defined in Story 1.4), conceptually routed to `WebSearchProvider.search`. [FR-27, FR-28] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — WebSearchTool]
7. All six contracts (`AiProvider`, `QdrantStore`, `RedisCache`, `auth`/session contract, `WebSearchProvider`, `WebSearchTool`) are declared as TypeScript `interface`/type declarations only — no concrete provider logic, no LangChain/Qdrant/Redis/Clerk/Jina client instantiation, no HTTP calls. Concrete implementations land in later epics (Story 3.4 for `AiProvider`, Story 5.3/5.4 for `QdrantStore`/`RedisCache` usage, Story 2.3 for the concrete `auth` session helper, Epic 7 for `WebSearchProvider`/`WebSearchTool`). [Epic 1 scope rule] [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Types & Contracts]
8. Interface files are placed at `src/lib/ai/langchain.ts` (AiProvider interface), `src/lib/vector/qdrant.ts` (QdrantStore interface), `src/lib/cache/redis.ts` (RedisCache interface), `src/lib/auth/session.ts` (auth/session contract), `src/lib/websearch/jina.ts` (WebSearchProvider interface), `src/lib/websearch/webSearchTool.ts` (WebSearchTool interface) — matching the authoritative file tree in `01-package.md`, i.e. the interface is declared in the same file its concrete implementation will later occupy. [Source: _bmad-output/planning-artifacts/01-package.md#1. File Tree (authoritative)]
9. `ChatService` (Story 1.2) is documented as the consumer of `AiProvider`, `QdrantStore`, and `RedisCache` by reference/type only in this story — `ChatService`'s interface file (`src/services/chat.service.ts`) is NOT modified in this story to import these types (avoid coupling Story 1.2's already-created file); the relationship is captured in Dev Notes for the dev agent's awareness when Epic 3 wires it up. [Source: _bmad-output/implementation-artifacts/1-2-repository-service-interface-definitions.md]

## Tasks / Subtasks

- [ ] Task 1: Define `AiProvider` interface (AC: #1, #7, #8, #9)
  - [ ] Create `src/lib/ai/langchain.ts`
  - [ ] Declare `interface ChatMessage { role: "user" | "assistant" | "system"; content: string }` (or import `Role`/message shape once Story 1.4 lands — for now declare a local minimal shape consistent with Story 1.2's `MessageService.append(role, content)` literal union, per the same "don't invent a competing type" discipline used in Story 1.2)
  - [ ] Declare `interface AiProvider { complete(messages: ChatMessage[]): Promise<string>; streamChat(messages: ChatMessage[], onChunk: (token: string) => void): Promise<void>; }`
  - [ ] No `ChatOpenAI` import, no LangChain client instantiation, no method bodies
- [ ] Task 2: Define `QdrantStore` interface (AC: #2, #7, #8)
  - [ ] Create `src/lib/vector/qdrant.ts`
  - [ ] Declare `interface Hit { chunkId: string; assetId: string; score: number; text: string }` (chunk index + asset id referenced for citation, per FR-14)
  - [ ] Declare `interface Chunk { index: number; text: string }` (input shape for `upsertChunks`)
  - [ ] Declare `interface QdrantStore { embed(text: string): Promise<number[]>; search(vec: number[], convId: string, k: number): Promise<Hit[]>; upsertChunks(assetId: string, chunks: Chunk[]): Promise<void>; }`
  - [ ] No `@langchain/qdrant` import, no client instantiation, no method bodies
- [ ] Task 3: Define `RedisCache` interface (AC: #3, #7, #8)
  - [ ] Create `src/lib/cache/redis.ts`
  - [ ] Declare `interface RedisCache { get(key: string): Promise<string | null>; set(key: string, value: string, ttl: number): Promise<void>; }`
  - [ ] No Redis client import, no connection wiring, no method bodies
- [ ] Task 4: Define `auth` / session contract (AC: #4, #7, #8)
  - [ ] Create `src/lib/auth/session.ts`
  - [ ] Declare `interface AuthSession { session(): Promise<string | null>; }` returning `userId` (or a bare function type `type Session = () => Promise<string | null>` — choose the function-type form here since `02-class.md`/epics.md describe `auth` as a function-style helper (`auth()` from `@clerk/nextjs/server`), not a class; document the choice in Dev Notes)
  - [ ] No `@clerk/nextjs` import, no middleware wiring, no method bodies (concrete Clerk wiring is Story 2.3)
- [ ] Task 5: Define `WebSearchProvider` interface (AC: #5, #7, #8)
  - [ ] Create `src/lib/websearch/jina.ts`
  - [ ] Declare `interface WebResult { title: string; url: string; snippet: string }`
  - [ ] Declare `interface WebSearchProvider { search(query: string): Promise<WebResult[]>; }`
  - [ ] No Jina HTTP client, no `JINA_API_KEY` env read, no method bodies (concrete `JinaProvider` is Epic 7 Story 7.1)
- [ ] Task 6: Define `WebSearchTool` interface (AC: #6, #7, #8)
  - [ ] Create `src/lib/websearch/webSearchTool.ts`
  - [ ] Import `WebSearchProvider` type from `./jina`
  - [ ] Declare `interface WebSearchTool { run(query: string): Promise<string>; }` and note in a comment that the Zod arg schema (`WebSearchArgsSchema`) is defined in Story 1.4 (`src/lib/validation/schemas.ts`) and this tool's real input validation wires to it once that story lands
  - [ ] No LangChain tool registration, no Zod import/schema definition here (that's Story 1.4's `WebSearchArgsSchema`), no method bodies (concrete tool + routing to `WebSearchProvider.search` is Epic 7 Story 7.2)
- [ ] Task 7: Verify directory structure and scope discipline (AC: #7, #8, #9)
  - [ ] Confirm `src/lib/ai/`, `src/lib/vector/`, `src/lib/cache/`, `src/lib/auth/`, `src/lib/websearch/` directories exist with only the interface files added by this story
  - [ ] Do not implement any concrete provider (`ChatOpenAI`, Qdrant client, Redis client, Clerk `auth()`, Jina HTTP client, LangChain tool registration) in this story
  - [ ] Do not modify `src/services/chat.service.ts` (Story 1.2) in this story — leave the `AiProvider`/`QdrantStore`/`RedisCache` relationship as documentation only, per AC #9

## Dev Notes

**Scope discipline (critical):** This is Epic 1 — Types & Contracts. "No behavior is implemented here — only the shapes and signatures that downstream logic conforms to" [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Types & Contracts]. This story delivers ONLY 6 interface declarations (plus small supporting types: `ChatMessage`, `Hit`, `Chunk`, `WebResult`) across the 6 integration files that `01-package.md` designates for their eventual concrete implementations. Concrete implementations are explicitly later work:
- `AiProvider` concrete (LangChain `ChatOpenAI` streaming) → Epic 3 Story 3.4 [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4]
- `QdrantStore` concrete usage (embed/search/upsert wired into RAG) → Epic 5 Stories 5.2/5.3 [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2, #Story 5.3]
- `RedisCache` concrete usage (RAG context cache) → Epic 5 Story 5.4 [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4]
- `auth` concrete Clerk wiring (`@clerk/nextjs/server`, middleware) → Epic 2 Story 2.3 [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3]
- `WebSearchProvider` concrete (`JinaProvider`, Jina HTTP client, `JINA_API_KEY`) → Epic 7 Story 7.1 [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1]
- `WebSearchTool` concrete (LangChain tool registration, routing to `WebSearchProvider.search`) → Epic 7 Story 7.2 [Source: _bmad-output/planning-artifacts/epics.md#Story 7.2]

**Why interfaces live in the "final" file, not a separate `*.interface.ts`:** Unlike Story 1.2 (which put repository/service interfaces in files that will later hold concrete classes too, since none existed yet), the integration modules in `01-package.md`'s file tree are singular files per integration (`langchain.ts`, `qdrant.ts`, `redis.ts`, `session.ts`, `jina.ts`, `webSearchTool.ts`) — there is no separate interfaces directory for integrations. This story declares the `interface` in that exact file; the later concrete-implementation story will add the class/function body to the *same* file, not create a new one. This keeps this story's file placement literally matching `01-package.md`'s authoritative tree (AC #8) and avoids file churn later.

**Layering / dependency rule (why these are interfaces, not concrete providers):** "services → { repositories (TypeORM) | ai | vector | websearch | cache }" [Source: _bmad-output/planning-artifacts/01-package.md#3. Dependency Rule] [Source: _bmad-output/planning-artifacts/05-architecture.md]. Services depend on these integration contracts, never directly on `ChatOpenAI`, the Qdrant SDK, the Redis client, Clerk's SDK, or the Jina HTTP client. FR-22 states this explicitly for AI: "AI provider kept behind a thin `AiProvider` module (LangChain) so the model can be swapped without rewriting services; not a hard port boundary" [Source: _bmad-output/planning-artifacts/04-requirements.md — FR-22, referenced inline in epics.md Requirements Inventory]. This is a *thin* module boundary for pragmatic swappability — not a formal hexagonal port/adapter layer (`01-package.md` explicitly rejects port/adapter abstraction elsewhere in the codebase); the distinction is that these six modules are the officially designated "integration" concern in the file tree, so an interface here is the agreed contract point, not an extra abstraction layer bolted on top.

**How `ChatService` (Story 1.2) is expected to consume `AiProvider`:** Story 1.2's `ChatService` interface declares `send(req, userId)`, `stream(req, onChunk)`, `regenerate(messageId, userId)` [Source: _bmad-output/implementation-artifacts/1-2-repository-service-interface-definitions.md]. Per `02-class.md`'s concrete class view, the eventual `ChatService` implementation holds `-ai: AiProvider`, `-vector: QdrantStore`, `-cache: RedisCache` as constructor-injected dependencies [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — ChatService]. Concretely: `ChatService.stream(req, onChunk)` is expected to delegate token emission to `AiProvider.streamChat(messages, onChunk)` — the same `onChunk` callback shape flows through both layers, so `AiProvider.streamChat`'s second parameter signature (`onChunk: (token: string) => void`) must stay compatible with what `ChatService.stream`'s own `onChunk` parameter expects (both emit incremental string tokens for SSE forwarding, per FR-19). `ChatService.send` is expected to call `AiProvider.complete(messages)` for non-streaming completion paths and/or `QdrantStore.search` + `RedisCache.get/set` to build RAG context before calling `AiProvider`. This wiring is NOT implemented in this story or in Story 1.2 — it is Epic 3 (Story 3.3 `ChatService` send/stream implementation, Story 3.4 `AiProvider` concrete module) and Epic 5 (Story 5.4 Redis cache wiring) scope. This story only needs to ensure `AiProvider.streamChat`'s `onChunk` shape is consistent with that expected future usage.

**Message shape reused across `AiProvider` and `ChatService`:** Story 1.2 left `ChatService`'s message/request shape as `unknown` pending Story 1.4's `ChatRequest`/`ChatResponse` types [Source: _bmad-output/implementation-artifacts/1-2-repository-service-interface-definitions.md]. This story faces the same gap for `AiProvider.complete(messages)`/`streamChat(messages, ...)`. Per the same discipline Story 1.2 established ("do not invent a competing type"), declare a minimal local `ChatMessage` type in `src/lib/ai/langchain.ts` (`{ role: "user" | "assistant" | "system"; content: string }`), matching the `Role` literal union already used in Story 1.1's `Message.role` and Story 1.2's `MessageService.append(role, ...)`. Leave a comment noting this should be narrowed/aligned to a shared `ChatMessage`/`Role` type from `src/types` once Story 1.4 lands — do not block this story on Story 1.4.

**`Hit` shape for `QdrantStore.search`:** `02-class.md`'s `MockQdrantStore` and `QdrantStore` classes type `search(vec, convId, k)` as returning `Hit[]` without defining `Hit` explicitly elsewhere in the provided docs; FR-14 requires "each vector record references its parent chunk + asset for citation" [Source: _bmad-output/planning-artifacts/04-requirements.md — FR-14]. This story defines `Hit` locally in `qdrant.ts` as `{ chunkId, assetId, score, text }` to satisfy the citation requirement (chunk + asset reference) — this is a reasonable, literal-to-spec shape; Epic 5 (Story 5.2/5.3) may refine it once chunking is implemented, but should not need to break this interface's field names.

**`auth` contract shape — function vs. interface:** `02-class.md`/epics.md describe `auth` as a bare function (`auth()` from `@clerk/nextjs/server`) returning session/userId info, not a class with an interface. This story declares it as a named type for a callable (`type AuthSession = () => Promise<string | null>`) rather than an `interface` with a method, to stay literal to how Story 2.3 will actually call it (`const userId = await auth();`-style, not `authObj.session()`). If the dev agent judges an `interface { session(): ... }` wrapper object is a better fit for testability/mocking (matching the AC's literal wording "`auth` declares `session()`"), either form is acceptable as long as the return type is `Promise<string | null>` (or equivalent) and Story 2.3's concrete Clerk wiring can implement it directly. Document the choice made in the Completion Notes.

**No testing requirement for this story:** Same rationale as Stories 1.1/1.2 — interfaces have no behavior to unit test. The testing foundation (Vitest, coverage gate, mocked externals for OpenAI/LangChain/Qdrant/Jina/Clerk per FR-30/NFR-8) is Story 2.5; `MockJinaProvider`, `MockQdrantStore`, `MockAiProvider` test doubles referenced in `02-class.md` are built out once concrete implementations exist (Story 2.5 onward), not in this story.

### Learnings from Stories 1.1 / 1.2

- Story 1.1 established entity file locations (`src/lib/db/entities/*.entity.ts`) and the "no methods, no wiring, contracts only" scope-discipline pattern that this story continues for integration modules.
- Story 1.2 established the precedent of declaring interfaces directly in the files that will later hold concrete implementations, using `unknown`/local minimal types as placeholders when a canonical shared type (like `ChatRequest`) doesn't exist yet (deferred to Story 1.4) rather than inventing a competing type — this story applies the same placeholder discipline to `ChatMessage`.
- Story 1.2's `ChatService` interface (`send(req, userId)`, `stream(req, onChunk)`, `regenerate(messageId, userId)`) explicitly deferred `AiProvider`/`QdrantStore`/`RedisCache` wiring to this story (1.3) and left only a comment placeholder — this story fulfills that deferred contract but deliberately does NOT go back and edit `src/services/chat.service.ts` to import these new types, keeping each story's file changes scoped to itself (see AC #9).
- Story 1.1/1.2 both flagged `_bmad-output/project-context.md` as a frontend-only doc, silent on backend layers, and therefore non-authoritative/incomplete for backend contract work — the same flag applies here (see Project Structure Notes below); `01-package.md`/`02-class.md`/`05-architecture.md` remain authoritative.
- Story 1.2 confirmed the `Role` literal union (`"user" | "assistant" | "system"`) is not yet a named exported type as of Story 1.1/1.2 (expected to be formalized as a shared `Role` type in Story 1.4) — this story's `ChatMessage.role` uses the same inline literal union for consistency, flagged as the same minor drift risk pending Story 1.4.
[Source: _bmad-output/implementation-artifacts/1-1-entity-type-typeorm-decorator-definitions.md] [Source: _bmad-output/implementation-artifacts/1-2-repository-service-interface-definitions.md]

### Project Structure Notes

- Files to create, matching the authoritative file tree: `src/lib/ai/langchain.ts`, `src/lib/vector/qdrant.ts`, `src/lib/cache/redis.ts`, `src/lib/auth/session.ts`, `src/lib/websearch/jina.ts`, `src/lib/websearch/webSearchTool.ts` [Source: _bmad-output/planning-artifacts/01-package.md#1. File Tree (authoritative)].
- Consistent with Stories 1.1/1.2's convention: interface/type-only declarations at this stage, no method bodies, no framework/SDK wiring (no `ChatOpenAI`, `@langchain/qdrant`, Redis client, `@clerk/nextjs`, Jina HTTP client).
- Do NOT create concrete provider classes/functions, do NOT read env vars (`JINA_API_KEY`), do NOT register any LangChain tool with an agent in this story — those are Epic 2/3/5/7 scope as itemized in Dev Notes above.
- Do NOT modify `src/services/chat.service.ts` (Story 1.2) or any other Story 1.2 file in this story.
- **Conflict flag (carried forward from Stories 1.1/1.2):** `_bmad-output/project-context.md` describes a Next.js 16 / React 19 / Tailwind / shadcn-ui / TanStack Query **frontend-only** stack and is silent on `src/lib/ai`, `src/lib/vector`, `src/lib/cache`, `src/lib/auth`, `src/lib/websearch` backend integration layers. Treat it as incomplete for this backend contract-definition story, not authoritative — follow `01-package.md`, `02-class.md`, and `05-architecture.md` for all structural decisions here, consistent with the precedent set in Stories 1.1/1.2.
- No UI, route handler, migration, or concrete integration/business logic is touched by this story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] — Story text, AC (Given/When/Then), FR-14/FR-22/FR-24/FR-27/FR-28/NFR-2/FR-1/FR-23 tags
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Types & Contracts] — Epic scope: contracts only, no logic
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4] — `AiProvider` concrete implementation is later (Epic 3)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2] [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3] [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4] — `QdrantStore`/`RedisCache` concrete usage is later (Epic 5)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3] — concrete Clerk `auth` wiring is later (Epic 2)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1] [Source: _bmad-output/planning-artifacts/epics.md#Story 7.2] — `WebSearchProvider`/`WebSearchTool` concrete implementation is later (Epic 7)
- [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes] — `AiProvider`, `QdrantStore`, `RedisCache`, `WebSearchProvider`, `JinaProvider`, `WebSearchTool`, `WebResult` shapes; `ChatService` constructor dependencies (`-ai`, `-vector`, `-cache`)
- [Source: _bmad-output/planning-artifacts/01-package.md#1. File Tree (authoritative)] — exact integration module file paths
- [Source: _bmad-output/planning-artifacts/01-package.md#2.4 Integrations — src/lib/{ai,vector,websearch,cache,auth}] — "External systems used directly (no port indirection). Depends on: services call them."
- [Source: _bmad-output/planning-artifacts/01-package.md#3. Dependency Rule] — `app → services → {repositories | ai | vector | websearch | cache}`, no port/adapter abstraction
- [Source: _bmad-output/planning-artifacts/05-architecture.md] — layered architecture diagram, integrations as `src/lib/{ai,vector,websearch,cache,auth}`
- [Source: _bmad-output/planning-artifacts/04-requirements.md] (referenced inline via epics.md Requirements Inventory) — FR-1, FR-14, FR-22, FR-23, FR-24, FR-27, FR-28, NFR-2 text
- [Source: _bmad-output/implementation-artifacts/1-1-entity-type-typeorm-decorator-definitions.md] — scope-discipline precedent, `Role`/`MessageStatus` literal union conventions, project-context.md conflict flag
- [Source: _bmad-output/implementation-artifacts/1-2-repository-service-interface-definitions.md] — `ChatService` interface shape (`send`, `stream`, `regenerate`), deferred `AiProvider`/`QdrantStore`/`RedisCache` wiring, placeholder-typing discipline, project-context.md conflict flag
- [Source: _bmad-output/project-context.md] — frontend stack facts; flagged as non-authoritative/incomplete for this backend story

## Dev Agent Record

### Agent Model Used

Claude Haiku 4.5 (user model preference)

### Debug Log References

### Completion Notes List

### File List
