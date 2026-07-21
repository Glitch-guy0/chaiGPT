# Story 5.1: Asset Upload Pipeline (Volume + Embed + Delete Original)

Status: ready-for-dev

## Story

As a user,
I want to upload a document that gets embedded and stored,
so that the model can retrieve from it later.

## Acceptance Criteria

1. Given an authenticated user uploads a PDF/TXT/MD to `/api/assets`
   When `AssetService.ingest(userId, convId, file)` runs
   Then the file is staged to the shared named Docker volume, embedded via LangChain, and the original is deleted (FR-12)

2. And an `Asset` row is persisted with `userId`/`conversationId`/`filename`/`mime`/`path` (FR-12, FR-2)

3. And logical isolation is enforced at the DB layer via `Asset.userId`, not at the volume level (FR-12)

## Tasks / Subtasks

- [ ] Task 1: Implement concrete `AssetServiceImpl` class (AC: #1, #2)
  - [ ] Subtask 1.1: Create `src/services/asset.service.impl.ts` implementing the `AssetService` interface from `src/services/asset.service.ts`. Constructor accepts `AssetRepository`, `QdrantStore`, and volume root path (`ASSETS_VOLUME_PATH` env var, default `/app/assets`).
  - [ ] Subtask 1.2: `ingest(userId, convId, file)` method:
    - Validate `file` has a supported mime type (`application/pdf`, `text/plain`, `text/markdown`). Reject with 400 if unsupported.
    - Generate a unique filename: `${userId}/${convId}/${crypto.randomUUID()}.${ext}` to namespace files on the shared volume (logical isolation via DB, path namespacing as defense-in-depth).
    - Write `file` buffer to `${ASSETS_VOLUME_PATH}/${uniqueFilename}` using `node:fs/promises`.
    - Extract text content from the staged file: PDF → use `pdf-parse` or similar LangChain `PDFLoader`; TXT/MD → read directly.
    - Chunk the extracted text via LangChain `RecursiveCharacterTextSplitter` (chunk size ~1000 chars, overlap ~200).
    - Call `qdrantStore.upsertChunks(assetId, chunks)` with the generated asset ID and chunk array.
    - Delete the original staged file from the volume via `node:fs/promises unlink`.
    - Persist `Asset` row via `assetRepo.save({ userId, conversationId: convId, filename, mime, path: relativePath, text })`.
    - Return the saved `Asset`.
  - [ ] Subtask 1.3: `remove(assetId, userId)` method:
    - Fetch asset via `assetRepo.findById(assetId, userId)`. Throw `NotFoundError` if null.
    - Delete the file from the volume path (best-effort; log warning on failure, don't block DB delete).
    - Delete the DB row via `assetRepo.delete(assetId, userId)`.
    - NOTE: Qdrant chunk cleanup is NOT in this story — handled by Story 5.3+.
  - [ ] Subtask 1.4: Ensure the `Asset` entity's `text` column stores the full extracted text (for potential re-embedding or debugging).

- [ ] Task 2: Implement `POST /api/assets` route handler (AC: #1)
  - [ ] Subtask 2.1: Replace the `501` stub in `src/app/api/assets/route.ts` with a real `POST` handler.
  - [ ] Subtask 2.2: Extract `userId` from Clerk session via `auth()` from `src/lib/auth/session.ts`.
  - [ ] Subtask 2.3: Parse multipart form data from the request using `request.formData()`. Extract `file` (the uploaded file) and `conversationId` (string, UUID).
  - [ ] Subtask 2.4: Validate `conversationId` against `AssetSchema` (from `src/lib/validation/schemas.ts`) using `safeParseOrThrow`.
  - [ ] Subtask 2.5: Verify the conversation exists and belongs to the user via `ConversationRepository.findById(convId, userId)`. Return 404 if not found.
  - [ ] Subtask 2.6: Instantiate `AssetServiceImpl` with the repository, `QdrantStore`, and volume path. Call `ingest(userId, convId, file)`.
  - [ ] Subtask 2.7: Return `NextResponse.json(asset, { status: 201 })` on success.
  - [ ] Subtask 2.8: Error handling: 401 for unauthenticated, 400 for validation failures, 404 for missing conversation, 500 for unexpected errors. Follow pattern from `src/app/api/chat/route.ts`.

- [ ] Task 3: Implement `DELETE /api/assets/[id]` route handler (AC: #2)
  - [ ] Subtask 3.1: Create `src/app/api/assets/[id]/route.ts` with a `DELETE` handler.
  - [ ] Subtask 3.2: Extract `userId` from session, `id` from route params.
  - [ ] Subtask 3.3: Call `AssetServiceImpl.remove(id, userId)`.
  - [ ] Subtask 3.4: Return `NextResponse.json({ deleted: true }, { status: 200 })`.

- [ ] Task 4: Implement `GET /api/assets` route handler (list assets for a conversation)
  - [ ] Subtask 4.1: Replace the `GET` stub in `src/app/api/assets/route.ts`. Accept `?conversationId=` query param.
  - [ ] Subtask 4.2: Validate `conversationId` with `AssetSchema`.
  - [ ] Subtask 4.3: Call `AssetRepository.findByConversation(conversationId, userId)`.
  - [ ] Subtask 4.4: Return JSON array of assets.

- [ ] Task 5: Add text extraction utilities (AC: #1)
  - [ ] Subtask 5.1: Create `src/lib/ai/text-extractor.ts` with a `extractText(file: File): Promise<string>` function.
  - [ ] Subtask 5.2: Route by mime type: `text/plain` and `text/markdown` → `file.text()`. `application/pdf` → use `pdf-parse` (add `pdf-parse` dependency to `package.json` if not present).
  - [ ] Subtask 5.3: Export a `SUPPORTED_MIME_TYPES` constant: `['application/pdf', 'text/plain', 'text/markdown']`.
  - [ ] Subtask 5.4: Throw a descriptive error for unsupported mime types.

- [ ] Task 6: Add text chunking utility (AC: #1)
  - [ ] Subtask 6.1: Create `src/lib/ai/text-chunker.ts` with a `chunkText(text: string): Promise<Chunk[]>` function.
  - [ ] Subtask 6.2: Use LangChain `RecursiveCharacterTextSplitter` with chunk size 1000, overlap 200. Return `Chunk[]` from `src/lib/vector/qdrant.ts`.
  - [ ] Subtask 6.3: Filter out empty/whitespace-only chunks.

- [ ] Task 7: Add `ASSETS_VOLUME_PATH` to environment config (AC: #1)
  - [ ] Subtask 7.1: Add `ASSETS_VOLUME_PATH` to `.env` / `.env.local` with default `/app/assets`.
  - [ ] Subtask 7.2: Document the env var in `project-context.md` or relevant config.

- [ ] Task 8: Colocated Vitest unit tests (AC: #1, #2, #3)
  - [ ] Subtask 8.1: Update `src/services/asset.service.test.ts` with comprehensive tests for `AssetServiceImpl`:
    - `ingest` stages file to volume, calls qdrant upsert, saves Asset row, deletes original file.
    - `ingest` rejects unsupported mime types.
    - `ingest` persists correct fields: userId, conversationId, filename, mime, path, text.
    - `remove` deletes file from volume and DB row.
    - `remove` throws `NotFoundError` for missing/wrong-user asset.
    - Mock: `AssetRepository`, `QdrantStore`, `node:fs/promises`, `pdf-parse`.
  - [ ] Subtask 8.2: Add `src/app/api/assets/route.test.ts` for route handler integration:
    - POST returns 401 without session.
    - POST returns 400 for invalid conversationId.
    - POST returns 404 for non-existent conversation.
    - POST returns 201 with valid multipart upload.
    - GET returns asset list scoped to user.
    - DELETE returns 200 and deletes asset.
  - [ ] Subtask 8.3: Add `src/app/api/assets/[id]/route.test.ts` for DELETE handler.
  - [ ] Subtask 8.4: Add `src/lib/ai/text-extractor.test.ts` for text extraction:
    - Extracts text from `.txt` and `.md` files.
    - Extracts text from `.pdf` files (mocked pdf-parse).
    - Throws for unsupported mime types.
  - [ ] Subtask 8.5: Add `src/lib/ai/text-chunker.test.ts` for chunking:
    - Produces correct chunk count for known-length text.
    - Filters empty chunks.
    - Chunks conform to `Chunk` interface (index, text).
  - [ ] Subtask 8.6: Coverage target: ≥80% on `src/services/asset.service.impl.ts`, route handlers, and utilities (NFR-7). All tests run offline with mocked externals (FR-30).

- [ ] Task 9: Dependency installation
  - [ ] Subtask 9.1: Add `pdf-parse` and `@langchain/textsplitters` to `package.json` if not already present.
  - [ ] Subtask 9.2: Verify `npm install` succeeds and tests pass.

## Dev Notes

- **Architecture pattern (FR-21):** Tightly integrated layered architecture. Route handlers instantiate concrete services and repositories directly (no DI container). Follow the pattern in `src/app/api/chat/route.ts` — import concrete implementations, construct with `getDatabase()`, pass to service constructor.
- **Service interface exists:** `AssetService` interface is defined at `src/services/asset.service.ts:1-6`. The concrete `AssetServiceImpl` goes in a new file `src/services/asset.service.impl.ts`. The interface has two methods: `ingest(userId, convId, file)` and `remove(assetId, userId)`.
- **Repository is implemented:** `AssetRepositoryImpl` at `src/lib/db/repositories/asset.repository.ts:12-39` provides `findById`, `findAll`, `save`, `findByConversation`, `delete`. All queries are userId-scoped.
- **Entity is complete:** `Asset` entity at `src/lib/db/entities/asset.entity.ts:5-36` has all required columns: id, userId, conversationId, filename, mime, path, text, createdAt, updatedAt.
- **Qdrant store is interface-only:** `QdrantStore` at `src/lib/vector/qdrant.ts:13-17` has `embed`, `search`, `upsertChunks`. The concrete implementation is Story 5.2+. For this story, the concrete impl must exist or be mocked. Check if `QdrantStoreImpl` exists; if not, create a minimal one in `src/lib/vector/qdrant.impl.ts` that calls the Qdrant HTTP API (POST to `QDRANT_URL/collections/{collection}/points`).
- **Docker volume:** `infra/docker-compose.yml:49` mounts `chaigpt_assets:/app/assets`. The volume name is `chaigpt_assets`, mounted at `/app/assets` in the `app` service container. `ASSETS_VOLUME_PATH` env var should default to `/app/assets`.
- **Validation:** Use `AssetSchema` from `src/lib/validation/schemas.ts:27-31` which validates `filename`, `mime`, `conversationId`. Use `safeParseOrThrow` utility for validation.
- **Auth pattern:** `auth()` from `src/lib/auth/session.ts` returns `{ userId }`. Routes check `if (!userId)` and return 401. Follow `src/app/api/chat/route.ts:18-22`.
- **Route handler pattern:** All routes export `runtime = "nodejs"` and `dynamic = "force-dynamic"`. Error handling uses try/catch with specific error types (`NotFoundError`, `ZodError`).
- **File naming convention:** Route handlers live in `src/app/api/assets/route.ts` (GET/POST list) and `src/app/api/assets/[id]/route.ts` (DELETE by id). Test files are colocated as `*.test.ts`.
- **Path alias:** `@/*` maps to project root. Use `@/lib/...`, `@/services/...`, etc.
- **Testing (FR-29, FR-30, NFR-7, NFR-8):** Vitest, colocated `*.test.ts`, mocked externals (OpenAI/LangChain/Qdrant/pdf-parse), ≥80% coverage on new code. Use the existing test patterns from `asset.repository.test.ts`.

### File Files to Create

| File | Purpose |
|------|---------|
| `src/services/asset.service.impl.ts` | Concrete `AssetServiceImpl` implementing `AssetService` |
| `src/lib/ai/text-extractor.ts` | Text extraction from PDF/TXT/MD files |
| `src/lib/ai/text-chunker.ts` | LangChain-based text chunking |
| `src/app/api/assets/[id]/route.ts` | DELETE handler for asset deletion |
| `src/services/asset.service.test.ts` | (rewrite) Comprehensive unit tests |
| `src/app/api/assets/route.test.ts` | Route handler integration tests |
| `src/app/api/assets/[id]/route.test.ts` | DELETE handler tests |
| `src/lib/ai/text-extractor.test.ts` | Text extraction tests |
| `src/lib/ai/text-chunker.test.ts` | Text chunking tests |

### Files to Modify

| File | Change |
|------|--------|
| `src/app/api/assets/route.ts` | Replace 501 stubs with real POST/GET handlers |
| `src/lib/vector/qdrant.ts` | May need concrete `QdrantStoreImpl` if not yet created |
| `package.json` | Add `pdf-parse`, `@langchain/textsplitters` deps |
| `.env.local` | Add `ASSETS_VOLUME_PATH` |

### Gotchas and Edge Cases

- **PDF extraction:** `pdf-parse` may fail on corrupted or encrypted PDFs. Wrap in try/catch and return a descriptive error (400).
- **Volume cleanup on partial failure:** If embedding fails after staging, the staged file should still be cleaned up. Use try/finally around the embedding step.
- **Large files:** Consider a max file size (e.g., 10MB). Reject oversized uploads in the route handler before calling `ingest`.
- **Race condition on delete:** `remove()` should be idempotent — if the file is already gone from the volume, log and proceed with DB delete.
- **QdrantStore dependency:** If `QdrantStoreImpl` doesn't exist yet (likely — Story 5.2), create a minimal implementation or wire a mock for this story. The `upsertChunks` call is the only qdrant method needed here.
- **Multipart parsing:** Next.js `request.formData()` returns a `FormData` object. Extract the `File` via `formData.get('file')`. The `conversationId` may be a form field or query param — decide and document.
- **Path storage:** Store relative paths in `Asset.path` (e.g., `user123/conv456/uuid.pdf`), not absolute volume paths. The volume root is env-configured.
- **Text storage:** Store extracted text in `Asset.text` column (nullable text type). This is for debugging/re-embedding, not for retrieval (Qdrant handles that).

### Dependencies on Other Stories

- **Story 5.2 (QdrantStore concrete impl):** If `QdrantStoreImpl` doesn't exist, this story needs either a minimal stub or the full implementation. Coordinate with Story 5.2 or create a minimal `QdrantStoreImpl` that wraps the Qdrant HTTP API.
- **Story 5.3 (RAG retrieval):** Consumes the embeddings created by this story. No blocking dependency — 5.3 depends on 5.1, not vice versa.
- **Story 5.4 (Redis cache):** Independent. No dependency.
- **Story 1.2 (Repository interfaces):** `AssetRepository` interface already defined and implemented. No action needed.
- **Story 3.1 (Concrete entities):** `Asset` entity already defined. No action needed.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] Story 5.1: upload pipeline, volume staging, LangChain embed, delete original, Asset row persistence.
- [Source: _bmad-output/planning-artifacts/epics.md#FR-12] Asset upload stages to shared named Docker volume, embeds via LangChain, deletes original; no external object store v1. Logical isolation at DB layer (`Asset.userId`).
- [Source: _bmad-output/planning-artifacts/epics.md#FR-2] Every query carries userId; user-scoped isolation.
- [Source: infra/docker-compose.yml:49] Volume mount `chaigpt_assets:/app/assets` on the app service.
- [Source: src/services/asset.service.ts:1-6] `AssetService` interface: `ingest(userId, convId, file)` and `remove(assetId, userId)`.
- [Source: src/lib/vector/qdrant.ts:13-17] `QdrantStore` interface: `embed`, `search`, `upsertChunks`.
- [Source: src/lib/db/repositories/asset.repository.ts:12-39] `AssetRepositoryImpl` with `findById`, `findAll`, `save`, `findByConversation`, `delete`.
- [Source: src/lib/db/entities/asset.entity.ts:5-36] `Asset` entity with all columns.
- [Source: src/lib/validation/schemas.ts:27-31] `AssetSchema` validation.
- [Source: src/app/api/chat/route.ts:16-72] Route handler pattern (auth, validation, error handling).
- [Source: src/lib/auth/session.ts:7-14] `auth()` helper returning `{ userId }`.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
