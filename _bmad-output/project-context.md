---
title: chaiGPT Project Context
status: draft
created: 2026-07-14
updated: 2026-07-14
sections_completed: []
---

## Technology Stack & Versions

- Next.js 16.2.10 (App Router, Turbopack)
- React 19.2.4
- TypeScript 5 (strict mode)
- Tailwind CSS v4 with CSS variables
- shadcn/ui with Base (Radix) primitives
- TanStack Query v5 for server state
- Lucide React for icons
- clsx + tailwind-merge for class utilities

**Configuration notes:**
- Path alias: `@/*` → project root
- `"use client"` required for all interactive components and hooks
- API routes live under `app/api/` using Next.js Route Handlers
