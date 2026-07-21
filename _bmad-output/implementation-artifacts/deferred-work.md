# Deferred Work

## Deferred from: code review of story 6-1 (2026-07-21)

- Home and Sidebar each call useConversations independently — pre-existing pattern, not introduced by this story
- SignInButton modal has no fallback — Clerk limitation, not story-specific
- fetchConversationMessages has no timeout — general improvement for all API calls
- setState after unmount on conversation fetch — Home is root component, unmounts only on full-page nav

## Deferred from: code review of story 6-2 (branch-aware sidebar) (2026-07-21)

- Auth pattern makes 401 check dead code in all routes — `auth()` in `session.ts` throws on unauth, never returns null userId. All 10 route handlers have unreachable `if (!userId) return 401` blocks. Fix requires changing `session.ts` or restructuring all handlers. [`src/lib/auth/session.ts:10`]
- Client-side filter loads all 50 conversations then filters — acceptable with `take:50` cap but server-side `rootOf=[id]` param would be more efficient. [`src/hooks/use-conversations.ts:31`]
- Empty state "No conversations yet" misleading when filter returns zero — should differentiate "no conversations at all" from "no matching siblings." [`src/components/chat/sidebar.tsx:44`]

## Deferred from: code review of story 6-3 (live streaming & markdown rendering) (2026-07-21)

- No "Stop" button wired to `stopStream` — `useStreamingChat` returns `stopStream` but it is never called from any UI element. E2E test 3 clicks `button:has-text("Stop")` which does not exist. Part of Story 6.4 scope (edit/regenerate controls adds Stop button). [`src/hooks/use-chat.ts:245`]
- Citation key collision potential — `citations-section.tsx:17` keys by `citation.chunkId ?? idx`. If two citations share the same `chunkId`, React key collision occurs on re-render. Real-world impact near-zero since citations set once from `done` event. Pre-existing pattern from RAG citations. [`src/components/chat/citations-section.tsx:17`]
- ChatWindow `localMessages` double-buffer anti-pattern — `ChatWindow` keeps a local copy of `messages` prop synced via `useEffect`, creating one-render-cycle delay. Pre-existing in 6-1, not introduced by this story. [`src/components/chat/chat-window.tsx:32`]

## Deferred from: code review of story 6-4 (edit & regenerate controls) (2026-07-21)

- Tab-out from edit textarea cancels edit prematurely — `edit-message-input.tsx:55` relies on `mouseDown` to distinguish blur-vs-button-click. Keyboard users tabbing to Save/Cancel trigger `blur` without `mouseDown`, so `cancelRef.current` stays `true` and edit is cancelled. Fix: add `onFocus` on action buttons to set `cancelRef.current = false` or use `onPointerDown`. [`src/components/chat/edit-message-input.tsx:55`]

- Regenerate error never surfaced — `page.tsx:158` handles `complete`/`stopped` statuses but `state.error` from `useRegenerateMessage` is never displayed. User sees original stopped message with no failure feedback. Fix: add `toast.error` in effect when `state.error` is set. [`src/app/page.tsx:182`]

- ChatInput not disabled during edit mode — `page.tsx:333` `isLoading` prop doesn't include `editingMessageId !== null`. User can send new message while in edit mode, pushing edited message to non-latest position (FR-10 violation). Fix: conditionally disable ChatInput when edit mode active. [`src/app/page.tsx:333`]

- No Stop button for streaming messages — Story 6-3 deferred item wrote "Part of Story 6.4 scope (edit/regenerate controls adds Stop button)" but 6.4 spec doesn't include it. Clarify scope: does `MessageControls` get a Stop button for `status === "processing"` assistant messages? [`src/hooks/use-chat.ts:245`]

## Deferred from: code review of story 6-5 (large-paste-to-txt & asset-lifecycle-ui) (2026-07-21)

- No client-side MIME validation for uploads — only HTML `accept` on file input, bypassable via drag or devtools. Server validates (`sniffMime` + `AssetSchema`) but client-side early return with toast improves UX. [`src/components/chat/chat-input.tsx:182`]
- Delete dialog body doesn't handle long filenames — `{asset.filename}` rendered with no `break-words` or `max-w`. Very long filenames cause horizontal overflow. [`src/components/chat/asset-panel.tsx:162`]
- Conversation auto-create returns undefined id — if `POST /api/conversations` returns `{ id: undefined }`, `formData.append("conversationId", convId)` sends string `"undefined"`. Vanishingly unlikely with real API. [`src/components/chat/chat-input.tsx:93-94`]
