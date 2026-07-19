# Sequence Diagrams — chaiGPT (Layered, Next.js + TypeORM, v2)

One diagram per primary flow. Each shows: Next.js route → Clerk auth → service → TypeORM repository / integration (LangChain, Qdrant, Redis). Reflects PRD §9 v2 model.

## 1) Send Chat Message (SSE stream, per-conversation RAG)

Two consumers of the LLM stream: **(a)** each token forwards to the client as SSE live, **(b)** tokens accumulate in a server-side buffer, persisted to Postgres after the stream completes.

```mermaid
sequenceDiagram
    actor User
    participant C as ChatRoute (route.ts)
    participant AUTH as Clerk middleware / auth()
    participant S as ChatService
    participant CR as ConversationRepository
    participant MR as MessageRepository
    participant VEC as QdrantStore
    participant AI as AiProvider (LangChain)
    participant DB as Postgres (TypeORM)

    User->>C: POST /api/chat (ChatRequest)
    C->>AUTH: auth() -> userId
    AUTH-->>C: userId
    C->>S: send(req, userId)
    S->>CR: findById(conversationId, userId) or create
    CR->>DB: SELECT/INSERT conversation
    DB-->>CR: Conversation
    CR-->>S: Conversation
    S->>MR: append(conversationId, user, content, status:processing)
    MR->>DB: INSERT message
    S->>VEC: search(embed(lastUser), conversationId, k=3)
    VEC-->>S: Hit[] (per-conversation chunks)

    S->>AI: streamChat(messages + retrievedContext)
    loop for each token (chunk)
        AI-->>S: token (chunk)
        S->>S: append token to local streamBuffer
        S-->>C: SSE data: {chunk}
        C-->>User: text/event-stream (token)
    end
    AI-->>S: stream done

    S->>MR: append(assistant, fullContent=streamBuffer, status:complete)
    MR->>DB: INSERT assistant message
    S-->>C: SSE data: [DONE]
    C-->>User: text/event-stream (end)
```

> **Stream handling:** `streamBuffer` is an in-memory accumulator in `ChatService`. The client receives tokens progressively; only after the stream closes does the assembled `streamBuffer` get written via `MessageRepository` (`status: complete`). Early termination flushes `status: stopped` with content `"user terminated the response"`.

## 2) Branch from Assistant Message

```mermaid
sequenceDiagram
    actor User
    participant C as ConversationsRoute
    participant AUTH as Clerk auth()
    participant S as ConversationService
    participant CR as ConversationRepository
    participant DB as Postgres

    User->>C: POST /api/conversations/:id/branch?messageId=:m
    C->>AUTH: auth() -> userId
    AUTH-->>C: userId
    C->>S: branch(id, messageId, userId)
    S->>CR: findById(id, userId)
    CR->>DB: SELECT conversation + messages
    DB-->>CR: Conversation + Message[]
    S->>CR: branch(id, messageId)
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
    participant C as ConversationsRoute
    participant AUTH as Clerk auth()
    participant S as ConversationService
    participant CR as ConversationRepository
    participant DB as Postgres

    User->>C: GET /api/conversations
    C->>AUTH: auth() -> userId
    AUTH-->>C: userId
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
    participant AC as AssetsRoute
    participant AUTH as Clerk auth()
    participant AS as AssetService
    participant AR as AssetRepository
    participant VEC as QdrantStore
    participant VOL as Shared Docker Volume
    participant DB as Postgres

    User->>AC: POST /api/assets (file)
    AC->>AUTH: auth() -> userId
    AUTH-->>AC: userId
    AC->>AS: ingest(userId, convId, file)
    AS->>VOL: stage file (shared volume)
    AS->>VEC: chunk + embed (PDF page-by-page / TXT 2000-char)
    VEC-->>AS: chunks[] (per-chunk embeddings)
    AS->>VEC: upsertChunks(assetId, chunks)
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
    participant C as ChatRoute
    participant AUTH as Clerk auth()
    participant S as ChatService
    participant MR as MessageRepository
    participant AI as AiProvider

    User->>C: POST /api/chat/regenerate/:messageId
    C->>AUTH: auth() -> userId
    AUTH-->>C: userId
    C->>S: regenerate(messageId, userId)
    S->>MR: updateStatus(messageId, processing)
    S->>AI: streamChat(history)
    loop for each token (chunk)
        AI-->>S: token (chunk)
        S->>S: append token to local streamBuffer
        S-->>C: SSE data: {chunk}
        C-->>User: text/event-stream (token)
    end
    AI-->>S: stream done
    S->>MR: update content=streamBuffer + status:complete (same id)
    S-->>C: SSE data: [DONE]
    C-->>User: text/event-stream (end)
```

## 6) Cache + Vector (RAG context reuse)

```mermaid
sequenceDiagram
    participant S as ChatService
    participant VEC as QdrantStore
    participant CACHE as RedisCache
    participant AI as AiProvider

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
