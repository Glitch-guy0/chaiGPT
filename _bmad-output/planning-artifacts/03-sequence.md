# Sequence Diagrams — chaiGPT (by Separation of Concern, v2)

One diagram per primary flow. Each shows the full hexagonal traversal: inbound controller → Clerk guard → application service → domain port → adapter → framework. Reflects PRD §9 v2 model.

## 1) Send Chat Message (SSE stream, per-conversation RAG)

```mermaid
sequenceDiagram
    actor User
    participant C as ChatController (route.ts)
    participant G as ClerkGuard
    participant S as ChatService
    participant CR as IConversationRepository
    participant MR as IMessageRepository
    participant VEC as IVectorPort (Qdrant)
    participant AI as IAiProvider (LangChain)
    participant DB as Postgres (TypeORM)

    User->>C: POST /api/chat (ChatRequest)
    C->>G: canActivate(ctx)
    G-->>C: true (userId from session)
    C->>S: send(req, userId)
    S->>CR: findById(conversationId, userId) or create
    CR->>DB: SELECT/INSERT conversation
    DB-->>CR: Conversation
    CR-->>S: Conversation
    S->>MR: append(conversationId, user, content, status:processing)
    MR->>DB: INSERT message
    S->>VEC: search(embed(lastUser), conversationId, k=3)
    VEC-->>S: Hit[] (per-conversation chunks)
    S->>AI: complete(messages + retrievedContext)
    AI-->>S: assistantContent
    S->>MR: append(assistant, status:complete)
    MR->>DB: INSERT message
    S-->>C: ChatResponse (SSE: data / [DONE])
    C-->>User: text/event-stream
```

## 2) Branch from Assistant Message

```mermaid
sequenceDiagram
    actor User
    participant C as ConversationController
    participant G as ClerkGuard
    participant S as ConversationService
    participant CR as IConversationRepository
    participant DB as Postgres

    User->>C: POST /api/conversations/:id/branch?messageId=:m
    C->>G: canActivate(ctx)
    G-->>C: true
    C->>S: branch(id, messageId, userId)
    S->>CR: findById(id, userId)
    CR->>DB: SELECT conversation + messages
    DB-->>CR: Conversation + Message[]
    S->>CR: branch(id, messageId)  %% new conv, same rootConversationId, sibling parentId
    CR->>DB: INSERT conversation (rootConversationId kept)
    DB-->>CR: Conversation
    CR-->>S: Conversation
    S-->>C: Conversation
    C-->>User: 200 JSON
```

## 3) List / Get Conversations (user-scoped)

```mermaid
sequenceDiagram
    actor User
    participant C as ConversationController
    participant G as ClerkGuard
    participant S as ConversationService
    participant CR as IConversationRepository
    participant DB as Postgres

    User->>C: GET /api/conversations
    C->>G: canActivate(ctx)
    G-->>C: true
    C->>S: list(userId)
    S->>CR: findAll(userId)
    CR->>DB: SELECT WHERE userId ORDER updatedAt DESC LIMIT 50
    DB-->>CR: Conversation[]
    CR-->>S: Conversation[]
    S-->>C: Conversation[]
    C-->>User: 200 JSON
```

## 4) Asset Upload → Embed (RAG ingest)

```mermaid
sequenceDiagram
    actor User
    participant AC as AssetController
    participant G as ClerkGuard
    participant AS as AssetService
    participant AR as IAssetRepository
    participant VEC as IVectorPort (Qdrant)
    participant VOL as Shared Docker Volume

    User->>AC: POST /api/assets (file)
    AC->>G: canActivate(ctx)
    G-->>AC: true
    AC->>AS: ingest(userId, convId, file)
    AS->>VOL: stage file (shared volume)
    AS->>VEC: chunk + embed (PDF page-by-page / TXT 2000-char)
    VEC-->>AS: chunks[] (per-chunk embeddings)
    AS->>VEC: upsertChunks(assetId, chunks)  %% scoped to conversation
    AS->>AR: save(Asset)
    AR->>DB: INSERT asset
    AS->>VOL: delete original
    AS-->>AC: Asset
    AC-->>User: 201 JSON
```

## 5) Regenerate a Stopped Message (re-run, same ID)

```mermaid
sequenceDiagram
    actor User
    participant C as ChatController
    participant G as ClerkGuard
    participant S as ChatService
    participant MR as IMessageRepository
    participant AI as IAiProvider

    User->>C: POST /api/chat/regenerate/:messageId
    C->>G: canActivate(ctx)
    G-->>C: true
    C->>S: regenerate(messageId, userId)
    S->>MR: updateStatus(messageId, processing)
    S->>AI: complete(history)
    AI-->>S: newContent
    S->>MR: update content + status:complete (same id)
    S-->>C: ChatResponse
    C-->>User: 200 JSON
```

## 6) Cache + Vector (RAG context reuse)

```mermaid
sequenceDiagram
    participant S as ChatService
    participant VEC as IVectorPort
    participant CACHE as ICachePort
    participant AI as IAiProvider

    S->>CACHE: get("ctx:"+conversationId)
    alt cache hit
        CACHE-->>S: cached context
    else miss
        S->>VEC: embed(lastUserMessage)
        VEC-->>S: number[]
        S->>VEC: search(vec, conversationId, k=3)
        VEC-->>S: Hit[]
        S->>CACHE: set(key, context, ttl)
    end
    S->>AI: complete(enrichedMessages)
```
