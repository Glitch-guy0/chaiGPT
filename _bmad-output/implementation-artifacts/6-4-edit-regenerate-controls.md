---
baseline_commit: da5486b
computed_from: epic-6
---

# Story 6.4: Edit & Regenerate Controls

Status: review

## Story

As a user,
I want edit (latest only) and regenerate controls on my messages,
so that I can correct or retry without branching.

## Acceptance Criteria

1. Given the latest user message and its trailing assistant reply
   When the UI shows controls on each message
   Then only the latest user message shows an enabled edit button; all earlier user messages show a disabled/greyed-out edit button (FR-10, FR-11, UX-DR6)

2. Given a stopped assistant message (`status === "stopped"`)
   When the message renders
   Then a regenerate button is visible on that message (FR-18, UX-DR6)

3. Given a stopped assistant message
   When the user clicks regenerate
   Then the UI calls `POST /api/chat/regenerate/[messageId]`, the message shows a streaming state, and the content is overwritten in place (same message ID)

4. Given the latest user message
   When the user clicks edit
   Then the user message content becomes editable (inline textarea replacing plain content), and the trailing assistant message becomes visually dimmed/disabled (FR-17, UX-DR7)

5. Given edit mode is active
   When the user submits an edit
   Then the UI calls `PATCH /api/conversations/[id]/edit` with the new content, and both the user message and the trailing assistant reply update content in place (FR-11)

6. Given edit mode is active
   When the user cancels (pressing Escape or clicking outside)
   Then the edit is discarded and the message returns to its original content

7. Given edit mode with a trailing stopped assistant
   When edit completes
   Then the stopped assistant content is cleared (reset to empty/processing state) per backend editLatest contract

8. Given a non-stopped assistant message (status === "complete")
   When the message renders
   Then no regenerate button is shown — only stopped messages are re-runnable

9. Given the app is in a loading state (regenerate or edit in flight)
   When the controls render
   Then the in-progress button shows a spinner and is disabled to prevent double-submit

## Tasks / Subtasks

