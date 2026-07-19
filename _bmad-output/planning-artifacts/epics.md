---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - prds/prd-chaiGPT-2026-07-15/prd.md
  - briefs/brief-chaiGPT-2026-07-15/brief.md
  - 01-package.md
  - 02-class.md
  - 03-sequence.md
  - 04-requirements.md
  - 05-architecture.md
  - 07-entity.md
  - 08-object.md
  - 09-component-ishikawa.md
---

# chaiGPT - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for chaiGPT, decomposing the requirements from the PRD, the source brief, and the Architecture/UML artifacts into implementable stories. The target architecture is a layered structure tightly integrated with Next.js (App Router, route handlers, middleware) and TypeORM (entities, migrations, repositories) — separation by concern, no framework-decoupling abstraction layer. The git plan (06-git.md) was intentionally excluded from the input set per user direction.

## Requirements Inventory

### Functional Requirements

FR-1 [Must] Integrate Clerk (`@clerk/nextjs`); Next.js middleware protects routes and route handlers read the session via `auth()` from `@clerk/nextjs/server`.
FR-2 [Must] All conversations and messages are scoped to `userId` (Clerk `sub`).
FR-3 [Must] Unauthenticated requests to protected routes return 401 / redirect.
FR-4 [Must] `Conversation` gains: `userId`, `rootConversationId`, `lastMessageId`, `model`.
FR-5 [Must] `Message` gains: `userId`, `parentId`, `status` enum (`processing` | `complete` | `stopped`), retains `role`/`content`/`model`.
FR-6 [Must] On send: user message saved, trailing assistant message created with `status: processing`; on stream completion -> `complete`; on explicit termination -> content `"user terminated the response"`, `status: stopped`.
FR-7 [Must] Max 500 characters per message; paste > 200 chars -> converted to `.txt` asset and uploaded.
FR-8 [Must] Sibling messages share `parentId`; branched conversations share `rootConversationId`.
FR-9 [Must] Branching from an assistant message creates a sibling under the same parent; sidebar shows only siblings of the active branch.
FR-10 [Must] Editing updates only the most recently created sibling; branching continues from that message.
FR-11 [Must] Editing is content-only, in place (same IDs); does not affect branching; `lastMessageId` unchanged.
FR-12 [Must] Asset upload stages to a shared named Docker volume, embeds via LangChain, deletes original; no external object store in v1. Logical user isolation enforced at the DB layer (`Asset.userId`), not at the volume level.
FR-13 [Must] PDFs chunked page-by-page; TXT/MD chunked at 2000 characters (LangChain splitters).
FR-14 [Must] Qdrant stores one embedding per chunk; top-3 segments retrieved per query, scoped to the current conversation's linked assets via `@langchain/qdrant`. Each vector record references its parent chunk + asset for citation.
FR-15 [Must] Retrieved context is injected into the prompt before completion.
FR-16 [Should] Assets referenced in deleted assistant replies are preserved and shown; user may explicitly delete.
FR-17 [Should] In edit mode, trailing assistant asset references remain visible with an option to remove per user action.
FR-18 [Should] A `status: stopped` assistant message is re-runnable: the user can regenerate a new completion that overwrites the same message ID (`status` -> `processing` -> `complete`). This does not create a branch.
FR-19 [Must] Chat completions stream via SSE (existing behavior, preserved).
FR-20 [Must] Inbound requests validated with Zod (`ChatRequestSchema`, `ConversationSchema`, etc.).
FR-21 [Must] Tightly integrated layered architecture: Next.js App Router route handlers are the entry point; services hold use-case logic; TypeORM entities + repositories own persistence (Postgres). No framework-decoupling abstraction layer is required — coupling to Next.js and TypeORM is approved.
FR-22 [Should] AI provider kept behind a thin `AiProvider` module (LangChain) so the model can be swapped without rewriting services; not a hard port boundary.
FR-23 [Should] Cross-cutting concerns (Clerk auth, logging) handled by Next.js middleware / route-handler helpers rather than a separate interceptor framework.
FR-24 [Should] Integrate a Jina web-search client (Jina AI Search/Reader API) as a thin module (`JinaProvider`/`WebSearchProvider`) that issues live web queries and normalizes results (title, URL, snippet/content).
FR-25 [Must] Jina API configured via `JINA_API_KEY` env var; key never hard-coded; fails closed with clear error when missing.
FR-26 [Should] Jina web results available as an additional context source in retrieval, alongside Qdrant RAG. Web-sourced context injected into prompt before completion (consistent with FR-15); each result carries source URL for citation. Supplements, does not replace, per-conversation RAG (FR-14).
FR-27 [Must] Expose web search as a LangChain tool the LLM can invoke, so the model decides when a live web lookup is warranted. Distinct from RAG over uploaded docs (FR-14).
FR-28 [Should] Tool defined with typed schema (name, description, Zod-validated input args) registered with AiProvider/agent; tool-calls routed to Jina client (FR-24); results + source URLs captured for citation/observability.
FR-29 [Must] Unit tests use Vitest, colocated with code under test (services + repositories), e.g. `*.test.ts` next to each.
FR-30 [Must] External deps mocked in unit tests — OpenAI/LangChain, Qdrant, Jina, Clerk — so unit tests run offline/deterministically, no network.
FR-31 [Must] Coverage gate enforces ≥80% coverage of services + repositories (ties to NFR-7); fails below threshold; enforced in CI.
FR-32 [Must] E2E tests use Playwright (best fit for Next.js 16 App Router — Clerk-auth flows, streaming SSE UI).
FR-33 [Must] E2E scope covers auth-gated flows, branching, asset upload, RAG answers, and web search.
FR-34 [Should] E2E runs against Docker Compose stack (Postgres + Qdrant) to exercise real persistence + vector retrieval; a smoke subset (auth, branch, asset, RAG, search) gates CI.

