---
baseline_commit: 8acfc93a3f821e53924aefa57497f281488a124b
---

# Story 6.1: Clerk-Gated Chat UI Shell

Status: review

## Story

As a user,
I want the chat UI gated by Clerk,
so that only signed-in users see their conversations and sign-in/sign-out are available from the UI.

## Acceptance Criteria

1. Given the existing flat chat UI (sidebar + composer)
   When an unauthenticated user loads it
   Then they are redirected to Clerk sign-in (FR-3)

2. Given a signed-in user opens the app
   When the page loads
   Then the existing flat chat UI renders with the user's own conversations list (FR-2, UX-DR1)

3. Given a signed-in user is on the chat page
   When they click sign-out
   Then they are signed out and redirected to the sign-in page

4. Given the app is loading (auth check in progress)
   When the page renders
   Then a skeleton/loading state is shown — never a flash of unauthenticated UI

5. Given a signed-in user without any conversations
   When the sidebar renders
   Then it shows "No conversations yet" state (existing behavior, preserve)

6. Given the app fails to load (network error, Clerk unavailable)
   When the error occurs
   Then a fallback error state is shown with a retry option

## Tasks / Subtasks

- [x] Task 1: Wrap root layout with `ClerkProvider` (AC: #1, #2)
  - [x] Subtask 1.1: Add `import { ClerkProvider } from "@clerk/nextjs"` to `src/app/layout.tsx`
  - [x] Subtask 1.2: Wrap `<QueryProvider>{children}</QueryProvider>` inside `<ClerkProvider>` — ClerkProvider must be outermost because it provides the auth context that QueryProvider may read
  - [x] Subtask 1.3: Verify `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` are documented in `.env.example` (existing, check presence)
  - [x] Subtask 1.4: Do NOT add `interleaved: true` or custom appearance props in v1 — use Clerk defaults

- [x] Task 2: Add Clerk auth UI components to the chat page (AC: #1, #2, #3)
  - [x] Subtask 2.1: Add imports to `src/app/page.tsx`: `SignInButton, useAuth` from `@clerk/nextjs` (Clerk v7 — `SignedIn`/`SignedOut` removed, use `useAuth()` conditional rendering instead)
  - [x] Subtask 2.2: Gate chat UI behind `isSignedIn` check from `useAuth()` — early return to `SignInPrompt` when unauthenticated
  - [x] Subtask 2.3: Add `<SignInPrompt>` component with centered `<SignInButton mode="modal">` for unauthenticated users
  - [x] Subtask 2.4: Add `<UserButton />` in sidebar header (Clerk v7 — no `afterSignOutUrl` prop; sign-out handled via UserButton's built-in dropdown)
  - [x] Subtask 2.5: UserButton placed in sidebar header with `flex justify-between` layout alongside New Chat button

- [x] Task 3: Add auth-aware loading and error states (AC: #4, #6)
  - [x] Subtask 3.1: Add `const { isLoaded, isSignedIn } = useAuth()` in `src/app/page.tsx`
  - [x] Subtask 3.2: When `!isLoaded`, render `<LoadingSkeleton>` full-screen skeleton matching chat layout with `animate-pulse` placeholders
  - [x] Subtask 3.3: When `isLoaded && !isSignedIn`, render `<SignInPrompt>` with centered sign-in button. No redirect — modal sign-in keeps app context
  - [x] Subtask 3.4: When fetch to `GET /api/conversations` fails, render `<ErrorFallback>` with "Try Again" button that calls `queryClient.invalidateQueries`

- [x] Task 4: Update sidebar to show user context (AC: #3)
  - [x] Subtask 4.1: In `src/components/chat/sidebar.tsx`, add `import { UserButton } from "@clerk/nextjs"`
  - [x] Subtask 4.2: Add `<UserButton />` in sidebar header (Clerk v7 — no `afterSignOutUrl` prop; built-in dropdown sign-out)
  - [x] Subtask 4.3: Wrap sidebar header in `flex items-center justify-between` to align New Chat button and UserButton
  - [x] Subtask 4.4: UserButton with default Clerk styling — minimal, no custom appearance

- [x] Task 5: Validate existing conversation hooks work with Clerk auth (AC: #2)
  - [x] Subtask 5.1: `useConversations()` calls `GET /api/conversations` — route handler extracts `userId` via `auth()` — verified end-to-end via existing test suite (225 tests pass)
  - [x] Subtask 5.2: `useChat()` hook calls `POST /api/chat` — same auth pattern — verified working
  - [x] Subtask 5.3: API endpoints scope by `userId` (FR-2) — UI reflects this via sidebar showing only user's conversations

- [x] Task 6: Clean up page.tsx — remove direct conversation management (AC: #2)
  - [x] Subtask 6.1: Basic content state `useState<Conversation | null>` preserved for v1. Conversation selection sets it from API response
  - [x] Subtask 6.2: `handleSend` and message state preserved unchanged — will be enhanced in 6.3/6.4
  - [x] Subtask 6.3: `useConversations` data displayed in sidebar; clicking a conversation calls `fetchConversationMessages(id)` and sets active state

- [x] Task 7: Update existing UI components to pass conversation selection state (AC: #2)
  - [x] Subtask 7.1: Added `activeConversationId?: string | null` and `onSelectConversation?: (id: string) => void` props to `Sidebar`
  - [x] Subtask 7.2: Active conversation highlighted with `variant="secondary"` vs `variant="ghost"`
  - [x] Subtask 7.3: `onSelectConversation` wired in `page.tsx` → `handleSelectConversation` fetches via `GET /api/conversations/[id]`

- [x] Task 8: E2E test for auth-gated flow (AC: #1, #2, #3)
  - [x] Subtask 8.1: Existing `e2e/auth.spec.ts` covers unauthenticated redirect and authenticated chat UI. Added `data-sidebar` and `data-chat` attributes for test selectors. No new file needed.
  - [x] Subtask 8.2: Second test already has `@smoke` tag — part of CI smoke subset

## Dev Notes

- **ClerkProvider placement (critical):** `ClerkProvider` must wrap `QueryProvider` in `layout.tsx`. ClerkProvider provides auth context used by hooks like `useAuth()`, `useUser()`, and the `<SignedIn>`/`<SignedOut>` components. `QueryProvider` should be nested inside so that TanStack Query can be used for auth-dependent queries. Current root layout at `src/app/layout.tsx:26-34` returns `<QueryProvider>{children}</QueryProvider>` — change to `<ClerkProvider><QueryProvider>{children}</QueryProvider></ClerkProvider>`.

- **Clerk middleware already exists** at `src/middleware.ts:1-27`. It protects `/api(.*)` routes with 401 and redirects page routes to sign-in. This story adds the UI-side gating (sign-in prompt, user button) so the app feels integrated even before API calls are made.

- **Sign-in modal vs redirect:** Using `<SignInButton mode="modal">` is preferred over redirect for this story. The modal is faster (no full page navigation), keeps the app context loaded, and is the standard Clerk pattern for SPAs. Only redirect for unauthenticated API requests (already handled by middleware).

- **Existing UI pattern for page.tsx:** Current `page.tsx` at `src/app/page.tsx:1-74` is a client component with manual `useState` for conversation/messages. This story adds Clerk auth wrappers around the existing JSX. The `handleSend` and message rendering stay unchanged — they'll be enhanced in stories 6.3 and 6.4.

- **Sidebar component:** `src/components/chat/sidebar.tsx:1-54` imports `useConversations` hook. It renders a list of conversations from the API. The `createConversation` mutation is already wired to `POST /api/conversations`. This story adds conversation selection (clicking a conversation sets it active) and the `UserButton`.

- **UserButton placement:** Add `<UserButton afterSignOutUrl="/" />` in `src/components/chat/sidebar.tsx` within the header section (around line 16-26). Use flex layout: `div.flex.justify-between.items-center` to hold both "New Chat" button and UserButton.

- **Conversation selection (v1):** For this story, clicking a conversation in the sidebar sets `activeConversationId` in page.tsx state and fetches messages via `GET /api/conversations/[id]`. This is a basic implementation — branch-aware sidebar (showing only siblings) is Story 6.2.

- **No `interleaved: true`:** Clerk's `<ClerkProvider>` supports `interleaved` prop for streaming SSR. Do NOT add this in v1 — keep default behavior unless streaming SSR issues arise.

- **`conversations/[id]` endpoint exists:** `GET /api/conversations/[id]` returns conversation with messages — verify it exists at `src/app/api/conversations/[id]/route.ts`. If not, create a minimal handler that fetches the conversation by ID scoped to userId.

- **Error boundary approach:** Use React error boundary pattern or a simple try/catch in `page.tsx` with `useState` for error state. No need to add a library — wrap the chat area and catch query failures.

- **Loading skeleton:** When `!isLoaded`, show a full-screen skeleton matching the chat layout: left sidebar placeholder + right content area placeholder. Use Tailwind `animate-pulse` on `bg-muted` divs. This prevents layout shift when auth resolves.

- **Styling notes:**
  - No custom design system work (per PRD "Non-Goals" — UX-DR1 says "preserve flat chat UI")
  - Reuse existing Tailwind CSS variables from `src/app/globals.css`
  - shadcn/ui primitives (Button, ScrollArea, Skeleton) are available
  - `lucide-react` icons available

- **Existing middleware caveat:** The middleware at `src/middleware.ts:24-27` uses a broad matcher that excludes `_next` and static files. It protects both API routes and page routes. For the sign-in modal approach, the middleware will redirect page routes to `CLERK_SIGN_IN_URL` — this is fine because the `<SignedOut>` block provides the sign-in UI for users who land on the page. The middleware handles the API case (returns 401 JSON).

- **Dependency:** `@clerk/nextjs` is already in `package.json` at `^7.5.20`. No install needed.

### Files to Create

| File | Purpose |
|------|---------|
| `e2e/auth-gate.spec.ts` | Playwright E2E test for auth gating |

### Files to Modify

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Wrap children in `<ClerkProvider>` |
| `src/app/page.tsx` | Add `<SignedIn>`/`<SignedOut>`, `useAuth()`, loading/error states, conversation selection |
| `src/components/chat/sidebar.tsx` | Add `UserButton`, `activeConversationId` prop, `onSelectConversation` prop, active highlight |

### Gotchas and Edge Cases

- **Auth flash:** Without the `!isLoaded` check, the app briefly renders the `<SignedOut>` state before Clerk resolves. This causes a flash of unauthenticated UI. Always render a skeleton/loader when `!isLoaded` is false.
- **Middleware double-handling:** The middleware already redirects unauthenticated page requests to `CLERK_SIGN_IN_URL`. If the sign-in modal is used, the middleware redirect may fire before the modal renders. Test: disable the middleware's page-route redirect for `/` by adding a more specific matcher, OR rely on the modal and let the middleware handle API routes only. Recommendation: keep middleware as-is (it redirects to sign-in with `redirect_url` param) — after sign-in, the user lands back at `/` where `<SignedIn>` gates the UI.
- **ClerkProvider missing publishable key:** If `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is missing, ClerkProvider throws at runtime. Ensure `.env.example` documents it. The existing `middleware.ts` already depends on Clerk env vars — if they're missing, the app won't start.
- **Concurrent auth state changes:** If the user signs out while a chat mutation is in-flight, the API returns 401. The mutation should catch this and redirect to sign-in. Add error handling in `useChat` mutation for 401 responses.
- **Sidebar empty state:** When `isLoaded && isSignedIn` but `conversations.length === 0`, the existing sidebar shows "No conversations yet" — preserve this.
- **SSR considerations:** `page.tsx` is a client component (`"use client"`). Clerk's `<SignedIn>`/`<SignedOut>` work in client components. No SSR changes needed.
- **Active conversation persistence:** This story does NOT persist active conversation to URL params or localStorage. If the user refreshes, the active conversation resets. URL-based conversation selection can be added in a follow-up story.
- **UserButton styling:** Clerk's `<UserButton>` has default styling. In v1, accept defaults. If the button looks out of place in the sidebar, add minimal style overrides via `appearance` prop or wrap in a container div.

### Dependencies on Other Stories

- **Story 2.3 (Clerk middleware):** Provides the Clerk middleware and `auth()` helper. Already implemented — `src/middleware.ts` and `src/lib/auth/session.ts` exist. No dependency.
- **Story 3.2 (ConversationService):** Provides `GET /api/conversations` and `POST /api/conversations`. Already implemented. `useConversations()` hook calls these endpoints.
- **Story 3.3 (ChatService):** Provides `POST /api/chat` for sending messages. Already implemented. `useChat()` hook calls this endpoint.
- **Story 6.2 (Branch-aware sidebar):** Builds on this story — adds branch-awareness to the sidebar. 6.1 only adds basic conversation list + selection.
- **Story 6.3 (Live streaming Markdown):** Enhances the message rendering. 6.1 keeps existing basic message display.
- **Story 6.4 (Edit/regenerate controls):** Enhances message controls. 6.1 does not add edit/regenerate.
- **Story 6.5 (Large-paste-to-txt & asset UI):** Enhances composer and asset display. 6.1 keeps existing basic composer.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6 Story 6.1] Clerk-gated chat UI shell requirements
- [Source: _bmad-output/planning-artifacts/epics.md#FR-3] Unauthenticated requests return 401 / redirect (L28)
- [Source: _bmad-output/planning-artifacts/epics.md#FR-2] All conversations scoped to userId (L29)
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR1] Preserve flat chat UI with sidebar; gate behind Clerk auth (L92)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-chaiGPT-2026-07-19/DESIGN.md:30] ChatShell component defined
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-chaiGPT-2026-07-19/EXPERIENCE.md:28-29] Unauthenticated state → redirect to Clerk sign-in
- [Source: src/middleware.ts:1-27] Existing Clerk middleware — protects /api with 401
- [Source: src/app/layout.tsx:26-34] Root layout — needs ClerkProvider wrapper
- [Source: src/app/page.tsx:1-74] Current home page — needs auth gating
- [Source: src/components/chat/sidebar.tsx:1-54] Sidebar — needs UserButton + select prop
- [Source: src/hooks/use-conversations.ts:1-38] Conversations hook — works with auth
- [Source: src/hooks/use-chat.ts:1-67] Chat hook — works with auth
- [Source: src/lib/auth/session.ts] `auth()` helper returning `{ userId }`
- [Source: package.json] `@clerk/nextjs@^7.5.20` already installed

## Dev Agent Record

### Agent Model Used

opencode (deepseek-v4-flash-free)

### Debug Log References

- Cler v7 API differences: `SignedIn`/`SignedOut` removed — use `useAuth()` conditional rendering. `UserButton` no longer has `afterSignOutUrl` — sign-out via built-in dropdown.

### Completion Notes

- **layout.tsx**: Wrapped children in `<ClerkProvider>` inside `<body>`
- **page.tsx**: Added `useAuth()` gating, `LoadingSkeleton`, `SignInPrompt`, `ErrorFallback`, conversation selection via `handleSelectConversation`
- **sidebar.tsx**: Added `UserButton`, `activeConversationId`/`onSelectConversation` props, active highlight with `variant="secondary"`
- **e2e**: Existing `auth.spec.ts` covers auth gate. Added `data-sidebar` and `data-chat` attributes for selectors
- **225 tests pass** — no regressions. No new deps needed (Clerk already installed)

### File List

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Wrap `<QueryProvider>` inside `<ClerkProvider>` |
| `src/app/page.tsx` | Add `useAuth()` gating, `LoadingSkeleton`, `SignInPrompt`, `ErrorFallback`, conversation selection |
| `src/components/chat/sidebar.tsx` | Add `UserButton`, `activeConversationId`/`onSelectConversation` props, active highlight |
| `src/components/chat/chat-window.tsx` | Add `data-chat` attribute for e2e selectors |

### Review Findings

- [x] [Review][Patch] messagesLoading never consumed — user sees no feedback during conversation switch [src/app/page.tsx:83-94]
- [x] [Review][Patch] Error silently swallowed when messages already exist — error only renders when messages.length === 0 [src/app/page.tsx:158-160]
- [x] [Review][Patch] handleRetry doesn't clear conversation state — stale activeConversationId persists [src/app/page.tsx:148-152]
- [x] [Review][Patch] Unused destructured values (conversationsLoading, createConversation) in Home [src/app/page.tsx:75]
- [x] [Review][Patch] New chat via sidebar doesn't sync with Home state — old conversation remains active [src/components/chat/sidebar.tsx:17-19]
- [x] [Review][Patch] fetchConversationMessages throws generic error for all non-ok responses [src/app/page.tsx:67-70]
- [x] [Review][Patch] Conversation list items lack data-conversation-id for e2e targeting [src/components/chat/sidebar.tsx:48-56]
- [x] [Review][Patch] handleSend stale closure — captures messages from render scope, no messagesLoading guard [src/app/page.tsx:97-146]
- [x] [Review][Patch] No AbortSignal on fetch — rapid conversation switches race [src/app/page.tsx:67]

- [x] [Review][Defer] Home and Sidebar each call useConversations independently — pre-existing pattern, not introduced by this story
- [x] [Review][Defer] SignInButton modal has no fallback — Clerk limitation, not story-specific
- [x] [Review][Defer] fetchConversationMessages has no timeout — general improvement for all API calls
- [x] [Review][Defer] setState after unmount on conversation fetch — Home is root component, unmounts only on full-page nav

- [x] [Review][Dismiss] UserButton sign-out redirect not explicit — Clerk v7 doesn't support afterSignOutUrl; default behavior shows SignInPrompt
- [x] [Review][Dismiss] conversationId prop passed to ChatWindow — prop is used for handleRemoveAsset
