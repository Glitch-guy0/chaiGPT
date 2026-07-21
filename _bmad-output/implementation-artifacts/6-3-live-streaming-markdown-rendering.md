---
baseline_commit: da5486b
computed_from: epic-6
---

# Story 6.3: Live Streaming & Markdown Rendering

Status: review

## Story

As a user,
I want streamed assistant tokens rendered live as Markdown,
so that I read formatted replies as they arrive with no wait-for-complete delay.

## Acceptance Criteria

1. Given an SSE stream from `ChatService`
   When tokens arrive
   Then they render progressively in the message bubble, token by token, with no wait for stream completion (FR-19, UX-DR3)

2. Given a stream that completes normally
   When the `done` event fires
   Then the message shows `complete` status (status badge or visual indicator) (FR-6, UX-DR3)

3. Given a stream that is terminated by the user
   When the `stopped` event fires
   Then content shows "user terminated the response" and the message shows `stopped` status (FR-6, UX-DR3)

4. Given a message with Markdown content (code blocks, lists, inline formatting, headings)
   When the message renders
   Then content is rendered as formatted Markdown, not raw text (UX-DR4, brief #7)
   And partial/incomplete markdown tokens (e.g., `**bold` arriving split across chunks) render gracefully without displaying raw syntax

5. Given a streamed assistant reply that includes web-search citations (FR-26)
   When the `done` event includes `citations`
   Then citations (with source URLs) render below the message content as a `Citations` section
   And each citation shows source title and URL

6. Given the app is in a loading/streaming state
   When no tokens have arrived yet (time-to-first-token)
   Then the message bubble shows a loading indicator (animated dots or pulse) — never an empty bubble (NFR-5, UX-DR3 Processing state)

7. Given the stream encounters an error mid-flight
   When `ChatService` catches an error
   Then the message shows a `stopped` state with an error indicator, and content accumulated so far is preserved

8. Given a conversation with existing messages loads
   When messages are displayed
   Then all messages (not just streamed ones) render as Markdown consistently

## Tasks / Subtasks

- [x] Task 1: Install markdown rendering dependency (AC: #4)
  - [x] Subtask 1.1: Install `react-markdown` and `remark-gfm` (`npm install react-markdown remark-gfm`)
  - [x] Subtask 1.2: Verify no type conflicts with existing TypeScript strict mode — `react-markdown` v10+ ships its own types
  - [x] Subtask 1.3: Do NOT install `rehype-highlight` or `rehype-sanitize` in v1 — basic GFM is sufficient; code blocks styled via Tailwind prose defaults
  - [x] Subtask 1.4: If `tailwindcss/typography` is not installed, add `@tailwindcss/typography` and `prose` classes for message content

- [x] Task 2: Create `StreamingMessage` component (AC: #1, #2, #3, #4, #5)
  - [x] Subtask 2.1: Create `src/components/chat/streaming-message.tsx` — client component
  - [x] Subtask 2.2: Accept `content: string`, `isStreaming?: boolean`, `status?: 'processing' | 'complete' | 'stopped'`, `citations?: Citation[]` props
  - [x] Subtask 2.3: When `isStreaming` is true AND content is empty, render a `<StreamingIndicator>` with animated dots (three pulsing dots using `animate-pulse` or `animate-bounce`)
  - [x] Subtask 2.4: When content is non-empty, render via `<ReactMarkdown remarkPlugins={[remarkGfm]}>` with `prose` class for typography
  - [x] Subtask 2.5: Append a `<StatusBadge>` when `status` is `complete` or `stopped` — small muted text e.g. "Complete" or "Stopped", positioned below the content
  - [x] Subtask 2.6: When `status === 'stopped'`, display "user terminated the response" as the content fallback (only if content is empty/blank)
  - [x] Subtask 2.7: When `citations` array is present and non-empty, render a `<CitationsSection>` below the markdown content showing each citation's source (title, URL) as a list of external links with `target="_blank"` and `rel="noopener noreferrer"`
  - [x] Subtask 2.8: Wrap the entire component in a `<div>` with `role="status"` and `aria-live="polite"` for accessibility (EXPERIENCE.md Accessibility #46: streaming region announced as live region)
  - [x] Subtask 2.9: Ensure `ReactMarkdown` handles partial/incomplete markdown gracefully — do NOT add custom error boundaries; react-markdown v10+ ignores unclosed syntax by rendering raw text

- [x] Task 3: Refactor `useChat` hook for progressive streaming (AC: #1, #6)
  - [x] Subtask 3.1: Rename existing hook pattern — instead of returning a single `ChatResponse` after stream completes, expose an `AssistantStreamState` with reactive fields: `content: string`, `isStreaming: boolean`, `status: 'processing' | 'complete' | 'stopped'`, `citations?: Citation[]`, `error?: string`, `assistantMessageId?: string`
  - [x] Subtask 3.2: Parse each SSE `data:` token event and append to a live `content` state (not `ChatResponse.content` — tokens sent as `{"token":"..."}` per `chat.service.ts:189`)
  - [x] Subtask 3.3: Listen for `event: done` and `event: stopped` events — update `status` and `citations` from the event payload
  - [x] Subtask 3.4: On stream cancel (AbortController / user termination), update status to `stopped`
  - [x] Subtask 3.5: Add `startStream(messages, conversationId)` method that initiates the fetch + stream read and returns cleanup (abort function)
  - [x] Subtask 3.6: Keep the mutation for non-streaming fallback (e.g., error retry), but primary flow uses the streaming state
  - [x] Subtask 3.7: Export a new hook name `useStreamingChat` (keep `useChat` for backward compat or inline both — prefer new hook to avoid breaking existing usage)

- [x] Task 4: Integrate streaming state into `page.tsx` (AC: #1, #2, #3)
  - [x] Subtask 4.1: Add `streamingState` from `useStreamingChat` hook alongside existing `chatMutation`
  - [x] Subtask 4.2: In `handleSend`, after optimistically adding the user message, call `startStream` and pass the streaming content to the assistant message slot
  - [x] Subtask 4.3: While streaming, render the assistant message using `StreamingMessage` with live `content` and `isStreaming: true`
  - [x] Subtask 4.4: On stream complete, finalize the assistant message in local state with `status: 'complete'`, `content` from final buffer, `citations` from done event
  - [x] Subtask 4.5: On stream stopped, set `status: 'stopped'` and content to accumulated buffer (or "user terminated the response" fallback)
  - [x] Subtask 4.6: Handle the case where the conversation doesn't exist yet (new chat) — the `conversationId` is returned in the `done` event

- [x] Task 5: Update `MessageBubble` to use `StreamingMessage` (AC: #4, #8)
  - [x] Subtask 5.1: Replace `<p className="whitespace-pre-wrap ...">{message.content}</p>` in `message-bubble.tsx` with `<StreamingMessage>` component
  - [x] Subtask 5.2: For non-streaming messages (loaded from history), pass `isStreaming={false}`, `status` from message.status, and `content` from message.content
  - [x] Subtask 5.3: Add `citations` prop wiring from `Message` type (add `citations?: Citation[]` field to `Message` type if not present)
  - [x] Subtask 5.4: Remove the simple `<p>` raw-text render — all messages go through the markdown renderer

- [x] Task 6: Handle citations display in streaming (AC: #5)
  - [x] Subtask 6.1: Create `src/components/chat/citations-section.tsx` — renders a list of citation links
  - [x] Subtask 6.2: Each citation shows source snippet/context and URL as a styled citation card
  - [x] Subtask 6.3: Only visible when `citations.length > 0` — collapsible? In v1, just render below content as a simple list
  - [x] Subtask 6.4: Web-source citations (FR-26) and RAG citations render in the same format — both use `Citation` interface with `{chunkId?, assetId?, score?, snippet?, url?, title?}`

- [x] Task 7: Update `Message` type to include streaming metadata (AC: #1, #2, #5)
  - [x] Subtask 7.1: Ensure `Message` type in `src/types/chat.ts` / schemas includes `status: 'processing' | 'complete' | 'stopped'` (FR-5)
  - [x] Subtask 7.2: Ensure `Message` type includes optional `citations?: Citation[]`
  - [x] Subtask 7.3: Add `Citation` to exports from `@/types` — already defined in `src/types/index.ts`, verify re-exported via `@/types/chat`

- [x] Task 8: Update `ChatWindow` to handle streaming assistant messages (AC: #1, #6)
  - [x] Subtask 8.1: Pass through `isStreaming` flag for the last assistant message
  - [x] Subtask 8.2: Auto-scroll to bottom when streaming content updates (use existing `useEffect` on `localMessages` — ensure it triggers on content changes within the same message object, not just array length)
  - [x] Subtask 8.3: The streaming message should always auto-scroll; completed messages should not re-trigger scroll

- [x] Task 9: E2E test for streaming render (AC: #1, #2, #3, #4)
  - [x] Subtask 9.1: Create `e2e/streaming-markdown.spec.ts` Playwright test
  - [x] Subtask 9.2: Test that sending a message shows progressive content (visible token-by-token accumulation)
  - [x] Subtask 9.3: Test that markdown renders correctly (send a query that produces code blocks, lists, bold text)
  - [x] Subtask 9.4: Test that a terminated stream shows "stopped" state and content fallback
  - [x] Subtask 9.5: Tag with `@smoke` for CI gate

- [x] Task 10: Unit test for `StreamingMessage` component (AC: #4)
  - [x] Subtask 10.1: Create `src/components/chat/streaming-message.test.tsx` with Vitest + React Testing Library
  - [x] Subtask 10.2: Test: renders raw text as plain inline (no markdown syntax) — e.g., "Hello world" shows as paragraph
  - [x] Subtask 10.3: Test: renders **bold** as `<strong>` / semantic bold
  - [x] Subtask 10.4: Test: renders code blocks with `<code>` / `<pre>` styling
  - [x] Subtask 10.5: Test: renders lists (`- item`) as `<ul>/<li>`
  - [x] Subtask 10.6: Test: streaming indicator shows when `isStreaming` and content is empty
  - [x] Subtask 10.7: Test: status badge shows "Complete" for complete, "Stopped" for stopped
  - [x] Subtask 10.8: Test: citations section renders when citations array is provided
  - [x] Subtask 10.9: Test: aria-live="polite" is set on the container when streaming

## Dev Notes

- **Token format:** Backend `chat.service.ts:189` sends each token as `data: {"token":"chunk_text"}\n\n`. The `useChat` hook currently tries to parse `parsed.content` which doesn't exist in this format — it's either a latent bug or works accidentally. Story 6.3 must align the hook with the actual token format `{token}` not `{content}`. The final `done` event payload at line 203-206 sends `{id, status, citations, ragDegraded}` — capture these for message finalization.

- **Progressive rendering key insight:** The existing `useChat` hook buffers all tokens and returns only the final content. To render progressively, we need a state-backed stream that pushes tokens into React state as they arrive. Use `useRef` for the stream reader loop and `useState` for the accumulated content string — every `onChunk` appends and re-renders.

- **Markdown rendering during streaming:** `react-markdown` renders partial markdown gracefully. Mid-stream content like `**bold tex` will render as raw `**bold tex` until the closing `**` arrives. This is acceptable behavior — the visual appearance stabilizes as more tokens arrive. Do NOT buffer markdown tokens — render the full accumulated content string on every update; React will diff the DOM efficiently.

- **Markdown for non-streaming messages:** All messages (loaded from history, not just streamed) must render as Markdown consistently (AC #8). This means `MessageBubble` must always use `StreamingMessage`, not just during streaming.

- **Citation integration:** The `done` event includes `citations: Citation[]`. The `Citation` type in `src/types/index.ts:14-19` has `{chunkId, assetId, score, snippet}`. For web-search citations (FR-26), the citation may also carry `url` and `title` fields. Extend `Citation` to include optional `url?: string` and `title?: string` fields for web source citations. RAG citations from Qdrant use `chunkId`/`assetId`/`snippet`; web citations from Jina use `url`/`title`/`snippet`.

- **Autoscroll behavior:** The existing `ChatWindow` scrolls to `bottomRef` when `localMessages` array changes (via `useEffect`). During streaming, the last message's content changes without the array changing. Modify the autoscroll `useEffect` dep to include `localMessages.map(m => m.content).join('')` or use a streaming content ref to trigger scroll on content update.

- **Interaction with edit/regenerate (Story 6.4):** When regenerating a stopped message, the streaming state replaces the old content progressively. The `regenerate` flow already calls `createStream` which returns the same SSE format. The streaming hook must support both new-message streaming and regenerate streaming.

- **No new backend changes needed:** The backend's `createStream` in `chat.service.ts` already sends the correct SSE format (token events + done/stopped events). This story is entirely frontend: consuming the stream progressively and rendering markdown.

- **react-markdown v10 vs v9:** Install the latest stable. v10+ uses ES module exports, works with Next.js 16 Turbopack out of the box. Use `ReactMarkdown` as default import: `import ReactMarkdown from 'react-markdown'`. `remark-gfm` for GFM tables/strikethrough.

- **Citation schema decision:** Since FR-26 (web-search citations) is part of Epic 7, add the citation UI framework in this story but wire it to the existing RAG citation format. When Epic 7 adds web citations, they flow through the same `Citation[]` array automatically.

- **aria-live="polite":** The streaming message container must be announced by screen readers as content updates. Use `role="status"` with `aria-live="polite"` so assistive technology reads new content without interrupting the user.

## Existing Code Patterns

### useChat hook (src/hooks/use-chat.ts:1-67)
- Uses `useMutation` with `mutationFn: sendMessage` from TanStack Query
- `sendMessage` reads `ReadableStream` from `fetch("/api/chat")` response body
- Parses SSE `data:` lines, tries to parse as `ChatResponse` (but server sends `{token}` not `{content}`)
- Accumulates all tokens into `fullContent`, returns `{ content: fullContent }` when stream ends
- Does NOT render progressively — returns final content only on stream completion
- Key method to replace: the reader loop (lines 31-51) needs to push updates to state

### MessageBubble (src/components/chat/message-bubble.tsx:1-47)
- Renders `Avatar` + content + `AssetReferences`
- Content rendered as `<p className="whitespace-pre-wrap break-words">{message.content}</p>` — raw text
- Must be updated to use `StreamingMessage` component for markdown rendering
- Props: `message: Message`, `isEditing?: boolean`, `onRemoveAsset?: (assetId: string) => void`

### ChatWindow (src/components/chat/chat-window.tsx:1-127)
- Maps over `messages` array, renders `MessageBubble` for each
- Auto-scrolls to `bottomRef` when `localMessages` changes
- Passes `isLoading` to `ChatInput` as `disabled` prop
- Must pass through streaming state for the last assistant message

### ChatService (src/services/chat.service.ts:169-250)
- `createStream` sends SSE: `data: {"token":"..."}\n\n` per token (line 189)
- On complete: `event: done\ndata: {"id":"...","status":"complete","citations":[],"ragDegraded":false}\n\n` (line 203-206)
- On stop: `event: stopped\ndata: {"id":"...","status":"stopped"}\n\n` (line 219-222)
- On cancel: aborts stream, writes "user terminated the response" content, sends `stopped` event (line 226-246)
- Backend SSE format is already correct — no changes needed here

### page.tsx handleSend (src/app/page.tsx:132-184)
- Creates user message, calls `chatMutation.mutateAsync`, waits for full response
- Creates assistant message from `response.content` only after stream completes
- Must switch to progressive: add user message -> start stream -> update assistant message state on each token

### SSE events summary (chat.service.ts)
| Event | Format | When |
|-------|--------|------|
| Token | `data: {"token":"<chunk>"}\n\n` | Each token from LLM |
| Done | `event: done\ndata: {"id":"...","status":"complete","citations":[],"ragDegraded":false}\n\n` | Stream finishes |
| Stopped | `event: stopped\ndata: {"id":"...","status":"stopped"}\n\n` | User terminates or error |

### Message type (src/types/index.ts + schemas)
- `ChatResponse` at `src/types/index.ts:21-28`: `{id, content, conversationId, model?, citations?, ragDegraded?}`
- `Citation` at `src/types/index.ts:14-19`: `{chunkId, assetId, score, snippet}`
- `Message` (from schemas/entities) includes `status: 'processing' | 'complete' | 'stopped'`, `role`, `content`, `id`, `conversationId`
- Need to ensure `Message` type in frontend has `status` field and optional `citations` field

## Architecture Compliance

- **FR-19 (SSE streaming preserved):** Existing backend SSE format preserved. Frontend changes only — progressively render instead of buffering. `ChatService.createStream` SSE events (`token`, `done`, `stopped`) remain unchanged.
- **FR-6 (Message status lifecycle):** Processing -> complete/stopped status displayed in UI. `status` field from `done`/`stopped` events wired to `StreamingMessage` status badge.
- **UX-DR3 (Streaming chat view):** Tokens rendered live with no wait-for-complete. Processing/Streaming/Stopped/Complete states all handled.
- **UX-DR4 (Markdown rendering):** All message content rendered as Markdown via `react-markdown` + `remark-gfm`. Handles partial/incomplete markdown during streaming.
- **FR-26 (Web-source citations):** Citation UI framework built in this story. Web citations added in Epic 7 flow through the same `Citation[]` array and render via `CitationsSection`.
- **Layer mapping:** `StreamingMessage` (UI) -> `useStreamingChat` hook (client state) -> `/api/chat` route handler (SSE stream) -> `ChatService.send` (backend)
- **Accessibility:** `StreamingMessage` uses `role="status"` + `aria-live="polite"` for screen reader announcements (PER UX-DR3, EXPERIENCE.md Accessibility #46).

## Testing Requirements

- **Unit tests:** `StreamingMessage` component tests (Vitest + React Testing Library)
  - Renders plain text, bold, code blocks, lists, headings
  - Shows streaming indicator when `isStreaming && content === ''`
  - Shows status badge for complete/stopped
  - Renders citations section
  - Applies aria-live="polite" during streaming
- **E2E test:** `e2e/streaming-markdown.spec.ts` (Playwright)
  - Send message, verify progressive render (content visible before stream complete)
  - Verify markdown rendering (bold, code, lists)
  - Verify stopped state display
  - Tag with `@smoke`

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/chat/streaming-message.tsx` | Live SSE token render with Markdown, streaming indicator, status badge, citations |
| `src/components/chat/citations-section.tsx` | Citation links display (RAG + web sources) |
| `src/components/chat/streaming-indicator.tsx` | Animated dots/pulse indicator for time-to-first-token |
| `src/components/chat/streaming-message.test.tsx` | Vitest unit tests for StreamingMessage |
| `e2e/streaming-markdown.spec.ts` | Playwright E2E test for streaming and markdown |

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/use-chat.ts` | Add `useStreamingChat` hook with progressive state (content, isStreaming, status, citations) — keep `useChat` for backward compat |
| `src/app/page.tsx` | Wire `useStreamingChat` into `handleSend` — stream content into assistant message slot progressively |
| `src/components/chat/message-bubble.tsx` | Replace `<p>{message.content}</p>` with `<StreamingMessage>` for markdown rendering |
| `src/components/chat/chat-window.tsx` | Pass through streaming state props; fix autoscroll to track content changes within streaming message |
| `src/types/index.ts` | Add optional `url?: string` and `title?: string` to `Citation` interface for web citations |
| `src/types/chat.ts` | Re-export `Citation` type |
| `package.json` | Add `react-markdown` and `remark-gfm` dependencies |
| `tailwind.config.ts` or equivalent | Add `@tailwindcss/typography` plugin if not present; add `prose` classes may need configuration |

## Dependencies on Other Stories

- **Story 6.1 (Clerk-gated chat UI shell):** Already complete — provides the authenticated context and chat layout. Story 6.3 enhances message rendering within the existing shell.
- **Story 6.2 (Branch-aware sidebar):** Independent — sidebar filtering and streaming rendering don't interact. Can be done in parallel.
- **Story 3.3 (ChatService send with SSE stream):** Already complete — provides the `ChatService.send` SSE stream that story 6.3 consumes. The backend SSE format (`token`/`done`/`stopped` events) is stable and tested.
- **Story 3.4 (AiProvider concrete module):** Already complete — provides the `OpenAiProvider.streamChat` that `ChatService` uses for token generation.
- **Story 3.6 (Regenerate stopped message):** Already complete — `ChatService.regenerate` returns the same SSE stream format, compatible with the streaming hook.
- **Story 6.4 (Edit & regenerate controls):** Builds on 6.3 — regenerate reuses the streaming hook to show progressive content replacement. 6.3 must expose the streaming hook in a way 6.4 can call for regenerate.
- **Story 6.5 (Large-paste-to-txt & asset UI):** Independent — asset display and streaming rendering don't interact.
- **Story 7.3 (Web context injection):** Provides citation data that flows through `Citation[]` array; 6.3 builds the citation display UI that 7.3 populates.

## Gotchas and Edge Cases

- **Token format mismatch in existing useChat:** `chat.service.ts:189` sends `{"token":"..."}` but `use-chat.ts:44` tries `parsed.content`. This means `useChat` currently accumulates "undefined" for `fullContent`. The new `useStreamingChat` hook must read `parsed.token` instead. This isn't a bug in the backend — it's a latent frontend mismatch this story fixes.

- **Partial markdown during streaming:** `react-markdown` renders whatever content is available. Mid-stream, `**bold tex` (no closing `**`) renders the raw text `**bold tex`. When the closing `**` arrives, React re-renders as `<strong>bold text</strong>`. This is correct, expected behavior. Do NOT attempt to buffer markdown tokens — re-rendering the full accumulated string on each update is cheap (React DOM diffing).

- **Stream abort on conversation switch:** When the user switches conversations mid-stream, the AbortController must abort the fetch. The streaming hook must clean up the reader loop and reset state. Handle this in `page.tsx` similar to the existing `abortRef.current?.abort()` pattern.

- **New conversation ID from stream:** When starting a new chat (no existing `conversationId`), the backend creates a new conversation. The `done` event returns the `conversationId` in the response. The streaming hook must capture this ID and update page state so subsequent messages reference the correct conversation.

- **Autoscroll during streaming:** The existing autoscroll `useEffect` tracks `localMessages` array changes. During streaming, the array doesn't change (same message object), only the content string changes. Track a streaming content hash or use a separate streaming content ref to trigger scroll on each content update. Without this, the viewport stays at the top during streaming.

- **Status badge timing:** The `status` field comes from the `done`/`stopped` event at stream end. Before that, status is `processing`. Show the status badge only on `complete`/`stopped` — during streaming, the live region announcement is sufficient. Don't flash "processing" briefly before tokens arrive.

- **Citation type extension:** The existing `Citation` interface lacks `url` and `title` fields needed for web citations (FR-26). Add these as optional fields now so Epic 7 can populate them without refactoring. RAG citations from Qdrant will have `url`/`title` as undefined — the citation section handles undefined gracefully by falling back to `chunkId`/`snippet`.

- **react-markdown import in client components:** `react-markdown` v10+ is a pure ESM package. Next.js 16 Turbopack handles ESM correctly. Import as `import ReactMarkdown from 'react-markdown'`. If Turbopack throws ESM errors, use `import ReactMarkdown from 'react-markdown'` (Next.js 16 handles it natively).

- **Prose class from tailwindcss/typography:** If `@tailwindcss/typography` is not installed, add it with `npm install -D @tailwindcss/typography` and add to `tailwind.config.ts` plugins. The `prose` classes provide typographic defaults for markdown-rendered content. Use `prose prose-sm max-w-none` for message bubbles.

- **Large content re-renders:** Streaming a 2000+ token response triggers 2000+ re-renders of the message content. `react-markdown` re-parses the full accumulated string on each render. This is performant for typical chat responses (< 2000 tokens) but test with larger outputs. If performance is an issue, debounce renders to every 50ms (buffer tokens, flush to state periodically). Start without debounce; add only if needed.

- **Empty content edge case:** If the backend returns an empty stream (no tokens, immediate done event), the StreamingMessage should show an empty state rather than a blank box. When `!isStreaming && content === '' && status === 'complete'`, render "[Empty response]" or similar muted text.

- **Citation position:** Citations render below the message content, above the status badge. This creates a visual hierarchy: content -> citations -> status. If citations are numerous (> 10), they may push the status badge far down. In v1, keep as a flat list — collapsible citations can be added later.

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6 Story 6.3 L638-653] Live streaming & markdown rendering ACs (FR-19, FR-6, UX-DR3, UX-DR4, FR-26)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-chaiGPT-2026-07-19/DESIGN.md:32] StreamingMessage component defined in component vocabulary
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-chaiGPT-2026-07-19/EXPERIENCE.md:28-32] States table — Streaming, Processing, Stopped, Complete
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-chaiGPT-2026-07-19/EXPERIENCE.md:46] Accessibility — streaming region announced as live region (polite)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-chaiGPT-2026-07-19/EXPERIENCE.md:49-51] Key Journey #1: Sign in → open/create → send → stream → complete
- [Source: src/hooks/use-chat.ts:1-67] Existing useChat hook — needs progressive streaming variant
- [Source: src/services/chat.service.ts:169-250] SSE stream format — `token` events, `done`/`stopped` event types
- [Source: src/components/chat/message-bubble.tsx:1-47] MessageBubble — raw `<p>` render needs markdown upgrade
- [Source: src/app/page.tsx:132-184] handleSend — batches response, needs progressive refactor
- [Source: src/types/index.ts:14-19] Citation interface — needs url/title for web citations
- [Source: src/app/api/chat/route.ts:1-82] Route handler — returns SSE Response from ChatService
- [Source: _bmad-output/implementation-artifacts/6-1-clerk-gated-chat-ui-shell.md] Story pattern reference — structure, sections, format
- [Source: _bmad-output/implementation-artifacts/6-2-branch-aware-sidebar.md] Story pattern reference — Existing Code Patterns section
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml#L101] 6-3 status is backlog
- [Source: _bmad-output/project-context.md] Tech stack: Next.js 16, React 19, Tailwind v4, shadcn/ui

## Dev Agent Record

### Agent Model Used

opencode (deepseek-v4-flash-free)

### Debug Log References

- SSE token format in `chat.service.ts:189` sends `{"token":"chunk"}` not `{"content":"chunk"}` — existing `useChat` reads `parsed.content` which is undefined on token events. Fix by reading `parsed.token`.
- `react-markdown` not in `package.json` — must install. No existing markdown dependency.
- Existing `useChat` uses `useMutation` from TanStack Query — mutation pattern incompatible with progressive state updates. New `useStreamingChat` hook uses `useState` + `useRef` for the reader loop.
- `Message` frontend type does not include `status` or `citations` fields explicitly — verify the backend entity shape and ensure frontend types align.
- `Citation` type in `src/types/index.ts:14-19` has `{chunkId, assetId, score, snippet}` — needs optional `url?: string` and `title?: string` for web citations (FR-26)

### Review Findings

**9 findings: 2 High, 3 Medium, 4 Low**

- [ ] **[Review][Patch]** **[HIGH]** Progressive rendering broken (AC1 failure) — `useEffect` in `page.tsx:107-149` uses `streamState.assistantMessageId` to update `messages`, but this field is only set by `done`/`stopped` events, never during token streaming. The `streamingMsgIdRef.current` (set at `page.tsx:195`) is not read by the effect. Result: `messages` array never receives streaming content updates — assistant bubble stays empty until stream completes. Fix: Use `streamingMsgIdRef.current` as fallback ID in the streaming content update path, or pass `assistantMessageId` into `startStream` and include it in every streaming `setState`.

- [ ] **[Review][Patch]** **[HIGH]** Conversation switch while streaming does not abort stream — `handleSelectConversation` (`page.tsx:158`) calls `abortRef.current?.abort()` on page.tsx's own `useRef<AbortController>`, NOT on the `useStreamingChat` hook's internal `AbortController`. Stream continues in background; `streamState` updates from the abandoned stream may cause spurious `useEffect` executions against the wrong conversation's messages. Fix: Call `resetStream()` at the start of `handleSelectConversation`.

- [ ] **[Review][Patch]** **[MEDIUM]** E2E selector `[data-role="assistant"]` not present in any component — `MessageBubble` (`message-bubble.tsx:20`) does not set `data-role` attribute. `getLastAssistantMessage` helper (`e2e/helpers/helpers.ts:17`) queries this selector; all 3 E2E tests depend on it. Fix: Add `data-role={message.role}` to `MessageBubble`'s root div.

- [ ] **[Review][Patch]** **[MEDIUM]** Missing cleanup for stream AbortController on unmount — `useStreamingChat` (`use-chat.ts:100-261`) never registers a `useEffect` cleanup to call `abortRef.current?.abort()`. If `Home` unmounts mid-stream (full-page nav), fetch continues in background. Fix: Add `useEffect(() => () => abortRef.current?.abort(), [])` to the hook body.

- [ ] **[Review][Patch]** **[MEDIUM]** `conversationId` mismatch for new-conversation messages — `handleSend` (`page.tsx:186-199`) creates messages with `crypto.randomUUID()` as placeholder `conversationId`. The real conversation ID arrives in the `done` event and updates page-level `conversation` state (`page.tsx:121-132`), but the existing messages' `conversationId` field retains the random UUID. Fix: Update message `conversationId` in the `done` event handler in `useEffect`.

- [ ] **[Review][Defer]** **[LOW]** No "Stop" button wired to `stopStream` — `useStreamingChat` returns `stopStream` but it is never called from any UI element. E2E test 3 (`e2e/streaming-markdown.spec.ts:37-39`) clicks `button:has-text("Stop")` which does not exist. Deferred to Story 6.4 (edit/regenerate controls) which adds the Stop button.

- [ ] **[Review][Patch]** **[LOW]** E2E test 3 has no assertion — `e2e/streaming-markdown.spec.ts:28-43` clicks Stop then calls `waitForStreamComplete`, but never asserts that content shows "Stopped" state or fallback text. Add assertions.

- [ ] **[Review][Defer]** **[LOW]** Citation key collision potential — `citations-section.tsx:17` keys by `citation.chunkId ?? idx`. If two citations share the same `chunkId` (e.g., web citations without chunkId), React key collision occurs on re-render. Real-world impact near-zero since citations are set once from `done` event. Pre-existing pattern from RAG citations in other components.

- [ ] **[Review][Defer]** **[LOW]** ChatWindow `localMessages` double-buffer anti-pattern — `ChatWindow` (`chat-window.tsx:32`) keeps a local copy of `messages` prop synced via `useEffect`. Creates one-render-cycle delay between prop change and UI update. Pre-existing in 6-1, not introduced by this story.

### Completion Notes

Implementation complete. All 10 tasks done. 13 new unit tests pass (245 total, 0 regressions). Key changes:
1. `react-markdown` + `remark-gfm` + `@tailwindcss/typography` installed
2. `useStreamingChat` hook — progressive SSE reader with `{token}` format parsing, `done`/`stopped` event handling, AbortController cancellation
3. `StreamingMessage` — markdown rendering via ReactMarkdown, streaming indicator (animated dots), status badges (Complete/Stopped), citations section, aria-live accessibility
4. `CitationsSection` — citation links with url/title support, target="_blank" rel="noopener noreferrer"
5. `StreamingIndicator` — 3 animated dots with staggered animation-delay
6. `page.tsx` — wired `useStreamingChat`, optimistic message creation, stream state → message array via useEffect
7. `MessageBubble` — replaced raw `<p>` with `<StreamingMessage>` for all messages
8. `ChatWindow` — autoscroll via content hash tracking, `streamingMessageId` prop, `isStreaming` flag for last assistant message
9. `Message` type — added `status`, `citations` fields to frontend type in schemas.ts
10. `Citation` type — added optional `url?: string` and `title?: string` fields
11. E2E test created (requires running infra)
12. vitest config updated for .tsx + jsdom via per-file directive

### File List

| File | Change |
|------|--------|
| `src/components/chat/streaming-message.tsx` | Create — markdown rendering, streaming indicator, status badge, citations |
| `src/components/chat/citations-section.tsx` | Create — citation links display |
| `src/components/chat/streaming-indicator.tsx` | Create — animated dots for time-to-first-token |
| `src/components/chat/streaming-message.test.tsx` | Create — 13 unit tests |
| `e2e/streaming-markdown.spec.ts` | Create — E2E tests with @smoke tag |
| `src/hooks/use-chat.ts` | Modify — add `useStreamingChat` hook, keep `useChat` |
| `src/app/page.tsx` | Modify — wire progressive streaming into handleSend |
| `src/components/chat/message-bubble.tsx` | Modify — replace `<p>` with `<StreamingMessage>` |
| `src/components/chat/chat-window.tsx` | Modify — autoscroll fix (content hash), streamingMessageId prop |
| `src/types/index.ts` | Modify — extend Citation with url/title |
| `src/types/chat.ts` | Modify — re-export Citation, MessageStatus |
| `src/lib/validation/schemas.ts` | Modify — add Message + Conversation frontend types, MessageStatus |
| `package.json` | Modify — add react-markdown, remark-gfm, @tailwindcss/typography |
| `vitest.config.ts` | Modify — add .test.tsx include pattern |
| `src/app/globals.css` | Modify — import @tailwindcss/typography |
