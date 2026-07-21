# Story 5.6: Edit-Mode Asset References

Status: ready-for-dev

## Story

As a user,
I want trailing assistant asset references visible in edit mode with a remove option,
so that I can prune attachments when correcting a message.

## Acceptance Criteria

1. Given the user is in edit mode on the latest message
   When the trailing assistant reply has `assetIds`
   Then those asset references remain visible below the assistant message with a per-reference remove button (FR-17)

2. Given the user clicks the remove button on an asset reference in edit mode
   When the removal completes
   Then the asset is deleted via `DELETE /api/assets/[id]` and the message's `assetIds` array is updated to exclude the removed ID (FR-17)

3. Given the user removes all asset references from the trailing assistant reply
   When the list is empty
   Then the asset references section collapses / disappears cleanly

4. Given the user is in edit mode on a message that is NOT the latest user message
   When edit mode is activated
   Then the trailing assistant asset references are shown as read-only (no remove button) — only the latest message is editable (Story 4.2 / Story 3.5)

5. Given the asset removal call fails (network error, server error)
   When the failure occurs
   Then the UI rolls back to the previous state and shows an error toast; the message's `assetIds` is not mutated

## Tasks / Subtasks

- [ ] Task 1: Add backend endpoint to update a message's `assetIds` (AC: #2)
  - [ ] Subtask 1.1: Add `removeAssetId(messageId: string, assetId: string, userId: string): Promise<void>` to `MessageRepository` interface (`src/lib/db/repositories/message.repository.ts`)
  - [ ] Subtask 1.2: Implement `removeAssetId` in `MessageRepositoryImpl` — fetch the message, filter `assetIds` to exclude the target `assetId`, persist via `save` (scoping by `userId`)
  - [ ] Subtask 1.3: Add `removeAssetFromMessage(messageId: string, assetId: string, userId: string): Promise<void>` to `MessageService` interface and `MessageServiceImpl` — validates the message belongs to the user, delegates to repo, then calls `AssetService.remove(assetId, userId)` to delete the actual asset

