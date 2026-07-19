---
title: chaiGPT UX Design — DESIGN
status: draft
created: 2026-07-19
updated: 2026-07-19
spine: design
based_on:
  - briefs/brief-chaiGPT-2026-07-15/brief.md
  - epics.md (E6, UX-DR1..UX-DR8)
paired_with: EXPERIENCE.md
---

# chaiGPT — UX Design (DESIGN spine)

Visual identity, design tokens, and component vocabulary for the branch-aware chat UI. This is the DESIGN half of the bmad-ux spine; behavior/states/journeys live in `EXPERIENCE.md`.

> STATUS: Scaffold. To be populated from UX-DR1..UX-DR8 and the existing flat chat UI shell (the only retained part of the legacy repo — see epics.md E2 "Existing repo note"). NFR-3 states no custom design system for v1, so this reuses the established Tailwind v4 + shadcn/ui (Radix) stack from project-context.md.

## Design Tokens (inherit from project-context.md)

- Tailwind CSS v4 with CSS variables
- shadcn/ui (Base / Radix) primitives
- Lucide React icons
- clsx + tailwind-merge for class composition

## Component Vocabulary (proposed, to confirm)

| Component | Purpose | Source UX-DR |
|-----------|---------|--------------|
| ChatShell | Clerk-gated layout (sidebar + composer) | UX-DR1 |
| BranchSidebar | Shows only sibling branches of active branch | UX-DR2 |
| StreamingMessage | Live SSE token render + Markdown | UX-DR3, UX-DR4 |
| PasteToAssetInput | Converts >200-char paste to .txt asset | UX-DR5 |
| MessageControls | edit-latest + regenerate (stopped) | UX-DR6 |
| AssetReference | trailing assistant asset refs, remove-in-edit | UX-DR7 |
| AssetPanel | upload / view preserved / explicit delete | UX-DR8 |

## Next

Populate token values, component specs, and accessibility notes, then align with `EXPERIENCE.md`.
