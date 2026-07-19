---
title: chaiGPT UX Design — EXPERIENCE
status: draft
created: 2026-07-19
updated: 2026-07-19
spine: experience
based_on:
  - briefs/brief-chaiGPT-2026-07-15/brief.md
  - epics.md (E6, UX-DR1..UX-DR8)
paired_with: DESIGN.md
---

# chaiGPT — UX Experience (EXPERIENCE spine)

Information architecture, states, interactions, accessibility, and key journeys for the branch-aware chat UI. Behavior half of the bmad-ux spine; visual tokens live in `DESIGN.md`.

> STATUS: Scaffold. Populate from UX-DR1..UX-DR8 and the existing flat chat UI shell.

## Information Architecture

- `ChatShell` (Clerk-gated) contains `BranchSidebar` + conversation pane + `PasteToAssetInput` composer.
- Conversation pane lists messages; each assistant message may carry `AssetReference`(s) and `MessageControls`.

## States

| State | Trigger | UI behavior |
|-------|---------|-------------|
| Unauthenticated | load without session | redirect to Clerk sign-in (UX-DR1, FR-3) |
| Streaming | SSE in flight | tokens append live, Markdown-rendered (UX-DR3/4, FR-19) |
| Processing | assistant msg created | status badge `processing` (FR-6) |
| Stopped | user terminated | content "user terminated the response"; regenerate control shown (FR-6, FR-18) |
| Complete | stream done | final Markdown render (FR-6) |
| Edit mode | user edits latest | trailing asset refs visible w/ remove (UX-DR7, FR-17) |

## Interactions

- Branch from any assistant message → sibling under same parent; sidebar shows only siblings (UX-DR2, FR-8/FR-9).
- Edit only most-recent user message; earlier disabled (UX-DR6, FR-10/FR-11).
- Paste >200 chars → auto `.txt` asset (UX-DR5, FR-7).
- Asset lifecycle: upload, view preserved-in-deleted-reply, explicit delete (UX-DR8, FR-12/FR-16).

## Accessibility

- Keyboard-operable composer + controls; focus order sidebar → pane → composer.
- Sufficient contrast per Tailwind/shadcn defaults; ARIA labels on asset/branch controls.
- Streaming region announced as live region (polite).

## Key Journeys

1. Sign in → open/create conversation → send → stream → complete.
2. Branch from assistant reply → explore sibling → edit latest → regenerate.
3. Upload PDF → ask question → cited RAG answer (top-3 per conversation).