- [ ] Task 2: Add route handler for asset removal from a message (AC: #2)
  - [ ] Subtask 2.1: Create `DELETE /api/conversations/[id]/messages/[messageId]/assets/[assetId]` route at `src/app/api/conversations/[id]/messages/[messageId]/assets/[assetId]/route.ts`
  - [ ] Subtask 2.2: Extract `userId` from Clerk session via `auth()` from `src/lib/auth/session.ts`
  - [ ] Subtask 2.3: Validate `id`, `messageId`, `assetId` are valid UUIDs. Return 400 on malformed IDs
  - [ ] Subtask 2.4: Verify conversation belongs to user via `ConversationRepository.findById(convId, userId)`. Return 404 if not found
  - [ ] Subtask 2.5: Verify message belongs to conversation via `MessageRepository.findByIdInConversation(messageId, convId, userId)`. Return 404 if not found
  - [ ] Subtask 2.6: Call `MessageServiceImpl.removeAssetFromMessage(messageId, assetId, userId)`. Return `{ success: true }` on 200
  - [ ] Subtask 2.7: Handle errors: 401 unauthenticated, 400 validation, 404 not found, 500 unexpected. Follow error pattern from `src/app/api/conversations/[id]/edit/route.ts`

- [ ] Task 3: Add `AssetReferences` UI component (AC: #1, #3)
  - [ ] Subtask 3.1: Create `src/components/chat/asset-references.tsx` — a presentational component that accepts `assetIds: string[]`, `conversationId: string`, `removable: boolean`, and an `onRemove(assetId: string)` callback
  - [ ] Subtask 3.2: Fetch asset metadata (filename, mime) for each `assetId` via `GET /api/assets?ids=...` or by passing asset data from parent. Prefer pre-fetching in the parent to avoid N+1 in render
  - [ ] Subtask 3.3: Render each asset as a small chip/badge: icon (file-type dependent), filename, and an × remove button when `removable=true`
  - [ ] Subtask 3.4: When `removable=false`, render chips without the × button (read-only, AC #4)
  - [ ] Subtask 3.5: When `assetIds` is empty or undefined, render nothing (AC #3)

- [ ] Task 4: Integrate asset references into edit-mode UI (AC: #1, #4)
  - [ ] Subtask 4.1: Extend `MessageBubble` (`src/components/chat/message-bubble.tsx`) to accept optional `isEditing: boolean` and `onRemoveAsset(assetId: string)` props
  - [ ] Subtask 4.2: When `message.role === 'assistant'` and `message.assetIds` is non-empty, render `<AssetReferences>` below the message content
  - [ ] Subtask 4.3: Pass `removable={isEditing}` to `AssetReferences` — only true when the parent (chat window) is in edit mode for the latest message
  - [ ] Subtask 4.4: When `onRemoveAsset` is called, optimistically remove the asset from local state, call `DELETE /api/conversations/[convId]/messages/[msgId]/assets/[assetId]`, and rollback on failure with toast (AC #5)

- [ ] Task 5: Wire edit-mode state in `ChatWindow` (AC: #1, #2, #5)
  - [ ] Subtask 5.1: Add `editingMessageId: string | null` state to `ChatWindow` (`src/components/chat/chat-window.tsx`). Set to the latest user message's `id` when edit mode is activated
  - [ ] Subtask 5.2: Derive `isLatestMessage` by comparing `editingMessageId` against the last user message in the messages array
  - [ ] Subtask 5.3: Pass `isEditing={editingMessageId !== null && isLatestMessage}` to the assistant `MessageBubble` that follows the editing target
  - [ ] Subtask 5.4: Implement `handleRemoveAsset(assetId)` that: (a) optimistically updates local message state, (b) calls the DELETE endpoint, (c) on success updates `assetIds` on the message in local state, (d) on failure reverts and shows toast

- [ ] Task 6: Fetch asset metadata for display (AC: #1)
  - [ ] Subtask 6.1: Add a utility or hook `src/hooks/use-asset-metadata.ts` that accepts `assetIds: string[]` and returns a map of `assetId → { filename, mime }`. Uses `GET /api/assets` with batch ID query
  - [ ] Subtask 6.2: Alternatively, extend the `GET /api/assets` route handler to accept an `?ids=` query param that filters by a comma-separated list of IDs (bounded, max 20)
  - [ ] Subtask 6.3: Cache the metadata map in component state to avoid redundant fetches when re-rendering

- [ ] Task 7: Unit tests (AC: all)
  - [ ] Subtask 7.1: Add `removeAssetId` tests to `src/lib/db/repositories/message.repository.test.ts` — verifies asset ID is removed from array, original array preserved when asset not found, userId scoping enforced
  - [ ] Subtask 7.2: Add `removeAssetFromMessage` tests to `src/services/message.service.test.ts` — verifies delegation to repo + asset service, verifies error on missing message, verifies userId scoping
  - [ ] Subtask 7.3: Add route handler tests for `DELETE /api/conversations/[id]/messages/[messageId]/assets/[assetId]/route.ts` — 401 unauthenticated, 400 invalid UUID, 404 conversation not found, 404 message not found, 200 success
  - [ ] Subtask 7.4: Add component tests for `AssetReferences` — renders chips for each ID, shows remove button when `removable=true`, hides remove button when `removable=false`, renders nothing for empty array
  - [ ] Subtask 7.5: Add integration test for optimistic removal with rollback — mock fetch failure, verify state reverts and toast shown
  - [ ] Subtask 7.6: Maintain ≥80% coverage on new code (NFR-7). All tests run offline with mocked externals (FR-30)

## Dev Notes

- **Architecture (FR-21, NFR-1):** Layered: `app (route handlers) -> services -> repositories`. The asset-removal-from-message flow adds one new route handler, extends `MessageService` with a `removeAssetFromMessage` method, and extends `MessageRepository` with `removeAssetId`. The existing `DELETE /api/assets/[id]` from Story 5.5 handles the actual asset file/DB cleanup — this story only updates the message's `assetIds` pointer.

- **Message.entity `assetIds` (Story 5.1, 3.7):** `Message.assetIds` is a `simple-array` column (`string[]`). It stores references to assets created during `ChatService.send` (pasted content exceeding 500 chars → `.txt` asset). Editing clears assistant content but does NOT touch `assetIds` on the assistant message (Story 3.5). This story adds the ability to remove individual asset references from edit mode.

- **Asset lifecycle in edit mode:**
  1. User enters edit mode on latest user message
  2. Trailing assistant reply shows its `assetIds` as chips below the message
  3. User clicks × on an asset chip
  4. Optimistic UI: chip disappears immediately
  5. `DELETE /api/conversations/[convId]/messages/[msgId]/assets/[assetId]` is called
  6. Backend: fetches message, removes assetId from array, calls `AssetService.remove(assetId, userId)` to delete the asset file + DB row
  7. On success: local state confirmed. On failure: revert local state, show toast
  8. User can continue editing; when they submit the edit, the message is saved with the updated `assetIds`

- **Optimistic update pattern:** The remove is optimistic (AC #5). The UI immediately removes the chip and calls the backend. If the backend returns an error, the chip is restored and a toast is shown. This matches standard optimistic UI patterns and avoids perceived latency.

- **No new message rows:** Removing an asset from a message does NOT create a new message or branch. It mutates `assetIds` on the existing assistant message in place — same pattern as `editLatest` (Story 3.5, FR-10, FR-11).

- **Auth scoping:** Every operation is scoped by `userId`. The route handler extracts `userId` from the Clerk session. The repository methods enforce `userId` on all queries (FR-2).

- **Asset metadata display:** The UI needs `filename` and `mime` for each asset ID to render a meaningful chip. Two approaches:
  - **Preferred:** Extend `GET /api/assets` to accept `?ids=a,b,c` and return matching assets. This avoids N+1 fetches and keeps the API surface minimal.
  - **Alternative:** Pass asset metadata from the parent (pre-fetched when entering edit mode). This avoids an extra API call but couples the edit-mode logic to the asset data model.

  Recommendation: Extend `GET /api/assets` with an `ids` query param (bounded to 20 IDs max).

- **Edge cases:**
  - Message has no `assetIds` → `AssetReferences` renders nothing. No remove button. No section.
  - User removes last asset → section collapses cleanly.
  - User enters edit mode on non-latest message → asset references shown as read-only (no × button).
  - User rapidly clicks × on multiple assets → queue removals, handle each independently with optimistic updates.
  - Asset already deleted server-side (concurrent removal) → `AssetService.remove` throws `NotFoundError`, UI reverts.
  - Network failure → fetch rejects, UI reverts, toast shown.

- **Dependency on Story 5.5:** Story 5.5 provides `DELETE /api/assets/[id]` which calls `AssetService.remove(assetId, userId)`. Story 5.6 calls this endpoint to delete the actual asset. The new endpoint in this story (`DELETE /api/conversations/[id]/messages/[messageId]/assets/[assetId]`) orchestrates: (1) remove assetId from message, (2) call existing DELETE endpoint on the asset.

- **Dependency on Story 4.2 / Story 3.5:** Edit-mode activation and "only latest is editable" logic is established in Stories 3.5 and 4.2. This story extends the edit-mode UI only — it does not change the edit activation logic.

- **Testing standards (FR-29, FR-30, NFR-7, NFR-8):** Vitest, colocated `*.test.ts`, externals mocked. Route handler tests mock `auth()`, `MessageRepository`, `ConversationRepository`, `AssetService`. Component tests use `@testing-library/react` with mocked fetch. Coverage gate ≥80% on new code.

### File Files to Create

| File | Purpose |
|------|---------|
| `src/components/chat/asset-references.tsx` | Presentational component for asset chips |
| `src/hooks/use-asset-metadata.ts` | Hook to batch-fetch asset metadata |
| `src/app/api/conversations/[id]/messages/[messageId]/assets/[assetId]/route.ts` | Route handler: remove asset from message |
| `src/app/api/conversations/[id]/messages/[messageId]/assets/[assetId]/route.test.ts` | Route handler tests |

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/db/repositories/message.repository.ts` | Add `removeAssetId` to interface + impl |
| `src/lib/db/repositories/message.repository.test.ts` | Add `removeAssetId` tests |
| `src/services/message.service.ts` | Add `removeAssetFromMessage` method |
| `src/services/message.service.test.ts` | Add `removeAssetFromMessage` tests |
| `src/components/chat/message-bubble.tsx` | Add `isEditing`, `onRemoveAsset` props; render `AssetReferences` |
| `src/components/chat/chat-window.tsx` | Add edit-mode state, pass `isEditing` and `onRemoveAsset` to bubbles |
| `src/app/api/assets/route.ts` | Extend `GET` to accept `?ids=` query param for batch fetch |

### Gotchas and Edge Cases

- **Simple-array column semantics:** `assetIds` is a `simple-array` column — TypeORM stores it as a comma-separated string. Updating it requires: read the array, modify, write the full array back. There is no atomic "remove one element" at the DB level — it is a full-array overwrite. The `removeAssetId` method must read-then-write within a single transaction or accept eventual consistency (acceptable for this use case given low concurrency).

- **Optimistic UI rollback:** If the DELETE call fails, the UI must restore the removed chip. Use React state: snapshot the `assetIds` array before the optimistic update, restore on failure.

- **Toast notifications:** Use a toast library (e.g., `sonner` or `react-hot-toast`) consistent with the project's UI patterns. If no toast library is installed, add one as a dependency.

- **Asset metadata fetch batching:** The `GET /api/assets` endpoint must accept an optional `ids` query param. When `ids` is present, filter by those IDs (bounded to 20). When absent, return all assets for the user (existing behavior). Validate the `ids` param as comma-separated UUIDs.

- **No branch creation:** Asset removal from edit mode must NOT create a new message or branch. It mutates the existing assistant message's `assetIds` in place.

- **Concurrent edit + asset removal:** If the user enters edit mode, removes an asset, then submits the edit, both operations target the same assistant message. The edit updates `content`; the asset removal updates `assetIds`. These are independent fields — no conflict. However, if the user submits the edit before the asset removal completes, the edit should use the current (pre-removal) `assetIds` to avoid losing the removal. Solution: queue the edit submission until pending asset removals complete, or merge the `assetIds` change into the edit payload.

### Dependencies on Other Stories

- **Story 5.5 (Asset DELETE endpoint):** Provides `DELETE /api/assets/[id]` which `AssetService.remove` calls. Story 5.6 depends on this being available.
- **Story 4.2 (Branch-aware edit):** Establishes the "only latest message is editable" rule. Story 5.6 respects this by showing remove buttons only when editing the latest message.
- **Story 3.5 (Message editing):** Establishes `editLatest` flow and the "trailing assistant reply" concept. Story 5.6 extends the edit-mode UI.
- **Story 5.1 (Asset upload pipeline):** Defines `AssetService.ingest` and `AssetService.remove`. Story 5.6 uses `remove`.
- **Story 3.7 (Large-paste-to-TXT):** Creates assets referenced by `assetIds` on user messages. Story 5.6 removes these references.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#FR-17] "In edit mode, trailing assistant asset references remain visible with option to remove per user action." (L44)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5 Story 5.6] Edit-mode asset references requirements (epics.md)
- [Source: _bmad-output/planning-artifacts/epics.md#FR-10] "Editing updates only the most recently created sibling; branching continues from that message." (L37)
- [Source: _bmad-output/planning-artifacts/epics.md#FR-11] "Editing is content-only, in place (same IDs); does not affect branching; lastMessageId unchanged." (L38)
- [Source: _bmad-output/planning-artifacts/epics.md#FR-2] userId scoping on every query (L29)
- [Source: src/lib/db/entities/message.entity.ts:33-34] `assetIds?: string[]` via `simple-array`
- [Source: src/services/asset.service.ts:1-6] `AssetService` interface with `remove(assetId, userId)`
- [Source: src/lib/db/repositories/asset.repository.ts:4-10] `AssetRepository` interface
- [Source: src/components/chat/message-bubble.tsx:1-36] Current `MessageBubble` — no edit-mode or asset props yet
- [Source: src/components/chat/chat-window.tsx:1-44] Current `ChatWindow` — no edit-mode state yet
- [Source: src/services/chat.service.ts:52-74] Asset creation during `send` — `assetIds` stored on user message
- [Source: src/app/api/conversations/[id]/edit/route.ts] Existing edit route handler pattern
- [Source: src/lib/auth/session.ts] `auth()` returning `{ userId }`

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
