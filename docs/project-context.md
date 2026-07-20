# chaiGPT — Project Context

## 1. Project Overview

chaiGPT is a Next.js AI chat backend with branching conversations, streaming responses, message editing, regeneration, and asset/RAG support. Auth via Clerk. Persistence via TypeORM + Postgres.

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19 |
| Auth | Clerk (`@clerk/nextjs`) |
| ORM | TypeORM 0.3 |
| Database | Postgres (prod), SQLite (tests) |
| Validation | Zod 4 |
| AI | LangChain + OpenAI (`@langchain/openai`) |
| Testing | Vitest 4, `@vitest/coverage-v8`, Playwright (e2e) |
| Infra | Docker Compose (Postgres, planned Redis/Qdrant) |
| Frontend | Tailwind CSS 4, Radix UI, TanStack React Query |

Planned (not yet wired): Redis caching (`src/lib/cache/redis.ts`), Qdrant vector store (`src/lib/vector/qdrant.ts`).

## 3. Architecture Layers

```
Route Handlers (src/app/api/*)
       │  parse auth, validate input, instantiate deps, return Response
       ▼
Services (src/services/*)
       │  business logic, orchestration, error throwing
       ▼
Repositories (src/lib/db/repositories/*)
       │  TypeORM queries, transaction boundaries
       ▼
Entities (src/lib/db/entities/*)
       TypeORM column/relationship definitions
```

- **Route Handlers** — Thin. Call `auth()`, parse body with Zod, construct service graph, catch domain errors, return JSON or SSE stream.
- **Services** — Interface + Impl pattern. Own business rules, validation orchestration, error mapping to `NotFoundError`.
- **Repositories** — Interface + Impl pattern. Each wraps a single TypeORM `Repository<T>`. Accept `DataSource` in constructor. Provide domain-specific query methods.
- **Entities** — Pure TypeORM entity classes. No business logic. UUID PKs, relations, column metadata.

Dependency injection: manual constructor wiring in route handlers (no DI container).

