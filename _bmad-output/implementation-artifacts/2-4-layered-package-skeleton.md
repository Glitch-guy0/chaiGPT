# Story 2.4: Layered Package Skeleton

Status: review

## Story

As a Maintainer,
I want the layered package structure created,
so that all features follow the approved concern-separated architecture.

## Acceptance Criteria

1. **Given** the project root
   **When** I inspect `src/`
   **Then** the structure matches `01-package.md`: `app/`, `services/`, `lib/db`, `lib/ai`, `lib/vector`, `lib/websearch`, `lib/cache`, `lib/auth`, `lib/validation`, `types/`, and `schema/` exist as directories (FR-21)

2. **And** `src/app/api/assets/route.ts` exists (placeholder) — the only route handler missing from the tree

3. **And** `schema/entity/`, `schema/cache/`, `schema/vector/` exist at project root

4. **And** `tests/unit/`, `tests/fixtures/`, and `e2e/` exist at project root

5. **And** `src/lib/db/migrations/` directory exists (empty; Story 2.2 adds migration files)

6. **And** dependency direction is `app -> services -> {repositories | ai | vector | websearch | cache}` with no port/adapter layer (NFR-1)

7. **And** `tsconfig.json` `paths` alias `@/*` maps to `./src/*` — already in place, verified not broken

8. **And** no existing Epic 1 files are overwritten: entity classes, repository interfaces, service interfaces, integration interfaces (`AiProvider`, `QdrantStore`, `RedisCache`, `Session`, `WebSearchProvider`, `WebSearchTool`), Zod schemas, app types, and `utils.ts` are preserved exactly

## Tasks / Subtasks