### NonFunctional Requirements

NFR-1 SOLID / single-responsibility per layer — Inspection.
NFR-2 Horizontal scale — stateless route handlers, externalized stores (Postgres/Qdrant/Redis) — Analysis.
NFR-3 Auth latency overhead — < 50 ms per request (p95).
NFR-4 RAG retrieval latency — < 300 ms (p95) for top-3.
NFR-5 Streaming time-to-first-token — < 1 s.
NFR-6 DB migrations are reversible (TypeORM) — Required for prod.
NFR-7 Test coverage of services + repositories — >= 80%.
NFR-8 Unit tests deterministic & offline (externals mocked: OpenAI, Qdrant, Jina, Clerk) via Vitest — Required for CI.
NFR-9 E2E smoke suite (Playwright) green against Docker Compose (Postgres + Qdrant) — Required gate in CI.
NFR-10 Web search latency overhead (Jina query round-trip) — < 1.5 s (p95).

### Additional Requirements

- Infrastructure: PostgreSQL + Qdrant + app via `infra/docker-compose.yml`; named Docker volume for assets created on `start:dev:infra`/`start:prod`, deleted on stop only if explicitly provided. (brief #6)
- npm scripts: `start:dev`, `start:dev:infra`, `stop:dev:infra`, `start:prod`, `stop:prod`. (brief Infra, PRD §11)
- Migrate TypeORM from SQLite to Postgres; fresh start, clean existing SQLite data. (brief #4, PRD §11, FR-21)
- Starter data model v2: `Conversation` (userId, rootConversationId, lastMessageId, model), `Message` (userId, parentId, status, role, content, model), `Asset` (userId, conversationId, filename, mime, path). (PRD §9, FR-4/5/12)
- Entity chunking: PDF page-by-page, TXT/MD 2000-char via LangChain splitters. (FR-13)
- RAG: per-chunk embedding; top-3 per query scoped to current conversation's linked assets; vector record references parent chunk + asset for citation. (FR-14)
- AiProvider thin module wraps LangChain `ChatOpenAI` streaming; model swappable without rewriting services. (FR-22)
- Cache: Redis KV for RAG context reuse keyed by conversationId. (05-architecture, 03-sequence #6)
- Markdown rendering for message content. (brief #7)
- Shared `lib/types`, `lib/utils`, `lib/validation/schemas.ts` (Zod). (FR-20, 01-package)
- Stateless route handlers; externalized stores for horizontal scale. (NFR-2)

### UX Design Requirements

- UX-DR1 [Existing UI shell] Preserve flat chat UI with sidebar conversation list; gate behind Clerk auth. (brief Current State)
- UX-DR2 [Branch-aware sidebar] When a branch exists, sidebar shows only sibling branches of the active branch, not the full tree. (FR-9, brief #5)
- UX-DR3 [Streaming chat view] Render streamed assistant tokens live (SSE) with eventual complete/stopped state. (FR-6, FR-19)
- UX-DR4 [Markdown rendering] Render message content as Markdown. (brief #7)
- UX-DR5 [Large-paste-to-txt] On paste > 200 chars, convert to a `.txt` asset and show as an asset reference in the message. (FR-7)
- UX-DR6 [Edit-latest affordance] Only the most recent user message is editable; trailing assistant reply shows edit/regenerate controls; past/edited messages disabled. (FR-10, FR-11, FR-18)
- UX-DR7 [Asset references visible in edit mode] Trailing assistant asset references remain visible in edit mode with an option to remove per user action. (FR-17)
- UX-DR8 [Asset lifecycle UI] Upload assets; view assets preserved in deleted replies; explicitly delete assets. (FR-12, FR-16)

### FR Coverage Map

| FR | Epic |
|----|------|
| FR-1 | E2 (contract E1) |
| FR-2 | E1, E3, E4, E5 |
| FR-3 | E2 |
| FR-4 | E3 |
| FR-5 | E3 |
| FR-6 | E3 |
| FR-7 | E3, E6 |
| FR-8 | E4 |
| FR-9 | E4, E6 |
| FR-10 | E4 |
| FR-11 | E4 |
| FR-12 | E5 |
| FR-13 | E5 |
| FR-14 | E5 |
| FR-15 | E3, E5 |
| FR-16 | E5 |
| FR-17 | E5 |
| FR-18 | E3, E4 |
| FR-19 | E3 |
| FR-20 | E1 |
| FR-21 | E1, E2, E3 |
| FR-22 | E1, E3 |
| FR-23 | E1, E2 |
| FR-24 | E1, E7 |
| FR-25 | E2, E7 |
| FR-26 | E3, E7 |
| FR-27 | E1, E7 |
| FR-28 | E3, E7 |
| FR-29 | E2 |
| FR-30 | E2 |
| FR-31 | E2 |
| FR-32 | E2 |
| FR-33 | E2, E6 |
| FR-34 | E2 |

## Epic List

- E1: Types & Contracts (all type/interface/schema definitions first)
- E2: Foundation & Infra (Docker, Postgres migrations, Clerk, Layered Skeleton)
- E3: Conversation & Message Core (services, streaming, editing)
- E4: Branching
- E5: Assets & RAG
- E6: UI Integration & Branch-Aware Experiences
- E7: Web Search (Jina API + LangChain Tool)

<!-- Epics defined below -->

## Epic 1: Types & Contracts (Interface & Type Definitions First)

Define every type, interface, and schema contract before any logic is written. This epic delivers the contract layer all later epics depend on: TypeORM entity class definitions, repository/service interface signatures, integration module interfaces (`AiProvider`, `QdrantStore`, `RedisCache`, `auth`), and Zod validation schemas. No behavior is implemented here — only the shapes and signatures that downstream logic conforms to. Establishes FR-20, FR-21, FR-22 contracts and the layered dependency rule.

### Story 1.1: Entity Type & TypeORM Decorator Definitions

As a Maintainer,
I want the v2 entity class definitions with their field shapes and decorators,
So that every later epic programs against a fixed data model.

**Acceptance Criteria:**

**Given** the v2 data model in PRD §9
**When** entity classes are declared
**Then** `Conversation` class defines `id`, `userId`, `rootConversationId?`, `lastMessageId?`, `title`, `model?`, `createdAt`, `updatedAt` (FR-4)

**And** `Message` class defines `id`, `conversationId`, `userId`, `parentId?`, `role`, `content`, `model?`, `status`, `createdAt` (FR-5)

**And** `Asset` class defines `id`, `userId`, `conversationId`, `filename`, `mime`, `path`, `createdAt` (FR-12)

**And** `status` is a string union type `processing | complete | stopped` (FR-5)

### Story 1.2: Repository & Service Interface Definitions

As a Maintainer,
I want the repository and service interface signatures defined,
So that logic epics implement against stable contracts.

**Acceptance Criteria:**

**Given** the service layer design in `02-class.md`
**When** interface types are declared
**Then** `ConversationRepository`, `MessageRepository`, `AssetRepository` interfaces declare `findById(id, userId)`, `findAll(userId)`, `save`, `updateStatus(id, status)` (FR-2)

**And** `ConversationService`, `MessageService`, `ChatService`, `AssetService` interface signatures are declared with their method shapes (`list`, `create`, `getById`, `branch`, `append`, `editLatest`, `send`, `regenerate`, `ingest`, `remove`) (FR-21)

**And** every repository query signature carries `userId` for scoping (FR-2)

### Story 1.3: Integration Module Interface Contracts

As a Maintainer,
I want the integration module interface contracts defined,
So that services depend on interfaces, not concrete providers.

**Acceptance Criteria:**

**Given** the integrations in `05-architecture.md`
**When** interface types are declared
**Then** `AiProvider` declares `complete(messages)` and `streamChat(messages, onChunk)` (FR-22)

**And** `QdrantStore` declares `embed(text)`, `search(vec, convId, k)`, `upsertChunks(assetId, chunks)` (FR-14)

**And** `RedisCache` declares `get(k)`, `set(k, v, ttl)` (NFR-2)

**And** `auth` declares `session()` returning `userId` (FR-1, FR-23)

**And** `WebSearchProvider` declares `search(query)` returning normalized results `{title, url, snippet}` (FR-24)

**And** `WebSearchTool` declares `run(query)` (Zod schema) routed to `WebSearchProvider` (FR-27, FR-28)

### Story 1.4: Zod Validation Schemas & Shared App Types

As a Maintainer,
I want Zod request schemas and shared app types,
So that every inbound request is validated against a single contract.

**Acceptance Criteria:**

**Given** `src/types` and `src/lib/validation`
**When** schemas and types are declared
**Then** `lib/validation/schemas.ts` exports `ChatRequestSchema`, `ConversationSchema`, `AssetSchema`, etc. used to validate inbound requests (FR-20)

**And** `src/types` exports `ChatRequest`, `ChatResponse`, `Role` shapes matching `02-class.md` view B (FR-21)

**And** `lib/utils.ts` shared helpers are defined (FR-21)

**And** Zod `WebSearchArgsSchema` is defined for the LangChain tool input contract (FR-28)

## Epic 2: Foundation & Infra (Docker, Postgres, Clerk, Layered Skeleton)

Stand up the runnable foundation that the contract layer from E1 binds to: Dockerized Postgres + Qdrant with a named volume and npm lifecycle scripts, the Postgres DataSource + reversible migrations, Clerk authentication via Next.js middleware + `auth()`, and the layered package skeleton. Delivers G1 (authenticated, account-scoped) and the substrate every logic epic builds on.

**Existing repo note:** The Next.js 16 App Router skeleton already exists, so no scaffold story is required. The existing backend (SQLite/TypeORM `Conversation`/`Message`, flat LangChain streaming, no auth/branching/assets/RAG) is NOT reused — only the existing UI shell is retained. Build the plan directly on the repo, removing or replacing the legacy backend code (SQLite entities, old route handlers,旧 integrations) rather than carrying it forward.

### Story 2.1: Dockerized Infra & Lifecycle Scripts

As a Platform Engineer,
I want Postgres + Qdrant + app defined in `infra/docker-compose.yml` with named Docker volume and npm lifecycle scripts,
So that I can bring up and tear down consistent dev/prod environments.

**Acceptance Criteria:**

**Given** the repository on a machine with Docker installed
**When** I run `npm run start:dev:infra`
**Then** a named Docker volume is created (if not exists) and Postgres + Qdrant start via Docker Compose

**And** `npm run start:dev` also starts the Next.js app on the host after infra is up

**And** `npm run stop:dev:infra` stops the containers and deletes the volume only if it was explicitly provided

**And** equivalent `start:prod`/`stop:prod` scripts build and run the full production stack

### Story 2.2: Postgres DataSource & Reversible Migrations

As a Maintainer,
I want a Postgres DataSource and reversible TypeORM migrations,
So that schema evolves safely on an externalized store.

**Acceptance Criteria:**

**Given** Postgres is running via `start:dev:infra`
**When** I run the TypeORM migration command
**Then** the v2 schema from the E1 entity definitions is applied against Postgres and is reversible (down migration exists)

**And** SQLite is retired and existing local SQLite data is cleared for a fresh start (NFR-6)

### Story 2.3: Clerk Auth Middleware & Session Helper

As a user,
I want Clerk to protect routes and let handlers read my session,
So that my conversations stay private to me.

**Acceptance Criteria:**

**Given** `@clerk/nextjs` is installed and keys are in `.env`
**When** an unauthenticated request hits a protected route
**Then** the request returns 401 / redirect (FR-3)

**And** `src/app/middleware.ts` guards protected routes and route handlers obtain `userId` via the E1 `auth` contract (`auth()` from `@clerk/nextjs/server`) (FR-1, FR-23)

**And** auth session resolution adds < 50 ms p95 overhead (NFR-3)

### Story 2.4: Layered Package Skeleton

As a Maintainer,
I want the layered package structure created,
So that all features follow the approved concern-separated architecture.

**Acceptance Criteria:**

**Given** the project root
**When** I inspect `src/`
**Then** the structure matches `01-package.md`: `app/`, `services/`, `lib/db`, `lib/ai`, `lib/vector`, `lib/cache`, `lib/auth`, `lib/validation`, `types/`, and `schema/` (FR-21)

**And** dependency direction is `app -> services -> {repositories | ai | vector | cache}` with no port/adapter layer (NFR-1)

### Story 2.5: Testing Foundation (Vitest + ≥80% Coverage Gate)

As a Maintainer,
I want a test harness with repository and service fixtures and a coverage gate,
So that NFR-7 (≥80% coverage of services + repositories) is enforced in CI.

**Acceptance Criteria:**

**Given** the project root after E2.1–E2.4 are in place
**When** the test foundation is set up
**Then** Vitest is configured with a coverage reporter for `src/services` and `src/lib/db/repositories`

**And** seedable test fixtures exist for `ConversationRepository`, `MessageRepository`, and `AssetRepository` against a disposable Postgres (or in-memory TypeORM) instance

**And** a CI step fails the build if service + repository coverage is below 80% (NFR-7)

**And** test files are colocated with source (`*.test.ts` next to each service/repository) (FR-29)

**And** OpenAI, LangChain, Qdrant, Jina, and Clerk are mocked in unit tests so tests run offline/deterministically (FR-30, NFR-8)

**And** the coverage gate enforces ≥80% and fails CI below threshold (FR-31)

**And** at least one representative test exists per repository and per service introduced in E3/E4/E5 as those epics land

### Story 2.6: E2E Test Harness (Playwright + Docker Compose)

As a Maintainer,
I want an e2e suite (Playwright) running against the Docker Compose stack,
So that critical user journeys (auth, branching, asset upload, RAG, web search) are verified in CI.

**Acceptance Criteria:**

**Given** the project after E2.1–E2.5 are in place
**When** the e2e suite is defined and run
**Then** Playwright is configured and `npx playwright install` runs in CI (FR-32)

**And** the suite runs against `docker compose up` (Postgres + Qdrant) with a DB reset between suites (FR-34)

**And** it covers auth-gated flows, branching, asset upload, RAG, and web search (FR-33, NFR-9)

**And** a smoke subset (auth, branch, asset, RAG, search) gates CI (FR-33, FR-34, NFR-9)

## Epic 3: Conversation & Message Core (Services, Streaming, Editing)

Implement the logic against the E1 contracts and E2 foundation: concrete entities/repositories wired to Postgres, ConversationService, ChatService SSE streaming with per-conversation RAG context, message status lifecycle, AiProvider, edit-latest, regenerate, and the 500-char/large-paste rule. Delivers G2 baseline chat, FR-4..FR-7, FR-15, FR-18, FR-19, FR-22.

### Story 3.1: Concrete Entities & TypeORM Repositories

As a Maintainer,
I want the concrete TypeORM entities and repositories implemented against the E1 contracts,
So that conversations, messages, and assets are correctly persisted and user-scoped.

**Acceptance Criteria:**

**Given** the E1 entity and repository interface definitions
**When** implementations are written
**Then** `ConversationRepository`, `MessageRepository`, `AssetRepository` implement the E1 interfaces and enforce `userId` scoping on every query (FR-2)

**And** `AssetRepository` implements `save`, `findByConversation`, `delete` (FR-12)

**And** `MessageRepository` implements `findByConversation`, `save`, `updateStatus` (FR-5, FR-6)

### Story 3.2: ConversationService (list/create/getById)

As a user,
I want to list, create, and open my conversations,
So that I can manage my account-scoped chat history.

**Acceptance Criteria:**

**Given** an authenticated `userId`
**When** I call `ConversationService.list(userId)`
**Then** only conversations with that `userId` are returned, ordered by `updatedAt` DESC, limited to 50

**And** `create(userId, input)` persists a `Conversation` with `userId` and default `model` (FR-2, FR-4)

**And** `getById(id, userId)` returns 404 when the conversation belongs to another user (FR-2)

### Story 3.3: ChatService Send with SSE Stream & Status Lifecycle

As a user,
I want to send a message and watch the reply stream live,
So that I get fast feedback and a persisted record.

**Acceptance Criteria:**

**Given** an authenticated user sends a `ChatRequest`
**When** `ChatService.send(req, userId)` runs
**Then** the user message is saved and a trailing assistant message is created with `status: processing` (FR-6)

**And** tokens stream to the client via SSE live AND accumulate in a server-side buffer (FR-19)

**And** on stream completion the assistant message is persisted with `status: complete` from the buffer (FR-6)

**And** on explicit termination the assistant message content is `"user terminated the response"` with `status: stopped` (FR-6)

**And** web-sourced context (Jina, FR-26) is an additional retrieval source injected before completion alongside Qdrant RAG (FR-15)

**And** time-to-first-token is < 1 s (NFR-5)

### Story 3.4: AiProvider Concrete Module (Streaming)

As a Maintainer,
I want the concrete `AiProvider` implementing the E1 interface with LangChain `ChatOpenAI` streaming,
So that I can swap the model without rewriting services.

**Acceptance Criteria:**

**Given** the `lib/ai/langchain.ts` module implementing the E1 `AiProvider` contract
**When** `ChatService` calls `AiProvider.streamChat(messages, onChunk)`
**Then** tokens are emitted to `onChunk` and the stream completes

**And** the default model is `gpt-4o-mini` and can be swapped by changing only this module, not the services (FR-22)

**And** the agent registers the `WebSearchTool` (FR-27, FR-28) so the model can invoke live web search; tool calls route to `WebSearchProvider` (FR-24)

### Story 3.5: Message Editing (Edit-Latest, In-Place)

As a user,
I want to edit my latest user message in place,
So that I can correct a typo without creating a branch.

**Acceptance Criteria:**

**Given** the most recently created sibling message by the user
**When** `MessageService.editLatest(userId, convId, content)` runs
**Then** only that message and its trailing assistant reply are updated content-only with the same IDs (FR-11)

**And** branching is unaffected and `lastMessageId` is unchanged (FR-10, FR-11, KI-2)

**And** only the latest user message is editable; earlier messages are disabled (brief #7)

### Story 3.6: Regenerate Stopped Message (Re-run, Same ID)

As a user,
I want to regenerate a stopped assistant message,
So that I can get a fresh completion without making a branch.

**Acceptance Criteria:**

**Given** an assistant message with `status: stopped`
**When** `ChatService.regenerate(messageId, userId)` runs
**Then** the same message ID is set to `processing`, re-streamed via SSE, and overwritten with `status: complete` (FR-18)

**And** no new sibling/branch is created (FR-18, KI-1)

### Story 3.7: 500-Char Limit & Large-Paste-to-TXT

As a user,
I want a 500-character cap and auto-conversion of long pastes to a `.txt` asset,
So that I stay within limits and keep long content as an asset.

**Acceptance Criteria:**

**Given** a message draft
**When** its length exceeds 500 characters (hard cap) or a paste exceeds 200 characters
**Then** the over-length content is converted to a `.txt` asset and uploaded, and the message references it (FR-7)

**And** the inline message body stays within the 500-char limit (FR-7)

## Epic 4: Branching

Implement sibling branching from assistant messages, branch-aware conversation creation, and edit/regenerate behavior within branches, against the E1/E3 contracts. Delivers G2 branching, FR-8..FR-11, FR-18.

### Story 4.1: Branch Creation (Sibling Under Same Parent)

As a user,
I want to branch from any assistant message,
So that I can explore alternatives.

**Acceptance Criteria:**

**Given** an assistant message with `parentId` P in conversation C
**When** `ConversationService.branch(id, messageId, userId)` runs
**Then** a new conversation is created sharing `rootConversationId` of C and the branched message becomes a sibling under the same `parentId` (FR-8)

**And** the new branch is scoped to the same `userId` (FR-2)

### Story 4.2: Edit Continues from Most-Recent Sibling

As a user,
I want edits to target the most recently created sibling,
So that branching continues from my latest message.

**Acceptance Criteria:**

**Given** multiple sibling messages under one `parentId`
**When** the user edits
**Then** only the most recently created sibling is updated (FR-10)

**And** further conversation continues from that sibling; retries on an already-branched message are ignored (FR-10, KI-1)

### Story 4.3: Regenerate Within a Branch

As a user,
I want to regenerate a stopped message inside a branch,
So that I can retry without leaving the branch.

**Acceptance Criteria:**

**Given** a stopped assistant message within a branched conversation
**When** regenerate is requested
**Then** the same message ID is overwritten in place (Epic 3 Story 3.6 behavior) with no new branch (FR-18)

## Epic 5: Assets & RAG

Implement the asset lifecycle (upload -> embed -> delete original on shared volume), Qdrant per-chunk embeddings with per-conversation top-3 retrieval, prompt injection, Redis context cache, and asset preservation/deletion, against the E1 contracts. Delivers G3, G4, FR-12..FR-17, FR-15.

### Story 5.1: Asset Upload Pipeline (Volume + Embed + Delete Original)

As a user,
I want to upload a document that gets embedded and stored,
So that the model can retrieve from it later.

**Acceptance Criteria:**

**Given** an authenticated user uploads a PDF/TXT/MD to `/api/assets`
**When** `AssetService.ingest(userId, convId, file)` runs
**Then** the file is staged to the shared named Docker volume, embedded via LangChain, and the original is deleted (FR-12)

**And** an `Asset` row is persisted with `userId`/`conversationId`/`filename`/`mime`/`path` (FR-12, FR-2)

**And** logical isolation is enforced at the DB layer via `Asset.userId`, not at the volume level (FR-12)

### Story 5.2: Chunking & Per-Chunk Embeddings

As a Maintainer,
I want deterministic chunking and one embedding per chunk,
So that retrieval is accurate and citable.

**Acceptance Criteria:**

**Given** an uploaded PDF or TXT/MD
**When** chunking runs
**Then** PDFs are split page-by-page and TXT/MD at 2000 characters via LangChain splitters (FR-13)

**And** Qdrant stores exactly one embedding per chunk (FR-14)

**And** each vector record references its parent chunk index + asset id for citation (FR-14)

### Story 5.3: Per-Conversation Top-3 Retrieval & Prompt Injection

As a user,
I want the model to use my uploaded docs for the current conversation,
So that answers are grounded in my files.

**Acceptance Criteria:**

**Given** a chat request in conversation C with linked assets
**When** `QdrantStore.search(embed(lastUser), C, k=3)` runs
**Then** only the top-3 chunks linked to C's assets are returned (FR-14)

**And** retrieval latency is < 300 ms p95 (NFR-4)

**And** retrieved context is injected into the prompt before completion (FR-15)

### Story 5.4: Redis KV Cache for RAG Context Reuse

As a Maintainer,
I want a Redis cache for RAG context keyed by conversation,
So that repeated retrieval is fast and stateless handlers scale.

**Acceptance Criteria:**

**Given** `lib/cache/redis.ts` implementing the E1 `RedisCache` contract
**When** `ChatService` requests context for a conversation
**Then** a cache hit returns stored context; on miss it embeds + searches Qdrant and caches with a TTL (03-sequence #6)

**And** route handlers remain stateless and stores externalized (NFR-2)

### Story 5.5: Asset Preservation & Explicit Delete

As a user,
I want assets in deleted replies preserved and deletable,
So that history stays coherent and I control cleanup.

**Acceptance Criteria:**

**Given** an assistant reply referencing assets is deleted
**When** the conversation is viewed
**Then** the referenced assets are preserved and shown (FR-16)

**And** the user may explicitly delete an asset via `AssetsRoute DELETE` (FR-16)

### Story 5.6: Edit-Mode Asset References

As a user,
I want trailing assistant asset references visible in edit mode with a remove option,
So that I can prune attachments when correcting a message.

**Acceptance Criteria:**

**Given** the user is in edit mode on the latest message
**When** the trailing assistant reply has asset references
**Then** those references remain visible with an option to remove per user action (FR-17)

## Epic 6: UI Integration & Branch-Aware Experiences

Wire the existing flat chat UI to the services from E3/E4/E5, Clerk-gated, with branch-aware sidebar, live streaming render, Markdown, large-paste-to-txt, edit/regenerate controls, and asset lifecycle UI. Delivers UX-DR1..UX-DR8 and G1..G4 end-to-end.

### Story 6.1: Clerk-Gated Chat UI Shell

As a user,
I want the chat UI gated by Clerk,
So that only signed-in users see their conversations.

**Acceptance Criteria:**

**Given** the existing flat chat UI (sidebar + composer)
**When** an unauthenticated user loads it
**Then** they are redirected to sign-in (FR-3)

**And** signed-in users see only their own conversations (FR-2, UX-DR1)

### Story 6.2: Branch-Aware Sidebar

As a user,
I want the sidebar to show only sibling branches of the active branch,
So that I'm not lost in the full tree.

**Acceptance Criteria:**

**Given** a branched conversation with siblings
**When** the sidebar renders
**Then** only siblings of the active branch are shown, not the entire tree (FR-9, UX-DR2)

### Story 6.3: Live Streaming & Markdown Rendering

As a user,
I want streamed tokens rendered live as Markdown,
So that I read formatted assistant replies as they arrive.

**Acceptance Criteria:**

**Given** an SSE stream from `ChatService`
**When** tokens arrive
**Then** they render progressively with a complete/stopped final state (FR-19, FR-6, UX-DR3)

**And** message content is rendered as Markdown (UX-DR4, brief #7)

**And** streamed assistant replies may include web-source citations when web search was used (FR-26)

### Story 6.4: Edit & Regenerate Controls

As a user,
I want edit (latest only) and regenerate controls on my messages,
So that I can correct or retry.

**Acceptance Criteria:**

**Given** the latest user message and its trailing assistant reply
**When** the UI shows controls
**Then** only the latest user message is editable and earlier messages are disabled (FR-10, FR-11, UX-DR6)

**And** a stopped assistant message exposes a regenerate action that overwrites the same ID (FR-18, UX-DR6)

### Story 6.5: Large-Paste-to-TXT & Asset Lifecycle UI

As a user,
I want long pastes turned into `.txt` assets and an asset management UI,
So that I can attach docs and manage them.

**Acceptance Criteria:**

**Given** a paste > 200 chars in the composer
**When** it is submitted
**Then** it becomes a `.txt` asset shown as a reference in the message (FR-7, UX-DR5)

**And** the UI supports uploading assets, viewing assets preserved in deleted replies, and explicitly deleting them (FR-12, FR-16, UX-DR8)

**And** in edit mode, trailing assistant asset references are visible with a remove option (FR-17, UX-DR7)

## Epic 7: Web Search (Jina API + LangChain Tool)

Delivers G7, FR-24..FR-28, FR-26 context injection.

### Story 7.1: Jina Web-Search Client (`JinaProvider`)

As a Maintainer,
I want a thin Jina client module,
So that the model can fetch live web results.

**Acceptance Criteria:**

**Given** the E1 `WebSearchProvider` contract
**When** `lib/websearch/jina.ts` is implemented
**Then** it reads `JINA_API_KEY` from env, fails closed with a clear error if missing (FR-25)

**And** it issues a query to Jina and normalizes results to `{title, url, snippet}` (FR-24)

**And** query latency is < 1.5 s p95 (NFR-10)

### Story 7.2: WebSearchTool (LangChain)

As a Maintainer,
I want a LangChain tool wrapping the Jina client,
So that the LLM decides when to search the web.

**Acceptance Criteria:**

**Given** the E1 `WebSearchTool` contract and Zod `WebSearchArgsSchema` (FR-28)
**When** the tool is registered with the agent / `AiProvider`
**Then** on invocation it routes to `WebSearchProvider.search` (FR-24)

**And** results and source URLs are captured for citation and observability (FR-26)

**And** if Jina is unavailable the tool degrades gracefully without crashing the agent

### Story 7.3: Web Context Injection

As a user,
I want web results included when relevant,
So that answers cite live sources.

**Acceptance Criteria:**

**Given** a chat request where the LLM invokes web search
**When** `ChatService` builds the prompt
**Then** Jina web context is injected before completion alongside Qdrant RAG (FR-15, FR-26)

**And** each web result carries its source URL for citation (FR-26)

**And** web context supplements the per-conversation RAG and does not replace it (FR-14)