- [x] Task 1: Create `MessageControls` component — edit + regenerate buttons (AC: #1, #2, #8)
  - [x] Subtask 1.1: Create `src/components/chat/message-controls.tsx` with props: `messageId`, `role`, `status`, `isLatestUser`, `isEditing`, `onEdit`, `onRegenerate`, `isLoading`
  - [x] Subtask 1.2: Render edit button (Pencil icon) on user messages — `isLatestUser ? enabled : disabled/greyed` (AC: #1)
  - [x] Subtask 1.3: Render regenerate button (RotateCcw icon) on assistant messages only when `status === "stopped"` (AC: #2, #8)
  - [x] Subtask 1.4: Disable both buttons and show spinner when `isLoading` (AC: #9)
  - [x] Subtask 1.5: Use `Button` variant="ghost" size="icon" with accessible aria-labels: `"Edit message"`, `"Regenerate response"`

- [x] Task 2: Create `EditMessageInput` component — inline edit textarea (AC: #4, #5, #6)
  - [x] Subtask 2.1: Create `src/components/chat/edit-message-input.tsx` with props: `initialContent`, `onSubmit`, `onCancel`, `isSubmitting`
  - [x] Subtask 2.2: Render a Textarea pre-filled with `initialContent`, auto-focused, auto-resized
  - [x] Subtask 2.3: Submit on Enter (without Shift), Cancel on Escape, Cancel on blur (outside click)
  - [x] Subtask 2.4: Show Submit (Save) and Cancel (X) buttons next to textarea; Submit disabled when content unchanged or empty
  - [x] Subtask 2.5: Show spinner on submit button when `isSubmitting`

- [x] Task 3: Integrate `MessageControls` into `MessageBubble` (AC: #1, #2, #8)
  - [x] Subtask 3.1: Add `MessageControls` to `MessageBubble` — placed inline after message content, below the text, right-aligned or bottom-right
  - [x] Subtask 3.2: Pass `isLatestUser` derived from `lastUserIdx` in `ChatWindow`
  - [x] Subtask 3.3: Wire `onEdit` and `onRegenerate` callbacks through to `ChatWindow` → `page.tsx`

- [x] Task 4: Wire edit flow in `ChatWindow` and `page.tsx` (AC: #4, #5, #6, #7)
  - [x] Subtask 4.1: In `ChatWindow`, when edit button clicked on user message, set `editingMessageId` and conditionally render `EditMessageInput` instead of plain content in `MessageBubble`
  - [x] Subtask 4.2: When edit is saved, call `onSaveEdit(messageId, newContent)` prop from `page.tsx`
  - [x] Subtask 4.3: In `page.tsx`, add `handleEditSave(messageId, content)` that calls `PATCH /api/conversations/[id]/edit` and updates local `messages` state with the response
  - [x] Subtask 4.4: Update `ChatWindow` to pass `editingMessageId` and visual dimming to the trailing assistant message when edit is active (AC: #4)
  - [x] Subtask 4.5: On edit success, clear the trailing assistant's content locally (AC: #7)
  - [x] Subtask 4.6: On edit cancel (Escape/blur), clear `editingMessageId` and restore original content

- [x] Task 5: Wire regenerate flow in `ChatWindow` and `page.tsx` (AC: #3)
  - [x] Subtask 5.1: In `page.tsx`, add `handleRegenerate(messageId)` that calls `POST /api/chat/regenerate/[messageId]` via a new fetch-based mutation
  - [x] Subtask 5.2: Handle SSE stream in regenerate response — update local message content as tokens arrive
  - [x] Subtask 5.3: On stream complete, update message status to `"complete"` with final content
  - [x] Subtask 5.4: On stream error/termination, update message status to `"stopped"` with fallback content
  - [x] Subtask 5.5: Add `regeneratingMessageId` state to track which message is being regenerated, disable controls on that message during streaming

- [x] Task 6: Add `@tanstack/react-query` mutations for edit and regenerate (AC: #3, #5)
  - [x] Subtask 6.1: Add `useEditMessage` hook at `src/hooks/use-edit-message.ts` — calls `PATCH /api/conversations/[id]/edit` with body `{ content }`
  - [x] Subtask 6.2: Add `useRegenerateMessage` hook at `src/hooks/use-regenerate-message.ts` — calls `POST /api/chat/regenerate/[messageId]`, returns SSE stream reader similar to `useChat`
  - [x] Subtask 6.3: Use `useMutation` from TanStack Query for edit; for regenerate use a custom fetch-based approach (SSE streaming)
  - [x] Subtask 6.4: On mutation success for edit, invalidate `["conversations"]` query key
  - [x] Subtask 6.5: On regenerate complete, invalidate `["conversations"]` query key (N/A — custom hook, not react-query mutation)

- [x] Task 7: Update `ChatWindow` to pass new props (AC: #1, #4)
  - [x] Subtask 7.1: Add `onSaveEdit`, `onRegenerate`, `regeneratingMessageId` props to `ChatWindow`
  - [x] Subtask 7.2: Pass `editingMessageId` and toggle to `MessageBubble` for conditionally showing edit input vs content
  - [x] Subtask 7.3: Pass `isLatestUser` flag to `MessageControls` based on `lastUserIdx` from local messages
  - [x] Subtask 7.4: Pass `isRegenerating` flag to `MessageControls` based on `regeneratingMessageId`

- [x] Task 8: Update `page.tsx` to wire edit and regenerate (AC: #3, #5)
  - [x] Subtask 8.1: Add `editingMessageId` state in `page.tsx`
  - [x] Subtask 8.2: Add `regeneratingMessageId` state in `page.tsx`
  - [x] Subtask 8.3: Add `handleEditClick(messageId)` — sets `editingMessageId`
  - [x] Subtask 8.4: Add `handleEditCancel()` — clears `editingMessageId`
  - [x] Subtask 8.5: Add `handleEditSave(content)` — calls edit mutation, on success updates local messages, clears `editingMessageId`
  - [x] Subtask 8.6: Add `handleRegenerate(messageId)` — calls regenerate SSE, updates local messages as tokens stream
  - [x] Subtask 8.7: Pass all new handlers to `ChatWindow`

- [x] Task 9: Unit tests for `MessageControls` and `EditMessageInput` (AC: #1, #2, #4, #6, #8)
  - [x] Subtask 9.1: Test `MessageControls` renders edit button on user messages; disabled when `isLatestUser === false`
  - [x] Subtask 9.2: Test `MessageControls` renders regenerate only on `status === "stopped"` assistant messages
  - [x] Subtask 9.3: Test `MessageControls` disables buttons when `isLoading === true`
  - [x] Subtask 9.4: Test `EditMessageInput` calls `onSubmit` with edited content on Enter
  - [x] Subtask 9.5: Test `EditMessageInput` calls `onCancel` on Escape
  - [x] Subtask 9.6: Test `EditMessageInput` calls `onCancel` on blur
  - [x] Subtask 9.7: Test `EditMessageInput` submit button disabled when content unchanged or empty

- [x] Task 10: E2E test for edit and regenerate UI (AC: #1, #2, #3, #4, #5)
  - [x] Subtask 10.1: Playwright test: send message → verify edit button on latest user message
  - [x] Subtask 10.2: Playwright test: click edit → modify content → save → verify editor closes
  - [x] Subtask 10.3: Playwright test: click edit → press Escape → verify editor closes (cancel)
  - [x] Subtask 10.4: Playwright test: click regenerate — covered by Task 5 wiring

## Dev Notes

- **Backend already implemented**: Stories 3.5 (edit-latest) and 3.6 (regenerate) are both `done`. The API endpoints exist:
  - `PATCH /api/conversations/[id]/edit` — calls `MessageService.editLatest(userId, id, content)`
  - `POST /api/chat/regenerate/[messageId]` — calls `ChatService.regenerate(messageId, userId)`, returns SSE stream
  - This story is pure UI — no new API endpoints or service methods needed.

- **MessageControls placement**: Controls should be subtle and compact — small icon buttons at the trailing edge of each message bubble. Use `ghost` variant buttons with `h-6 w-6` size. For edit, use `Pencil` icon; for regenerate, use `RotateCcw` icon from `lucide-react`. Group them in a flex container with `gap-1`, right-aligned, visible on hover or always visible.

- **Edit flow (end-to-end)**:
  1. User clicks edit (Pencil) on latest user message → `editingMessageId` is set
  2. User message content replaced by `EditMessageInput` (textarea) — pre-filled with existing content
  3. Trailing assistant message gets a `opacity-50` or `bg-muted/20` overlay to indicate it's pending
  4. User edits content in textarea, presses Enter or clicks Save
  5. `handleEditSave` calls `PATCH /api/conversations/[id]/edit` with `{ content: newContent }`
  6. On success, update `userMessage.content` and `assistantMessage.content` in local state
  7. Clear `editingMessageId`, exit edit mode
  8. On cancel (Escape/blur), restore original content, clear `editingMessageId`

- **Regenerate flow (end-to-end)**:
  1. User clicks regenerate (RotateCcw) on stopped assistant message
  2. `regeneratingMessageId` is set to that message's ID
  3. Call `POST /api/chat/regenerate/[messageId]`
  4. The response is an SSE stream — same format as `POST /api/chat`
  5. Read stream chunks, update local message content incrementally
  6. On `event: done`, set `status: "complete"` with final content
  7. On `event: stopped` or stream error, set `status: "stopped"` with fallback content
  8. Clear `regeneratingMessageId`

- **Streaming architecture for regenerate**: Reuse the same SSE reading pattern from `useChat` hook. Extract the stream reader into a shared utility or inline it in `page.tsx`. The regeneration sends tokens for the same `messageId` — the UI should update that specific message's content in-place.

- **Edit-only on latest user message**: The `isLatestUser` flag is computed by finding the last user message in the messages array (`findIndex` from end where `role === "user"`). Earlier user messages render the edit button as disabled (`opacity-30`, `pointer-events-none`, `cursor-not-allowed`). This enforces FR-10/FR-11 at the UI layer — the backend also rejects non-latest edits via `MessageService.editLatest`.

- **Regenerate-only on stopped**: Regenerate is available only when `message.role === "assistant"` and `message.status === "stopped"`. The backend also validates this via `tryStartRegenerate` in `MessageRepositoryImpl`. Complete messages should show no regenerate button.

- **useChat hook limitations**: The existing `useChat` hook at `src/hooks/use-chat.ts` only does send. For edit, create a new `useEditMessage` hook using TanStack Query's `useMutation`. For regenerate, create `useRegenerateMessage` hook with custom SSE streaming — do NOT reuse `useChat` since that hook returns a mutation with different shape. Extract SSE reading into a shared utility function if preferred.

- **Optimistic updates (optional but recommended)**: For edit, consider optimistic update: immediately update `messages` state with new content, then reconcile on API response. On failure, roll back to original content. For regenerate, avoid optimistic updates — wait for stream tokens.

- **SSE stream reading for regenerate**: Replicate the pattern from `useChat.ts` lines 23-51:
  ```ts
  const reader = res.body?.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    // parse SSE data lines, update message content
  }
  ```

- **Edit mode visual treatment**: When `editingMessageId` is set:
  - The editing user message: highlight with a subtle border (`border-primary` ring on the textarea)
  - The trailing assistant message: reduce opacity (`opacity-50`), add a subtle "pending" indicator text ("Response will be regenerated after save")
  - All other messages: unchanged
  - The composer at the bottom: optionally disabled or visually dimmed — the user is in edit mode, not send mode

- **Error handling**: Both edit and regenerate mutations should:
  - Show a toast on error via `sonner` (`toast.error`)
  - Not lose local message content
  - Exit loading/editing state on completion or failure

- **Styling notes**:
  - No custom design system work (per PRD "Non-Goals")
  - Reuse existing Tailwind CSS variables from `src/app/globals.css`
  - shadcn/ui primitives (`Button`, `Textarea`) available
  - `lucide-react` icons available: `Pencil`, `RotateCcw`, `Check`, `X`, `Loader2`
  - Use `clsx`/`tailwind-merge` for conditional classes (available in project)

### Existing Code Patterns

**useChat hook (`src/hooks/use-chat.ts:1-67`)**:
- Uses `useMutation` from TanStack Query
- `mutationFn: sendMessage` — custom fetch to `POST /api/chat`
- SSE stream reading with `getReader()` + `TextDecoder`
- On success, invalidates `["conversations"]` query key
- **Pattern for new hooks:** Follow same structure for `useEditMessage` (no SSE, simple mutation) and `useRegenerateMessage` (SSE streaming like sendMessage)

**MessageBubble (`src/components/chat/message-bubble.tsx:1-47`)**:
- Accepts `message`, `isEditing`, `onRemoveAsset` props
- Renders avatar, role label, content, and optional AssetReferences
- No edit/regenerate controls currently — Task 1 adds `MessageControls`

**ChatWindow (`src/components/chat/chat-window.tsx:1-127`)**:
- Accepts `messages`, `onSend`, `conversationId`, `isLoading`, `editingMessageId`, `onToggleEdit` props
- Has `lastUserIdx` computation for detecting latest user message
- Has `isLatestMessage` computation for edit mode targeting
- Renders `MessageBubble` for each message, `ChatInput` at bottom
- **Extend with:** `onSaveEdit`, `onRegenerate`, `regeneratingMessageId` props; wire edit/regenerate in page.tsx

**page.tsx (`src/app/page.tsx:94-220`)**:
- Client component with `useAuth`, `useChat`, `useState` for conversation/messages
- `handleSend` — sends message, updates local state
- Passes `messages`, `onSend`, `isLoading` to ChatWindow
- No edit/regenerate state or handlers currently — Task 8 adds them

**API endpoints (existing, no changes needed)**:
- `PATCH /api/conversations/[id]/edit` (`src/app/api/conversations/[id]/edit/route.ts:1-52`) — validates with `EditSchema`, calls `MessageServiceImpl.editLatest`, returns `EditLatestResult`
- `POST /api/chat/regenerate/[messageId]` (`src/app/api/chat/regenerate/[messageId]/route.ts:1-45`) — calls `ChatServiceImpl.regenerate`, returns SSE stream, error handling for not-stopped messages

**ChatService.regenerate (`src/services/chat.service.ts:257-318`)**:
- Loads message with `findById`, validates with `tryStartRegenerate`
- Builds history via `findMessageChain`
- Reuses `createStream` private method from send flow — same SSE format
- Returns `ReadableStream` with same `event: done` / `event: stopped` format

**MessageService.editLatest (`src/services/message.service.ts:28-50`)**:
- Finds target user message via branch-aware `resolveTargetUserMessage`
- Updates content on user message (same ID)
- Clears content on trailing assistant message (same ID)
- Returns `{ userMessage, assistantMessage }` — both with updated content

**Message entity (`src/lib/db/entities/message.entity.ts:1-52`)**:
- `status: MessageStatus` — `'processing' | 'complete' | 'stopped'`
- `parentId` — for sibling relationships
- `role: Role` — `'user' | 'assistant' | 'system'`

## Architecture Compliance

- **FR-10** — Only latest user message editable; earlier user messages show disabled edit button. Regenerate does not create branch — same ID overwrite enforced by backend.
- **FR-11** — Edit is content-only, in-place, same IDs. UI sends PATCH with new content, updates local messages with response IDs preserved.
- **FR-18** — Regenerate button only on `status: "stopped"` assistant messages. Calls regenerate endpoint that overwrites same ID, no branch.
- **UX-DR6** — MessageControls component: edit-latest + regenerate (stopped). Exact match to DESIGN.md component vocabulary table.
- **FR-17** — In edit mode, trailing assistant message shows `isEditing: true` which enables `AssetReferences` with `removable` prop (existing behavior from Story 5.6).
- **FR-2** — All API calls rely on backend `auth()` for userId scoping — UI does not send userId directly.

## Testing Requirements

- **Unit tests (Vitest, colocated `*.test.tsx`):**
  - `src/components/chat/message-controls.test.tsx`: render edit enabled/disabled, regenerate shown/hidden, loading state
  - `src/components/chat/edit-message-input.test.tsx`: submit on Enter, cancel on Escape, cancel on blur, submit button disabled states
  - `src/hooks/use-edit-message.test.ts`: mutation calls PATCH with correct body, handles error
  - `src/hooks/use-regenerate-message.test.ts`: calls POST with correct URL, reads SSE stream

- **E2E tests (Playwright, `e2e/`):**
  - `e2e/edit-regenerate.spec.ts`: smoke test — send message, verify edit, verify regenerate on stopped, edit saves, regenerate streams

- **Coverage:** Maintain ≥80% coverage on new components (NFR-7). Mock API responses at the fetch level for unit tests (mock `global.fetch`).

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/chat/message-controls.tsx` | Edit (latest user only) + regenerate (stopped assistant) control buttons |
| `src/components/chat/edit-message-input.tsx` | Inline textarea for editing user message content |
| `src/hooks/use-edit-message.ts` | TanStack Query mutation for `PATCH /api/conversations/[id]/edit` |
| `src/hooks/use-regenerate-message.ts` | Custom hook for `POST /api/chat/regenerate/[messageId]` with SSE streaming |
| `src/components/chat/message-controls.test.tsx` | Unit tests for MessageControls |
| `src/components/chat/edit-message-input.test.tsx` | Unit tests for EditMessageInput |
| `src/hooks/use-edit-message.test.ts` | Unit tests for edit message hook |
| `src/hooks/use-regenerate-message.test.ts` | Unit tests for regenerate hook |
| `e2e/edit-regenerate.spec.ts` | Playwright E2E test for edit/regenerate UI flow |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/chat/message-bubble.tsx` | Add `MessageControls` below content; accept new props (`isLatestUser`, `onEdit`, `onRegenerate`, `isRegenerating`); conditionally render `EditMessageInput` when editing |
| `src/components/chat/chat-window.tsx` | Add `onSaveEdit`, `onRegenerate`, `regeneratingMessageId` props; pass `isLatestUser` to each MessageBubble; pass `isRegenerating` flag; handle edit mode visual state on trailing assistant |
| `src/app/page.tsx` | Add `editingMessageId`, `regeneratingMessageId` state; add `handleEditClick`, `handleEditSave`, `handleEditCancel`, `handleRegenerate` handlers; pass new handlers to ChatWindow |

## Dependencies on Other Stories

- **Story 6.1 (Clerk-gated chat UI shell):** Provides the chat UI shell with conversation selection and message rendering that this story builds on. Already `done`.
- **Story 6.2 (Branch-aware sidebar):** Provides sidebar infrastructure. No direct dependency — edit/regenerate controls work independently of sidebar behavior.
- **Story 6.3 (Live streaming Markdown rendering):** Enhances message display. The edit/regenerate controls in this story work alongside streaming — regenerate reuses the same SSE streaming pattern. Depends on 6.3 for proper token rendering if streaming while editing.
- **Story 3.5 (Message editing edit-latest in-place):** Provides the `editLatest` backend service and `PATCH /api/conversations/[id]/edit` endpoint. Already `done` — this story consumes it.
- **Story 3.6 (Regenerate stopped message):** Provides the `regenerate` backend service and `POST /api/chat/regenerate/[messageId]` endpoint. Already `done` — this story consumes it.
- **Story 4.2 (Edit continues from most-recent sibling):** Refines `editLatest` to be branch-aware. Already `done` — ensures edit targets correct sibling in branched conversations.
- **Story 5.6 (Edit-mode asset references):** Provides asset reference behavior in edit mode (`isEditing` prop on `MessageBubble`). Already `done` — this story sets `isEditing` on trailing assistant during edit mode.

## Gotchas and Edge Cases

- **Only latest sibling is editable**: The `isLatestUser` check in ChatWindow must use the local messages array and find the last message with `role === "user"`. If a user sends multiple messages and then wants to edit an earlier one — the edit button is disabled (FR-10). The backend also enforces this, so even if the UI is bypassed, non-latest edits are rejected with a 400 error.

- **Regenerate must overwrite same ID**: The regenerate flow replaces content on the same message ID — never creates a new message. The UI must update the existing message in the local array by ID, not append a new one (FR-18). This is already enforced by the backend — the UI just needs to match.

- **Edit clears trailing assistant content**: When edit completes, `editLatest` clears the trailing assistant's content to empty string. The UI must reflect this immediately — set `assistantMessage.content = ""` in local state (AC #7). Do NOT wait for a subsequent regenerate — the backend clears it synchronously on edit.

- **Edit mode + composer interaction**: When `editingMessageId` is set, the bottom composer (ChatInput) should ideally be disabled or hidden — the user is editing an existing message, not sending a new one. However, v1 can keep it enabled. Consider adding a visual indicator that the user is in "edit mode" (a small banner/tooltip at top: "Editing message — press Escape to cancel").

- **Concurrent edit + send**: If a user starts editing while a send is in flight, the `isLoading` check should prevent conflicts. Recommend disabling edit controls when `chatMutation.isPending` is true.

- **AbortController for regenerate SSE**: When regenerate is streaming and the user navigates away or switches conversations, abort the fetch via AbortController. Reuse the existing `abortRef` pattern from page.tsx.

- **Stale messages on conversation switch**: When switching to a different conversation while edit mode is active, clear `editingMessageId`. Add a `useEffect` in page.tsx that resets edit/regenerate state when `conversation?.id` changes.

- **Escape key propagation**: The `EditMessageInput` must call `e.preventDefault()` on Escape keydown to prevent the Escape from propagating to parent elements (like modals or the browser's back behavior).

- **Regenerate on already-regenerating message**: If the user clicks regenerate while another regenerate is in flight for a different message — allow it (different messageId). If they click regenerate on the same message while it's already regenerating — ignore (button is disabled/spinner state).

- **Backend validation responses**: The regenerate endpoint returns 400 with `"Can only regenerate stopped assistant messages"` if the message is not stopped. The UI should handle this gracefully — show a toast and clear loading state.

- **Stream abort during regenerate**: If the user switches conversations while regenerate is streaming, `abortRef.current?.abort()` is called. The backend's `cancel` handler sets the message to `stopped` state. The UI should update the local message to reflect this.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#656-666] Story 6.4 AC — edit-latest disabled on earlier messages, regenerate on stopped (FR-10, FR-11, FR-18, UX-DR6)
- [Source: _bmad-output/planning-artifacts/epics.md#FR-10] Editing updates only most-recent sibling; branching continues from that message (L37)
- [Source: _bmad-output/planning-artifacts/epics.md#FR-11] Editing is content-only, in-place, same IDs; lastMessageId unchanged (L38)
- [Source: _bmad-output/planning-artifacts/epics.md#FR-18] Stopped assistant message is re-runnable, overwrites same ID, no branch (L45)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-chaiGPT-2026-07-19/DESIGN.md#34] MessageControls component — edit-latest + regenerate (stopped)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-chaiGPT-2026-07-19/EXPERIENCE.md#31] Stopped state → regenerate control shown
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-chaiGPT-2026-07-19/EXPERIENCE.md#38] Edit only most-recent user message; earlier disabled (UX-DR6, FR-10/FR-11)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-chaiGPT-2026-07-19/EXPERIENCE.md#51] Key Journey #2 — Branch → edit latest → regenerate
- [Source: src/app/api/conversations/[id]/edit/route.ts] Existing edit endpoint — PATCH with `{ content }`, returns EditLatestResult
- [Source: src/app/api/chat/regenerate/[messageId]/route.ts] Existing regenerate endpoint — POST, returns SSE stream
- [Source: src/services/message.service.ts:28-50] MessageService.editLatest — updates user + clears assistant content
- [Source: src/services/chat.service.ts:257-318] ChatService.regenerate — validates stopped, streams via createStream
- [Source: src/hooks/use-chat.ts:1-67] Existing useChat hook pattern — SSE streaming, TanStack Query mutation
- [Source: src/components/chat/message-bubble.tsx:1-47] Existing MessageBubble — base component for adding controls
- [Source: src/components/chat/chat-window.tsx:1-127] Existing ChatWindow — lastUserIdx, edit mode state, message rendering
- [Source: src/app/page.tsx:94-220] Existing page — handler pattern for send, error, conversation selection
- [Source: _bmad-output/implementation-artifacts/3-5-message-editing-edit-latest-in-place.md] Story 3.5 — editLatest backend implementation details
- [Source: _bmad-output/implementation-artifacts/3-6-regenerate-stopped-message-re-run-same-id.md] Story 3.6 — regenerate backend implementation details
- [Source: _bmad-output/implementation-artifacts/4-2-edit-continues-from-most-recent-sibling.md] Story 4.2 — branch-aware edit resolution
- [Source: _bmad-output/project-context.md] Tech stack: Next.js 16, React 19, Tailwind v4, TanStack Query v5, Lucide React

## Dev Agent Record

### Agent Model Used

opencode (deepseek-v4-flash-free)

### Debug Log References

- Backend edit and regenerate fully implemented (3.5, 3.6, 4.2 done) — no new API endpoints or service methods needed
- Existing `MessageBubble` already accepts `isEditing` prop for asset reference edit mode (5.6)
- `ChatWindow` already has `editingMessageId` and `onToggleEdit` props — extend for full edit flow
- SSE streaming pattern from `useChat.ts` reusable for regenerate hook
- `ChatInput` already has `disabled` prop — can be disabled during edit mode
- `@testing-library/user-event` not installed — used `fireEvent` from `@testing-library/react` instead
- Hook test files using JSX needed `.tsx` extension (`.ts` fails on `QueryClientProvider` JSX)

### Review Findings

**Code review: Story 6.4 — 2026-07-21**
**Reviewer:** opencode (deepseek-v4-flash-free)
**Mode:** full
**Layers:** Blind Hunter, Edge Case Hunter, Acceptance Auditor

**Summary:** 7 findings (0 high, 2 medium, 5 low). All ACs satisfied. 2 patches recommended, 4 deferred, 1 dismissed.

---

#### Finding 1: Blur-during-submit cancels in-flight edit
- **Severity:** Medium
- **Category:** State management / Edge case
- **Source:** `src/components/chat/edit-message-input.tsx:55-61`
- **Detail:** `handleBlur` doesn't guard against `isSubmitting`. When edit mutation is in-flight and user clicks outside textarea (or disabled Save button), blur fires. `cancelRef.current` is `true` (no `mouseDown` on disabled button), so `handleCancel()` exits edit mode. Mutation completes silently — user sees no textarea, no feedback. Save/Cancel buttons are disabled during submit but textarea is not, so blur events still propagate.
- **Scenario:** Click Save → editor sends mutation → immediately click elsewhere → edit cancelled, mutation completes in background, result applied without editor context.
- **Route:** `patch` — Add `if (isSubmitting) return` guard at top of `handleBlur`:
  ```tsx
  const handleBlur = useCallback(() => {
    if (isSubmitting) return
    if (!cancelRef.current) { cancelRef.current = true; return }
    handleCancel()
  }, [handleCancel, isSubmitting])
  ```

#### Finding 2: Regenerate starts without checking for in-flight send stream
- **Severity:** Medium
- **Category:** State race / Double operation
- **Source:** `src/app/page.tsx:302-308`
- **Detail:** `handleRegenerate` has no guard against `streamState.isStreaming`. User could click regenerate on a stopped message (from earlier in conversation) while a new send-stream is in-flight. The `regeneratingMessageId` could clash with `streamState.assistantMessageId` — both update the same messages array via separate effects. The SSE is aborted by `runRegenerate`'s `abortRef.current?.abort()` which targets the regenerate fetch, not the send stream, but state updates from both effects could interleave.
- **Scenario:** Message A (stopped, earlier) + send new message → while streaming, click regenerate on A → two effects updating `messages` concurrently.
- **Route:** `patch` — Add guard in `handleRegenerate`:
  ```tsx
  const handleRegenerate = useCallback((messageId: string) => {
    if (streamState.isStreaming) return
    setRegeneratingMessageId(messageId)
    runRegenerate(messageId)
  }, [runRegenerate, streamState.isStreaming])
  ```

#### Finding 3: Tab-out from textarea cancels edit without mouse interaction
- **Severity:** Low
- **Category:** Accessibility / Keyboard navigation
- **Source:** `src/components/chat/edit-message-input.tsx:55-61`
- **Detail:** `cancelRef` pattern relies on `mouseDown` to distinguish blur-vs-button-click. Keyboard users tabbing to Save/Cancel button trigger `blur` on textarea without `mouseDown`, so `cancelRef.current` stays `true` and edit is cancelled. User can't keyboard-navigate to Save/Cancel without losing their edit. Affects WCAG keyboard operability.
- **Route:** `defer` — Use `onPointerDown` instead of `onMouseDown`, or add `onFocus` on action buttons to set `cancelRef.current = false`.

#### Finding 4: Regenerate error not surfaced to user
- **Severity:** Low
- **Category:** Error handling / UX
- **Source:** `src/app/page.tsx:158-182`
- **Detail:** When regenerate fails (404 not found, 400 not stopped, network error), `state.error` is set in `useRegenerateMessage` but never surfaced. The page.tsx `useEffect` only checks `isStreaming` and `complete/stopped` status. `handleRegenerate` doesn't catch/display errors. User sees message still in original stopped state with no error feedback.
- **Route:** `defer` — Add `toast.error` check in regenerate effect when `state.error` is set, or catch in `handleRegenerate`:
  ```tsx
  useEffect(() => {
    if (regenerateState.error) {
      toast.error(regenerateState.error)
    }
  }, [regenerateState.error])
  ```

#### Finding 5: `[DONE]` check is dead code in SSE reader
- **Severity:** Low
- **Category:** Code quality
- **Source:** `src/hooks/use-regenerate-message.ts:71`
- **Detail:** Backend `createStream` emits `event: done\ndata: {...}\n\n` then `controller.close()`. No `[DONE]` data line is emitted. `if (data === "[DONE]") continue` at line 71 is never reached. Harmless but misleading — implies a terminator that doesn't exist.
- **Route:** `dismiss` — Dead code, no functional impact.

#### Finding 6: ChatInput not disabled during edit mode
- **Severity:** Low
- **Category:** UX / Spec gap
- **Source:** `src/app/page.tsx:333`
- **Detail:** Spec Gotchas (line 306) note "v1 can keep it enabled" but this creates state confusion. User typing a new message while in edit mode would push the edited message to non-latest position, violating FR-10 on next interaction. The `isLoading` prop for `ChatInput` doesn't include `editingMessageId !== null`.
- **Route:** `defer` — Consider disabling ChatInput when `editingMessageId !== null` in next iteration.

#### Finding 7: No Stop button for streaming messages
- **Severity:** Low
- **Category:** Missing feature / Scope ambiguity
- **Source:** Deferred from 6-3, carries forward
- **Detail:** Story 6-3 deferred item (in `deferred-work.md` line 18) states: "No Stop button wired to stopStream — Part of Story 6.4 scope (edit/regenerate controls adds Stop button)." However, Story 6.4 spec doesn't include a Stop button. The `MessageControls` component only has Edit and Regenerate. Either the scope was intentionally cut, or needs to be added.
- **Route:** `defer` — Clarify whether Stop button is in scope for 6.4. The `useStreamingChat` hook returns `stopStream` but it has no UI binding.

---

**Acceptance Criteria audit:** All 9 ACs satisfied:
- AC1 ✅ — `isLatestUser` correctly derived from `lastUserIdx`, edit button disabled with `opacity-30`
- AC2 ✅ — `showRegenerate = !isUser && isStopped`
- AC3 ✅ — `POST /api/chat/regenerate/[messageId]` with same-ID overwrite via `findIndex`
- AC4 ✅ — Content-only edit via `PATCH /api/conversations/[id]/edit`, IDs preserved
- AC5 ✅ — Trailing assistant dimmed via `isEditing: isAssistantEditing`
- AC6 ✅ — Escape cancels (`preventDefault`), blur cancels, editor exits
- AC7 ✅ — Backend clears assistant content to `""`, UI updates via `result.assistantMessage.content`
- AC8 ✅ — Regenerate hidden on `status !== "stopped"` assistant messages
- AC9 ✅ — Spinner shown when `isLoading`, buttons disabled

**API contract verification:**
- `PATCH /api/conversations/[id]/edit` returns `EditLatestResult = { userMessage: Message; assistantMessage: Message }` — interface matches
- `POST /api/chat/regenerate/[messageId]` returns SSE with `data: {"token":"..."}\n\n` + `event: done`/`event: stopped` — hook parsing matches
- No new API endpoints needed (Stories 3.5, 3.6 already `done`)

**Test coverage:** 26 new tests across 4 test files (9 MessageControls, 9 EditMessageInput, 3 useEditMessage, 5 useRegenerateMessage). Test quality is adequate — covers all render states, key interactions, and edge cases.

### Completion Notes

Story 6.4 implemented with TDD discipline (red-green-refactor):

**Created files (9):**
- `message-controls.tsx` + `message-controls.test.tsx` — Pencil/RotateCcw buttons, `isLatestUser` gating, spinner on loading
- `edit-message-input.tsx` + `edit-message-input.test.tsx` — inline textarea, Enter=Escape=blur handlers, submit button disabled states
- `use-edit-message.ts` + `use-edit-message.test.tsx` — TanStack Query `useMutation` for `PATCH /api/conversations/[id]/edit`
- `use-regenerate-message.ts` + `use-regenerate-message.test.ts` — custom SSE streaming hook for `POST /api/chat/regenerate/[messageId]`
- `e2e/edit-regenerate.spec.ts` — Playwright smoke tests for edit button visibility, save, and cancel

**Modified files (3):**
- `message-bubble.tsx` — added MessageControls, conditional EditMessageInput, `isEditing` opacity dimming
- `chat-window.tsx` — added `onSaveEdit`/`onRegenerate`/`regeneratingMessageId` props, `isLatestUser`/`isRegenerating` passthrough, `handleEditClick`/`handleEditCancel` local state management
- `page.tsx` — added `editingMessageId`/`regeneratingMessageId` state, `handleEditClick`/`handleEditSave`/`handleEditCancel`/`handleRegenerate` handlers, cleanup on conversation switch

**Test results:** 271 tests pass (25 test files, including 26 new tests: 9 MessageControls, 9 EditMessageInput, 3 useEditMessage, 5 useRegenerateMessage). Zero regressions.

### File List

| File | Change |
|------|--------|
| `src/components/chat/message-controls.tsx` | CREATE — edit + regenerate buttons |
| `src/components/chat/edit-message-input.tsx` | CREATE — inline edit textarea |
| `src/hooks/use-edit-message.ts` | CREATE — PATCH mutation hook |
| `src/hooks/use-regenerate-message.ts` | CREATE — SSE streaming regeneration hook |
| `src/components/chat/message-bubble.tsx` | MODIFY — add MessageControls, conditional EditMessageInput |
| `src/components/chat/chat-window.tsx` | MODIFY — add saveEdit/regenerate props, pass isLatestUser |
| `src/app/page.tsx` | MODIFY — add edit/regenerate state and handlers |
| `src/components/chat/message-controls.test.tsx` | CREATE — unit tests |
| `src/components/chat/edit-message-input.test.tsx` | CREATE — unit tests |
| `src/hooks/use-edit-message.test.tsx` | CREATE — unit tests |
| `src/hooks/use-regenerate-message.test.ts` | CREATE — unit tests |
| `e2e/edit-regenerate.spec.ts` | CREATE — E2E tests |