- [x] Task 1: Create missing route handler placeholder (AC: #2)
  - [x] Create `src/app/api/assets/route.ts` with a minimal placeholder exporting empty `GET` and `POST` handlers returning `501 Not Implemented`
  - [x] Include `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"` to match existing route conventions

- [x] Task 2: Create `src/lib/db/migrations/` directory (AC: #5)
  - [x] Create `src/lib/db/migrations/.gitkeep` to preserve the empty directory in git
  - [x] Do NOT create or modify `src/lib/db/data-source.ts` — that is Story 2.2 scope
  - [x] Do NOT modify `src/lib/db/index.ts` — legacy SQLite DataSource; Story 2.2 replaces it

- [x] Task 3: Create `schema/` directory tree (AC: #3)
  - [x] Create `schema/entity/.gitkeep`
  - [x] Create `schema/cache/.gitkeep`
  - [x] Create `schema/vector/.gitkeep`

- [x] Task 4: Create `tests/` and `e2e/` directories (AC: #4)
  - [x] Create `tests/unit/.gitkeep`
  - [x] Create `tests/fixtures/.gitkeep`
  - [x] Create `e2e/.gitkeep`

- [x] Task 5: Verify `src/app/middleware.ts` placement (AC: #1, #6)
  - [x] Do NOT create `src/app/middleware.ts` — that is Story 2.3 scope
  - [x] Verify the file does not already exist at `src/app/middleware.ts` (confirmed: it does not)
  - [x] Document in completion notes that middleware.ts is expected at `src/app/middleware.ts` per `01-package.md`

- [x] Task 6: Verify tsconfig path alias (AC: #7)
  - [x] Confirm `tsconfig.json` already contains `"@/*": ["./src/*"]` under `compilerOptions.paths` — confirmed present
  - [x] Confirm `experimentalDecorators` and `emitDecoratorMetadata` are enabled — confirmed present (required by TypeORM)

- [x] Task 7: Verify no overwrites of existing files (AC: #8)
  - [x] Confirm these files exist and are NOT modified:
    - `src/lib/db/entities/conversation.entity.ts` (E1 Story 1.1)
    - `src/lib/db/entities/message.entity.ts` (E1 Story 1.1)
    - `src/lib/db/entities/asset.entity.ts` (E1 Story 1.1)
    - `src/lib/db/repositories/conversation.repository.ts` (E1 Story 1.2)
    - `src/lib/db/repositories/message.repository.ts` (E1 Story 1.2)
    - `src/lib/db/repositories/asset.repository.ts` (E1 Story 1.2)
    - `src/services/chat.service.ts` (E1 Story 1.2)
    - `src/services/conversation.service.ts` (E1 Story 1.2)
    - `src/services/message.service.ts` (E1 Story 1.2)
    - `src/services/asset.service.ts` (E1 Story 1.2)
    - `src/lib/ai/langchain.ts` (E1 Story 1.3)
    - `src/lib/vector/qdrant.ts` (E1 Story 1.3)
    - `src/lib/cache/redis.ts` (E1 Story 1.3)
    - `src/lib/auth/session.ts` (E1 Story 1.3)
    - `src/lib/websearch/jina.ts` (E1 Story 1.3)
    - `src/lib/websearch/webSearchTool.ts` (E1 Story 1.3)
    - `src/lib/validation/schemas.ts` (E1 Story 1.4)
    - `src/lib/utils.ts` (E1 Story 1.4)
    - `src/types/index.ts` (E1 Story 1.4)
    - `src/types/chat.ts` (E1 Story 1.4)

- [x] Task 8: Verify final directory tree matches `01-package.md` (AC: #1)
  - [x] Run a directory listing of `src/` and confirm every directory in the `01-package.md` tree exists
  - [x] Confirm no unexpected extra directories exist outside the spec

## Dev Notes

### Existing Code Inventory

The following files already exist from Epic 1 (interfaces/contracts) and legacy code. **DO NOT overwrite any of them.**

**Entity classes (E1 Story 1.1) — all at `src/lib/db/entities/`:**
- `conversation.entity.ts` — TypeORM `@Entity('conversations')` with `id`, `userId`, `rootConversationId?`, `lastMessageId?`, `title`, `model?`, `createdAt`, `updatedAt`
- `message.entity.ts` — TypeORM `@Entity('messages')` with `id`, `conversationId`, `userId`, `parentId?`, `role`, `content`, `model?`, `status`, `createdAt`. Exports `MessageStatus` type.
- `asset.entity.ts` — TypeORM `@Entity('assets')` with `id`, `userId`, `conversationId`, `filename`, `mime`, `path`, `createdAt`

**Repository interfaces (E1 Story 1.2) — all at `src/lib/db/repositories/`:**
- `conversation.repository.ts` — `ConversationRepository` interface
- `message.repository.ts` — `MessageRepository` interface
- `asset.repository.ts` — `AssetRepository` interface

**Service interfaces (E1 Story 1.2) — all at `src/services/`:**
- `chat.service.ts` — `ChatService` interface
- `conversation.service.ts` — `ConversationService` interface
- `message.service.ts` — `MessageService` interface
- `asset.service.ts` — `AssetService` interface

**Integration interfaces (E1 Story 1.3):**
- `src/lib/ai/langchain.ts` — `AiProvider` interface
- `src/lib/vector/qdrant.ts` — `QdrantStore` interface, `Hit` and `Chunk` types
- `src/lib/cache/redis.ts` — `RedisCache` interface
- `src/lib/auth/session.ts` — `Session` type
- `src/lib/websearch/jina.ts` — `WebSearchProvider` interface, `WebResult` type
- `src/lib/websearch/webSearchTool.ts` — `WebSearchTool` interface

**Shared contracts (E1 Story 1.4):**
- `src/lib/validation/schemas.ts` — All Zod schemas (`ChatRequestSchema`, `ConversationSchema`, `AssetSchema`, `WebSearchArgsSchema`, etc.)
- `src/lib/utils.ts` — `cn()` and `safeParseOrThrow()` helpers
- `src/types/index.ts` — `Role`, `ChatMessage`, `ChatRequest`, `ChatResponse`
- `src/types/chat.ts` — Re-exports from schemas

**Legacy files (will be replaced in later stories, do not touch):**
- `src/lib/db/index.ts` — Legacy SQLite `DataSource`; Story 2.2 replaces with `data-source.ts` (Postgres)
- `src/app/api/chat/route.ts` — Legacy inline chat handler; Epic 3 rewrites to use `ChatService`
- `src/app/api/conversations/route.ts` — Legacy inline handler; Epic 3 rewrites to use `ConversationService`
- `src/app/api/conversations/[id]/route.ts` — Legacy inline handler; Epic 3 rewrites

### Files to Create

| File | Purpose | Notes |
|------|---------|-------|
| `src/app/api/assets/route.ts` | Placeholder for asset upload/delete route | Stub with `GET`/`POST` returning 501; Epic 3 implements |
| `src/lib/db/migrations/.gitkeep` | Empty dir for TypeORM migrations | Story 2.2 adds actual migration files |
| `schema/entity/.gitkeep` | Postgres/TypeORM migration schemas | Empty; populated by Story 2.2 |
| `schema/cache/.gitkeep` | KV store schema definitions | Empty; populated by Story 5.4 |
| `schema/vector/.gitkeep` | Qdrant collection schema | Empty; populated by Story 5.2 |
| `tests/unit/.gitkeep` | Unit test directory | Story 2.5 adds Vitest config + tests |
| `tests/fixtures/.gitkeep` | Shared test fixtures | Story 2.5 adds mock providers |
| `e2e/.gitkeep` | Playwright e2e tests | Story 2.6 adds Playwright config + specs |

### Files NOT to Create (Other Stories' Scope)

| File | Owner Story | Why Not Here |
|------|------------|--------------|
| `src/app/middleware.ts` | Story 2.3 (Clerk Auth) | Middleware depends on Clerk install |
| `src/lib/db/data-source.ts` | Story 2.2 (Postgres DataSource) | Depends on Docker/Postgres setup |
| `schema/entity/*.sql` | Story 2.2 (Migrations) | Depends on DataSource |
| `vitest.config.ts` | Story 2.5 (Testing Foundation) | Depends on skeleton being complete |
| `playwright.config.ts` | Story 2.6 (E2E Harness) | Depends on Docker Compose |

### Dependency Rule Enforcement

The `01-package.md` dependency rule is:

```
app (routes + middleware) → services → { repositories (TypeORM) | ai | vector | websearch | cache }
```

**How this is enforced structurally (no lint tool, pure convention):**

1. **Route handlers** (`src/app/api/`) import from `src/services/` and `src/lib/auth/`. They must NOT import from `src/lib/db/repositories/` or `src/lib/db/entities/` directly — they go through services.
2. **Services** (`src/services/`) import from `src/lib/db/repositories/`, `src/lib/ai/`, `src/lib/vector/`, `src/lib/websearch/`, and `src/lib/cache/`. They must NOT import from `src/app/`.
3. **Repositories** (`src/lib/db/repositories/`) import only from `src/lib/db/entities/`. They must NOT import from `src/services/` or `src/app/`.
4. **Integration modules** (`src/lib/ai/`, `src/lib/vector/`, `src/lib/websearch/`, `src/lib/cache/`) are leaf nodes. They must NOT import from `src/services/` or `src/app/`.
5. **No port/adapter layer**: Services call integrations directly. There is no abstract adapter pattern between them.

The dev agent does NOT need to add ESLint rules for this in this story. The dependency rule is enforced by convention and will be verified by code review. Future stories implement concrete logic that must follow this direction.

### Project Structure Notes

- `tsconfig.json` already has `"@/*": ["./src/*"]` — all `@/` imports resolve to `src/`. This is confirmed working.
- `tsconfig.json` has `experimentalDecorators: true` and `emitDecoratorMetadata: true` — required for TypeORM decorators.
- The `src/components/`, `src/hooks/`, and `src/public/` directories exist from the existing Next.js UI shell. They are not part of the backend package structure in `01-package.md` but should NOT be removed — they are the UI layer retained from the existing app.
- The existing `src/lib/db/index.ts` is the legacy SQLite DataSource. Story 2.2 replaces it with `src/lib/db/data-source.ts` (Postgres). Do not modify `index.ts` in this story.
- Next.js App Router convention: middleware MUST be at `src/app/middleware.ts` (or `src/middleware.ts` at project root). The `01-package.md` specifies `src/app/middleware.ts`.

### References

- [Source: `_bmad-output/planning-artifacts/01-package.md`] — Authoritative package structure and dependency rule
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.4`] — Story acceptance criteria and context
- [Source: `_bmad-output/planning-artifacts/epics.md#FR-21`] — Tightly integrated layered architecture requirement
- [Source: `_bmad-output/planning-artifacts/epics.md#NFR-1`] — SOLID / single-responsibility per layer

## Dev Agent Record

### Agent Model Used

opencode/big-pickle

### Debug Log References

### Completion Notes List

- Task 1: Created `src/app/api/assets/route.ts` with `GET`/`POST` returning 501, `runtime="nodejs"`, `dynamic="force-dynamic"`
- Task 2: Created `src/lib/db/migrations/.gitkeep` — directory already existed with one legacy migration file
- Task 3: Created `schema/{entity,cache,vector}/.gitkeep` at project root
- Task 4: Created `tests/{unit,fixtures}/.gitkeep` and `e2e/.gitkeep` at project root
- Task 5: `src/app/middleware.ts` does NOT exist (confirmed). Note: Story 2.3 placed Clerk middleware at `src/middleware.ts` (Next.js root), not `src/app/middleware.ts` as specified in `01-package.md`. This is a functional equivalent — Next.js supports both locations. Not modified in this story.
- Task 6: `tsconfig.json` confirmed: `@/*` → `./src/*`, `experimentalDecorators: true`, `emitDecoratorMetadata: true`
- Task 7: All 20 Epic 1 files verified present and unmodified
- Task 8: Full `src/` tree matches `01-package.md`. Extra files present: `src/lib/db/entities/index.ts` (barrel export from Epic 1), `src/lib/db/index.ts` (legacy SQLite, Story 2.2 replaces). Both are expected.

### File List

- `src/app/api/assets/route.ts` (created — placeholder)
- `src/lib/db/migrations/.gitkeep` (created)
- `schema/entity/.gitkeep` (created)
- `schema/cache/.gitkeep` (created)
- `schema/vector/.gitkeep` (created)
- `tests/unit/.gitkeep` (created)
- `tests/fixtures/.gitkeep` (created)
- `e2e/.gitkeep` (created)

## Senior Developer Review (AI)

**Reviewer:** opencode/big-pickle
**Date:** 2026-07-20
**Verdict:** Changes Requested → Fixed

### Findings

| # | Severity | Title | File | Status |
|---|----------|-------|------|--------|
| 1 | MEDIUM | Response API inconsistency | `src/app/api/assets/route.ts` | Fixed |
| 2 | MEDIUM | Missing DELETE handler placeholder | `src/app/api/assets/route.ts` | Fixed |
| 3 | MEDIUM | Scope contamination — all stories bundled | Working tree | Deferred (process) |
| 4 | LOW | Middleware path deviation from 01-package.md | `src/middleware.ts` | Deferred (spec update) |
| 5 | LOW | .gitkeep redundant with existing migration | `src/lib/db/migrations/` | Accepted |
| 6 | LOW | `entities/index.ts` missing from 01-package.md | `src/lib/db/entities/index.ts` | Deferred (spec update) |

### Fixes Applied

1. **`src/app/api/assets/route.ts`** — Replaced `Response.json()` with `NextResponse.json()` (imported from `"next/server"`) to match existing route conventions.
2. **`src/app/api/assets/route.ts`** — Added `DELETE` handler returning 501 to match `01-package.md` spec ("upload/delete" = POST + DELETE).

### Deferred Items (Other Stories' Scope)

- Finding 3: Stories 2.1–2.3 changes are mixed into the same working tree. Recommend committing each story separately.
- Finding 4: `01-package.md` shows `src/app/middleware.ts` but Next.js requires `src/middleware.ts`. Spec needs update.
- Finding 6: `src/lib/db/entities/index.ts` (barrel export from Epic 1) should be added to the `01-package.md` tree.
