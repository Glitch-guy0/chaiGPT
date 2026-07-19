# Package Structure — chaiGPT (Layered, Next.js + TypeORM)

Tightly integrated with **Next.js (App Router, route handlers, middleware)** and **TypeORM (entities, migrations, repositories)**. Separation is by *concern* (routes → services → entities/repositories → integrations), not by framework isolation. Coupling to Next.js and TypeORM is approved and intentional.

---

## 1. File Tree (authoritative)

Legend: `[E]` = entity · `[S]` = service · `[R]` = repository · `[C]` = route handler · `[M]` = middleware · `[I]` = integration (LangChain/Qdrant/cache).

```mermaid
treeView-beta
    src/
        app/                                  # NEXT.JS APP ROUTER
            layout.tsx
            page.tsx
            api/
                chat/route.ts                 # [C] ChatRoute (SSE stream)
                conversations/route.ts        # [C] ConversationsRoute
                conversations/[id]/route.ts   # [C] ConversationRoute.getById
                assets/route.ts               # [C] AssetsRoute (upload/delete)
            middleware.ts                     # [M] Clerk session guard
        services/                             # APPLICATION (use-case logic)
            chat.service.ts                   # [S] ChatService
            conversation.service.ts           # [S] ConversationService
            message.service.ts                # [S] MessageService
            asset.service.ts                   # [S] AssetService
        lib/
            db/                               # TYPEORM
                data-source.ts                # Postgres DataSource
                entities/
                    conversation.entity.ts    # [E]
                    message.entity.ts         # [E]
                    asset.entity.ts           # [E]
                repositories/
                    conversation.repository.ts # [R]
                    message.repository.ts      # [R]
                    asset.repository.ts        # [R]
                migrations/                    # TypeORM migrations
            ai/                               # INTEGRATION
                langchain.ts                  # [I] AiProvider (ChatOpenAI, stream)
            vector/                           # INTEGRATION
                qdrant.ts                     # [I] Qdrant store (@langchain/qdrant)
            cache/                            # INTEGRATION
                redis.ts                      # [I] KV cache client
            auth/                             # Clerk helpers
                session.ts                    # auth() wrapper
            validation/
                schemas.ts                    # Zod schemas
            utils.ts
        types/                                # APP types (ChatRequest, ChatResponse)
    schema/                                  # PERSISTENCE CONTRACTS
        entity/                               # Postgres / TypeORM migrations
        cache/                                # KV store schema
        vector/                               # Qdrant collection schema
```

---

## 2. Partitions (segregated by concern)

### 2.1 Routes — `src/app`
*Next.js App Router entry points. Clerk middleware guards; route handlers call services. Depends on: services, `lib/auth`.*

| Concern | Location | Contents |
|---------|----------|----------|
| Chat route | `src/app/api/chat/route.ts` | SSE stream → `ChatService` |
| Conversations routes | `src/app/api/conversations/**` | list/create/getById → `ConversationService` |
| Assets route | `src/app/api/assets/route.ts` | upload/delete → `AssetService` |
| Middleware | `src/app/middleware.ts` | Clerk session protection |
| UI shell | `src/app/layout.tsx`, `page.tsx` | chat UI |

### 2.2 Services — `src/services`
*Use-case orchestration. Depends on: `lib/db` repositories, `lib/ai`, `lib/vector`, `lib/cache`.*

| Concern | File | Responsibility |
|---------|------|----------------|
| Chat | `chat.service.ts` | send, stream, regenerate |
| Conversation | `conversation.service.ts` | list, create, getById, branch |
| Message | `message.service.ts` | append, edit-latest, status |
| Asset | `asset.service.ts` | ingest, remove |

### 2.3 Data (TypeORM) — `src/lib/db`
*Entities + repositories + migrations. Depends on: nothing (pure persistence).*

| Concern | Location | Contents |
|---------|----------|----------|
| Entities | `src/lib/db/entities` | `conversation.entity.ts`, `message.entity.ts`, `asset.entity.ts` |
| Repositories | `src/lib/db/repositories` | `conversation/message/asset.repository.ts` |
| Migrations | `src/lib/db/migrations` | TypeORM SQL migrations |
| DataSource | `src/lib/db/data-source.ts` | Postgres connection |

### 2.4 Integrations — `src/lib/{ai,vector,cache,auth}`
*External systems used directly (no port indirection). Depends on: services call them.*

| Concern | Location | Tech |
|---------|----------|------|
| AI | `src/lib/ai/langchain.ts` | LangChain `ChatOpenAI` (stream) |
| Vector | `src/lib/vector/qdrant.ts` | Qdrant via `@langchain/qdrant` |
| Cache | `src/lib/cache/redis.ts` | Redis KV |
| Auth | `src/lib/auth/session.ts` | Clerk `auth()` |

### 2.5 Shared — `src/lib`, `src/types`
| Concern | Location | Contents |
|---------|----------|----------|
| Validation | `src/lib/validation/schemas.ts` | Zod schemas |
| Utils | `src/lib/utils.ts` | helpers |
| App types | `src/types` | `ChatRequest`, `ChatResponse` |

### 2.6 Persistence Schema — `schema/`
| Concern | Location | Defines |
|---------|----------|---------|
| Entity (SQL) | `schema/entity` | Postgres / TypeORM migrations |
| Cache (KV) | `schema/cache` | key-value store schema |
| Vector | `schema/vector` | Qdrant collection schema |

---

## 3. Dependency Rule

Arrows point **inward to services**, then down to repositories/integrations:

```
app (routes + middleware) → services → { repositories (TypeORM) | ai | vector | cache }
```

Next.js and TypeORM are used directly throughout — there is **no port/adapter abstraction layer** to decouple them. Cross-cutting auth is handled by Next.js middleware + `auth()` in route handlers.

---

## 4. Allowed Dependency Directions

```mermaid
flowchart LR
    A["app / routes + middleware"] -->|calls| B["services"]
    B -->|persists via| R["lib/db repositories (TypeORM)"]
    B -->|generates via| AI["lib/ai (LangChain)"]
    B -->|retrieves via| V["lib/vector (Qdrant)"]
    B -->|caches via| C["lib/cache (Redis)"]
    B -->|auth via| AUTH["lib/auth (Clerk)"]
    R --> DB[("Postgres")]
    V --> Q[("Qdrant")]
    C --> RED[("Redis")]
```
