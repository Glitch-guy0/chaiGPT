# UX Design Mapping

## Design Tokens
- Tailwind v4 + shadcn/ui
- Light/Dark mode

## Component Vocabulary (DESIGN.md)
- ChatShell: Clerk-gated container
- BranchSidebar: shows active branch siblings
- MessageList: chat message stream
- StreamingMessage: live SSE token render
- MessageControls: edit/regenerate/branch actions
- PasteToAssetInput: composer with paste-to-txt
- AssetPanel: upload + manage attachments
- AssetReference: inline citation chip

## Experience States (EXPERIENCE.md)

| State | Trigger | UI behavior |
|-------|---------|-------------|
| Unauthenticated | load without session | redirect to Clerk sign-in |
| Streaming | SSE in flight | tokens append live, Markdown-rendered |
| Processing | assistant msg created | status badge `processing` |
| Stopped | user terminated | content "user terminated the response"; regenerate control shown |
| Complete | stream done | final Markdown render |
| Edit mode | user edits latest | trailing asset refs visible w/ remove |

## Basic User Journeys
1. Sign in → open/create conversation → send → stream → complete
2. Branch from assistant reply → explore sibling → edit latest → regenerate
3. Upload PDF → ask question → cited RAG answer (top-3 per conversation)

## Implementation Notes
- Streaming region announced as live region (polite)
- Keyboard-operable composer + controls
- Focus order: sidebar → pane → composer
- ARIA labels on asset/branch controls