## 4. Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── assets/route.ts                          # GET/POST/DELETE — stubs (501)
│   │   ├── chat/
│   │   │   ├── route.ts                             # POST — send message, returns SSE stream
│   │   │   └── regenerate/[messageId]/route.ts      # POST — regenerate assistant response
│   │   └── conversations/
│   │       ├── route.ts                             # GET list, POST create
│   │       └── [id]/
│   │           ├── route.ts                         # GET conversation with messages
│   │           ├── branch/route.ts                  # POST — fork conversation
│   │           └── edit/route.ts                    # PATCH — edit latest user message
│   └── layout.tsx, page.tsx, globals.css            # Next.js app shell (frontend)
├── components/                                      # React UI components
├── hooks/                                           # React hooks
├── lib/
│   ├── ai/langchain.ts                              # AiProvider interface + OpenAiProvider
│   ├── auth/session.ts                              # Clerk auth helper
│   ├── cache/redis.ts                               # RedisCache type stub (planned)
│   ├── db/
│   │   ├── index.ts                                 # AppDataSource, getDatabase()
│   │   ├── entities/                                # Conversation, Message, Asset
│   │   ├── migrations/                              # TypeORM migration files
│   │   └── repositories/                            # Conversation, Message, Asset repos
│   ├── errors.ts                                    # NotFoundError class
│   ├── transforms/content-split.ts                  # splitContent for large paste handling
│   ├── validation/schemas.ts                        # Zod schemas for all request types
│   └── vector/qdrant.ts                             # QdrantStore type stub (planned)
├── services/
│   ├── chat.service.ts                              # ChatService: send, stream, regenerate
│   ├── conversation.service.ts                      # ConversationService: list, create, branch
│   ├── message.service.ts                           # MessageService: append, history, editLatest
│   └── asset.service.ts                             # AssetService: ingest, remove (interface only)
├── types/
│   ├── index.ts                                     # Role, ChatMessage, ChatRequest, ChatResponse
│   └── chat.ts                                      # Re-exports from validation schemas
└── middleware.ts                                    # Next.js middleware
```

## 5. Entity Model

### Conversation

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `userId` | string | Clerk user ID |
| `title` | string | Display title |
| `model` | string? | AI model override |
| `rootConversationId` | string? | Set on branches; points to original conversation's ID or its own root |
| `lastMessageId` | string? | ID of most recent message in this branch |
| `createdAt` | timestamp | Auto |
| `updatedAt` | timestamp | Auto |

Relations: `OneToMany → Message`, `OneToMany → Asset`

### Message

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `conversationId` | string | FK → Conversation |
| `userId` | string | Clerk user ID |
| `parentId` | string? | FK → Message (self-relation). Links to parent message in tree |
| `role` | `'user' \| 'assistant' \| 'system'` | |
| `content` | text | Message body |
| `model` | string? | Model used for this response |
| `status` | `'processing' \| 'complete' \| 'stopped'` | Streaming state |
| `assetIds` | string[]? | Simple-array of Asset UUIDs |
| `createdAt` | timestamp | Auto |
| `updatedAt` | timestamp | Auto |

Relations:
- `ManyToOne → Conversation` (via `conversationId`)
- `ManyToOne → Message` (via `parentId`, self-relation, nullable)
- `OneToMany → Message` (inverse of `parent`, named `siblings`)

### Asset

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `userId` | string | Clerk user ID |
| `conversationId` | string | FK → Conversation |
| `filename` | string | Original filename |
| `mime` | string | MIME type |
| `path` | string | Storage path |
| `text` | text? | Extracted text content |
| `createdAt` | timestamp | Auto |
| `updatedAt` | timestamp | Auto |

Relations: `ManyToOne → Conversation` (via `conversationId`)

## 6. Key Patterns

### Branching

1. Copy conversation with new UUID. Set `rootConversationId` to source's root (or source ID if first branch).
2. Copy messages from root up to branch point (inclusive). Assign fresh UUIDs.
3. Remap `parentId` references using `oldId → newId` map. If old parent wasn't copied (before branch point), keep original ID.
4. Set `lastMessageId` on new conversation to the remapped copy of the branch-point message.

Implementation: `ConversationRepositoryImpl.branch()` — runs inside a TypeORM transaction (`src/lib/db/repositories/conversation.repository.ts:32`).

### Streaming

Shared `createStream()` pipeline in `ChatServiceImpl` (`src/services/chat.service.ts:114`). Used by both `send()` and `regenerate()`.

SSE format: `data: { token }` per chunk, `event: done` on completion, `event: stopped` on error/cancel. Accumulates full buffer, persists final content to DB on stream end.

### Edit-Latest

`MessageServiceImpl.editLatest()` (`src/services/message.service.ts:25`):
1. Resolve target user message via `resolveTargetUserMessage()`.
2. Guard: only edit the most recent sibling (throws if `findLatestSibling` differs).
3. Guard: reject if message has been branched from (`isBranchedAway` checks for children in other conversations).
4. Update content (max 500 chars). Clear trailing assistant content if present.

### Regenerate

`ChatServiceImpl.regenerate()` (`src/services/chat.service.ts:200`):
1. `tryStartRegenerate()` — atomic CAS: update status from `stopped` → `processing` only if role is `assistant`.
2. Walk message chain from `parentId` upward via `findMessageChain()`. Excludes the target message itself (starts from parent).
3. Feed chain as history to `createStream()`.

### Content Splitting

`splitContent()` (`src/lib/transforms/content-split.ts:6`): If user message > 500 chars, split into `inline` (first 500) + `extracted` (remainder). Extracted chunks saved as Asset records via `AssetRepository`.

## 7. Testing

- **Framework**: Vitest 4 with globals enabled.
- **DB**: In-memory SQLite via `better-sqlite3` / `sqlite3` packages.
- **Coverage**: V8 provider, 80% threshold on statements/branches/functions/lines.
- **Scope**: `src/services/**/*.ts` and `src/lib/db/repositories/**/*.ts`.
- **Mocks**: External deps (AI provider, Redis, Qdrant) mocked in test files.
- **E2E**: Playwright in `e2e/` directory with Docker Compose for infra.
- **Scripts**: `npm test`, `npm run test:watch`, `npm run test:coverage`, `npm run test:e2e`.

## 8. Conventions

- **Path alias**: `@/*` → `src/*` (configured in `vitest.config.ts` and `tsconfig`).
- **Entities**: TypeORM decorators, `PrimaryGeneratedColumn('uuid')`, no business logic.
- **Services**: Interface + `*Impl` class pattern. Interface exported for testability.
- **Repositories**: Interface + `*Impl` class pattern. Accept `DataSource` in constructor, create internal `Repository<T>`.
- **Validation**: Zod schemas in `src/lib/validation/schemas.ts`. Route handlers call `.parse()` or `.safeParse()`.
- **Errors**: `NotFoundError` from `src/lib/errors.ts`. Route handlers catch and map to HTTP 404.
- **Route handlers**: Export `runtime = "nodejs"`, `dynamic = "force-dynamic"`. Call `auth()` for userId. Dynamic imports for DB (`getDatabase()`).
- **DB connection**: Lazy singleton via `getDatabase()` in `src/lib/db/index.ts`.
- **Naming**: Files match entity/service name (`conversation.service.ts`). Route folders match API segments.
