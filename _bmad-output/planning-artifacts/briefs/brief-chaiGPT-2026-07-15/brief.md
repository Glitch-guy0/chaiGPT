---
title: chaiGPT Project Brief
status: ready
created: 2026-07-19
updated: 2026-07-19
---

## Goal

Build a context-aware conversational AI platform where authenticated users can have branching conversations, upload documents (PDF, TXT, MD) for retrieval-augmented generation, and maintain persistent conversation history scoped to their account.

## Current State

- Flat chat UI with sidebar conversation list
- SQLite persistence via TypeORM (`Conversation`, `Message` entities)
- Streaming LLM responses through LangChain
- No user accounts, no branching, no assets, no retrieval

## Target State

- Clerk-authenticated users with scoped conversation history
- User-scoped conversations with branching threads
- Asset upload → embed → delete lifecycle with named Docker volume for persistence
- Qdrant vector DB context retrieval (top-3 segments per query; PDFs chunked page-by-page, text files chunked at 2000 characters)
- Conversation history with root/leaf tracking
- Dockerized dev/prod environments via `infra/docker-compose.yml`

## Key Architectural Decisions

1. **Database:** PostgreSQL via Docker Compose. TypeORM migrations for schema evolution.
2. **Vector Store:** Qdrant (Dockerized) for embedding storage and retrieval. LangChain `@langchain/qdrant` integration for RAG pipeline. PDFs are chunked page-by-page via LangChain. Text files (TXT, MD) are chunked at 2000 characters via LangChain text splitters.
3. **LLM/Orchestration:** LangChain for prompt management, streaming, and retrieval chain.
4. **Authentication:** Clerk (`@clerk/nextjs`) with Next.js App Router. Middleware protects routes; API routes verify session.
5. **Branching:** Messages store `parent_id`; conversations store `root_conversation_id` and `last_message_id`. Sibling messages share the same `parent_id`. Branched conversations share the same `root_conversation_id`. Branching can be initiated from any agent message. Once a conversation continues with a sibling branch, the sidebar shows only the siblings; the conversation does not continue further with siblings. If a user edits a message, only the recently created sibling gets updated — not all siblings. Branching takes only the recently updated message for further conversation. Retries after that are ignored. The branched section continues with whatever `id` it started with (known bug, approved). Editing updates message content in place and does not affect branching.
6. **Asset Pipeline:** Local filesystem staging → embed → delete original. No external object store in v1. A named Docker volume is created on `start:dev:infra`/`start:prod` and deleted on `stop:dev:infra`/`stop:prod` if explicitly provided. Assets referenced in deleted assistant replies are preserved and shown in the conversation; users may explicitly delete them. When the user is in edit mode, asset references from the trailing assistant reply remain visible with an option to remove them, performed according to user action.
7. **Message Editing & Content Constraints:** Only the most recent user message is editable; all past user and agent messages have editing disabled. On edit, the latest user message and its trailing assistant reply are updated in place (same IDs, updated content) — no delete-and-replace. Editing is a content-only operation and does not affect branching. `conversations.last_message_id` remains unchanged. Messages have a `status` enum column: `processing`, `complete`, `stopped`. When the user sends a query, the user message is saved and a trailing assistant message is created with `status: processing`. Once the LLM streaming response completes, the assistant message status updates to `complete`. If the user explicitly terminates the response, the assistant message content shows "user terminated the response" and status updates to `stopped`. Maximum 500 characters per message. Content exceeding 200 characters on paste is converted to a `.txt` file and uploaded as an asset.

## Infrastructure

- `infra/docker-compose.yml` with Postgres, Qdrant, and app service definitions
- `infra/.env.example` with localhost defaults pointing to Docker services
- npm scripts:
  - `npm run start:dev` — run `start:dev:infra` and start the Next.js application on the host
  - `npm run start:dev:infra` — create Docker volume (if not exists) and start Postgres + Qdrant via Docker Compose
  - `npm run stop:dev:infra` — stop dev Docker instances and delete the volume if explicitly provided
  - `npm run start:prod` — build and start full production stack (Postgres + Qdrant + application) via Docker Compose
  - `npm run stop:prod` — stop prod Docker instances and delete the volume if explicitly provided

## What We're NOT Building Now

- Custom design system work
- Full branch tree visualization
- Organizations or multi-tenancy beyond Clerk user scoping

## Next Steps

1. Scaffold Clerk auth (`clerk init`) and protect routes
2. Add Postgres + Qdrant to `infra/docker-compose.yml` with named volume for assets (create on start, delete on stop if provided)
3. Create `.env.example` and npm scripts for dev/prod lifecycle (`start:dev`, `start:dev:infra`, `stop:dev:infra`, `start:prod`, `stop:prod`)
4. Migrate TypeORM from SQLite to Postgres (fresh start; clean existing SQLite data; schema + migrations)
5. Update DB schema (`User` linkage, `Conversation` v2, `Message` v2 with `status` enum, `Asset`)
6. Implement `@langchain/qdrant` embedding pipeline for RAG (PDF page-by-page chunking, 2000-char text chunking)
7. Implement Markdown rendering for message content
8. Implement message editing (edit-latest-user-only, in-place content update with message `status` enum and lifecycle)
9. Implement branching from agent messages with sibling sidebar behavior
10. Implement large-paste-to-txt asset flow and 500-char message limit
11. Update API routes for branching queries and asset upload
12. Update UI state model for branch-aware conversation list
