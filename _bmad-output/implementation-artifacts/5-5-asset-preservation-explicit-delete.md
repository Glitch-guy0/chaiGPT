# Story 5.5: Asset Preservation & Explicit Delete

Status: ready-for-dev

## Story

As a user,
I want assets in deleted replies preserved and deletable,
so that history stays coherent and I control cleanup.

## Acceptance Criteria

1. Given an assistant reply referencing assets is deleted
   When the conversation is viewed
   Then the referenced assets are preserved and shown (FR-16)

2. And the user may explicitly delete an asset via `AssetsRoute DELETE` (FR-16)

## Tasks / Subtasks

- [ ] Task 1: Implement `DELETE /api/assets/[id]` route handler (AC: #2)
  - [ ] Subtask 1.1: Create `src/app/api/assets/[id]/route.ts` with a `DELETE` export. If this file already exists from Story 5.1 (the stub DELETE in `src/app/api/assets/route.ts` is the list-level stub), create the dynamic-route version.
  - [ ] Subtask 1.2: Extract `userId` via `auth()` from `@/lib/auth/session.ts`. Return 401 if missing.
  - [ ] Subtask 1.3: Extract `id` from `params` (Next.js App Router: `{ params: Promise<{ id: string }> }`).
  - [ ] Subtask 1.4: Instantiate `AssetRepositoryImpl` via `getDatabase()` from `@/lib/db`. Instantiate the concrete `AssetServiceImpl` (from Story 5.1's impl) with `AssetRepository`, `QdrantStore`, and volume path.
  - [ ] Subtask 1.5: Call `assetService.remove(id, userId)`. The service method handles: fetching asset by id+userId, deleting from volume (best-effort), deleting vector points from Qdrant, and deleting the DB row.
  - [ ] Subtask 1.6: Return `NextResponse.json({ deleted: true }, { status: 200 })`.
  - [ ] Subtask 1.7: Error handling: catch `NotFoundError` → 404, generic → 500. Follow pattern from `src/app/api/chat/route.ts:59-71`.

- [ ] Task 2: Extend `AssetService.remove()` to clean up Qdrant vector points (AC: #2)
  - [ ] Subtask 2.1: In `AssetServiceImpl.remove()` (created in Story 5.1), after fetching the asset and before deleting the DB row, call `qdrantStore.deleteByAssetId(assetId)` to remove all vector chunks associated with the asset.
  - [ ] Subtask 2.2: If `qdrantStore` is not injected (optional), skip vector cleanup gracefully — log a warning but still delete the DB row.
  - [ ] Subtask 2.3: Wrap the Qdrant delete in try/catch — failures must not prevent DB deletion. Log warning on Qdrant failure.

- [ ] Task 3: Add `deleteByAssetId` to `QdrantStore` interface and implementation (AC: #2)
  - [ ] Subtask 3.1: Add `deleteByAssetId(assetId: string): Promise<void>` to the `QdrantStore` interface in `src/lib/vector/qdrant.ts`.
  - [ ] Subtask 3.2: Implement `deleteByAssetId` in the concrete `QdrantStoreImpl` (if exists, or in the mock for now). The implementation should call Qdrant's delete API: `POST /collections/{collection}/points/delete` with a filter `{ "must": [{ "key": "assetId", "match": { "value": assetId } }] }`.
  - [ ] Subtask 3.3: Update `MockQdrantStore` in `tests/fixtures/mock-qdrant-store.ts` to implement the new interface method.

- [ ] Task 4: Implement `GET /api/assets` route — list assets for a conversation (AC: #1)
  - [ ] Subtask 4.1: Replace the `GET` 501 stub in `src/app/api/assets/route.ts`.
  - [ ] Subtask 4.2: Extract `userId` from session. Accept `?conversationId=` query param.
  - [ ] Subtask 4.3: Validate `conversationId` (UUID). Return 400 if invalid.
  - [ ] Subtask 4.4: Instantiate `AssetRepositoryImpl`. Call `findByConversation(conversationId, userId)`.
  - [ ] Subtask 4.5: Return `NextResponse.json(assets)`.
  - [ ] Subtask 4.6: This endpoint is critical for AC #1 — the UI uses it to show assets even when the referencing message is gone. Assets are independent DB rows keyed by `conversationId`, not by `messageId`.

- [ ] Task 5: Verify asset preservation logic — no code change needed, validation only (AC: #1)
  - [ ] Subtask 5.1: Confirm that the `Asset` entity stores `conversationId` (not `messageId`). Current schema: `Asset` has `conversationId: string` column. Messages have `assetIds?: string[]` as a simple-array. When a message is deleted, the message row is removed but assets remain as independent rows.
  - [ ] Subtask 5.2: Confirm that the conversation `GET /api/conversations/[id]` endpoint (or the conversation detail view) loads assets via `AssetRepository.findByConversation(convId, userId)` — NOT via message references. The conversation entity already has a `@OneToMany → Asset` relation (see `conversation.entity.ts`).
  - [ ] Subtask 5.3: Write a test that: (a) creates a conversation with a user message + assistant message that has `assetIds`, (b) deletes the assistant message, (c) verifies assets still exist and are returned by `findByConversation`.

- [ ] Task 6: Replace the list-level `DELETE` stub in `src/app/api/assets/route.ts` (AC: #2)
  - [ ] Subtask 6.1: Remove the `DELETE` export from `src/app/api/assets/route.ts` — the actual DELETE lives in the dynamic `[id]` route. Or, if keeping it, make it a no-op that returns 405 Method Not Allowed (DELETE on a collection endpoint is semantically wrong).
  - [ ] Subtask 6.2: The real delete is `DELETE /api/assets/[id]` handled by the dynamic route from Task 1.

- [ ] Task 7: Colocated Vitest unit tests (AC: #1, #2)
  - [ ] Subtask 7.1: Create `src/app/api/assets/[id]/route.test.ts`:
    - DELETE returns 200 and `{ deleted: true }` for valid asset + correct user.
    - DELETE returns 401 without session.
    - DELETE returns 404 for non-existent asset id.
    - DELETE returns 404 for asset belonging to different user (userId scoping).
    - DELETE calls `assetService.remove()` which triggers volume + Qdrant + DB cleanup.
  - [ ] Subtask 7.2: Update `src/services/asset.service.test.ts` to cover `remove()` with Qdrant cleanup:
    - `remove` deletes from Qdrant, volume, and DB.
    - `remove` proceeds with DB+volume delete even if Qdrant delete fails.
    - `remove` throws `NotFoundError` for missing/wrong-user asset.
  - [ ] Subtask 7.3: Create/update `src/app/api/assets/route.test.ts` for GET handler:
    - GET returns array of assets scoped to user + conversationId.
    - GET returns 400 for missing/invalid conversationId.
  - [ ] Subtask 7.4: Create `src/lib/vector/qdrant.test.ts` (or update existing) to test `deleteByAssetId`:
    - Calls Qdrant delete API with correct filter.
    - Handles Qdrant errors gracefully.
  - [ ] Subtask 7.5: Add preservation regression test:
    - Seed: conversation → user message (no assets) → assistant message (assetIds: [asset-1]).
    - Delete the assistant message.
    - Query `AssetRepository.findByConversation(convId, userId)` → returns `[asset-1]`.
    - Query `MessageRepository.findById(assistantMsgId)` → returns null.
  - [ ] Subtask 7.6: Coverage target: ≥80% on new route handler and modified service code (NFR-7). All tests run offline with mocked externals (FR-30).

## Dev Notes

### Asset Preservation Design

The preservation behavior is **structural, not conditional**. Assets are independent DB rows (`assets` table) linked to conversations via `conversationId`, not to messages. Messages reference assets via `message.assetIds?: string[]` (a simple-array column), but this is a **reference-only** link — it does not create a foreign key dependency.

When a message is deleted:
1. The `messages` row is removed from the DB.
2. The `assets` rows referenced by `message.assetIds` **remain untouched** in the `assets` table.
3. The conversation's `@OneToMany → Asset` relation still returns these assets.
4. The UI loads assets via the conversation, not via individual messages.

This means **no special preservation code is needed** — the architecture already guarantees it. The task is to verify this works and add regression tests.

### Explicit Delete Flow

`DELETE /api/assets/[id]` triggers a three-stage cleanup:

1. **DB row** — `AssetRepository.findById(id, userId)` confirms ownership, then `AssetRepository.delete(id, userId)`.
2. **Volume file** — `node:fs/promises unlink(ASSETS_VOLUME_PATH + asset.path)` (best-effort, log warning on failure).
3. **Qdrant vectors** — `QdrantStore.deleteByAssetId(assetId)` removes all chunks (best-effort, log warning on failure, does not block DB delete).

The `AssetService.remove()` method orchestrates this. Story 5.1 defined the interface; this story completes the Qdrant leg.

### Implementation Pattern — Route Handler

Follow the exact pattern from `src/app/api/chat/route.ts` and `src/app/api/conversations/[id]/route.ts`:

```ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/session"
import { getDatabase } from "@/lib/db"
import { AssetRepositoryImpl } from "@/lib/db/repositories/asset.repository"
import { NotFoundError } from "@/lib/errors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { id } = await params
    const ds = await getDatabase()
    const assetRepo = new AssetRepositoryImpl(ds)
    // ... instantiate service, call remove(id, userId)
    return NextResponse.json({ deleted: true }, { status: 200 })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error("Asset delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/api/assets/[id]/route.ts` | DELETE handler for explicit asset deletion |

### Files to Modify

| File | Change |
|------|--------|
| `src/app/api/assets/route.ts` | Replace DELETE stub with 405 or remove; implement GET |
| `src/lib/vector/qdrant.ts` | Add `deleteByAssetId(assetId: string): Promise<void>` to `QdrantStore` interface |
| `src/services/asset.service.ts` | No change — interface unchanged. Impl from Story 5.1 gets Qdrant cleanup in `remove()` |
| `tests/fixtures/mock-qdrant-store.ts` | Add `deleteByAssetId` mock method |

### Gotchas and Edge Cases

- **No `deleteByAssetId` yet:** The `QdrantStore` interface currently lacks a delete method. Adding it is a breaking interface change — all implementations (concrete + mock) must be updated. If `QdrantStoreImpl` doesn't exist yet (Story 5.2 dependency), add `deleteByAssetId` to the interface and implement it only in the mock, deferring the real HTTP call to Story 5.2.
- **Asset `text` column nullable:** Some assets may have `text: null` (e.g., if text extraction failed). The preservation logic must not depend on `text` being present.
- **Orphaned assets:** If a conversation is deleted, its assets become orphaned (no conversation FK). This is out of scope for this story — conversation deletion is not yet implemented. Note for future: cascade or soft-delete.
- **Multiple messages referencing same asset:** If two messages reference the same asset ID in their `assetIds` arrays, deleting one message should NOT delete the asset. Only explicit `DELETE /api/assets/[id]` removes an asset. The `message.assetIds` is a reference, not ownership.
- **Qdrant collection naming:** The concrete `QdrantStoreImpl` uses a collection name (likely from env var `QDRANT_COLLECTION`). The `deleteByAssetId` must filter within the correct collection.
- **Auth scoping:** `AssetRepository.delete(id, userId)` already enforces userId scoping — throws "Asset not found" if userId doesn't match. No additional auth check needed in the route beyond extracting `userId`.

### Testing Approach

- **Unit tests** with mocked `AssetRepository`, `QdrantStore`, `node:fs/promises`, and `auth()`.
- **Integration test** using `createTestDataSource()` and `seedTestData()` from `tests/fixtures/test-datasource.ts` to verify end-to-end preservation.
- **Regression test** specifically for the preservation guarantee: delete message → assets survive.

### Dependencies on Other Stories

- **Story 5.1 (Asset upload pipeline):** The `AssetServiceImpl` concrete class and its `remove()` method were introduced here. This story extends `remove()` with Qdrant cleanup. If Story 5.1's impl is not yet complete, this story must finish the `remove()` method.
- **Story 5.2 (QdrantStore concrete impl):** The `deleteByAssetId` method needs a concrete Qdrant HTTP implementation. If Story 5.2 is not complete, use the mock only and note the TODO.
- **Story 5.3 (RAG retrieval):** No dependency. Retrieval uses `search()`, not delete.
- **Story 5.4 (Redis cache):** No dependency.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.5] Story 5.5: Asset preservation & explicit delete.
- [Source: _bmad-output/planning-artifacts/epics.md#FR-16] Assets referenced in deleted assistant replies are preserved and shown; user may explicitly delete.
- [Source: src/services/asset.service.ts:1-6] `AssetService` interface: `ingest(userId, convId, file)` and `remove(assetId, userId)`.
- [Source: src/lib/db/entities/asset.entity.ts:5-36] `Asset` entity — stores `conversationId`, not `messageId`.
- [Source: src/lib/db/entities/message.entity.ts:33-34] `Message.assetIds?: string[]` — simple-array reference, not FK.
- [Source: src/lib/db/entities/conversation.entity.ts] `Conversation` has `@OneToMany → Asset` relation.
- [Source: src/lib/db/repositories/asset.repository.ts:12-39] `AssetRepositoryImpl` with `findById`, `findByConversation`, `delete`.
- [Source: src/lib/vector/qdrant.ts:13-17] `QdrantStore` interface — needs `deleteByAssetId` added.
- [Source: src/app/api/assets/route.ts:1-16] Current stubs (GET/POST/DELETE all return 501).
- [Source: src/app/api/chat/route.ts:16-72] Route handler pattern (auth, validation, error handling).
- [Source: src/lib/auth/session.ts:7-15] `auth()` returning `{ userId }`.
- [Source: src/lib/errors.ts:1-6] `NotFoundError` class.
- [Source: tests/fixtures/mock-qdrant-store.ts] `MockQdrantStore` — needs `deleteByAssetId`.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
