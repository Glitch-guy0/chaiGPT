# Sequence Diagrams — chaiGPT (by Separation of Concern, v2)

One diagram per primary flow. Each shows the full hexagonal traversal: inbound controller → Clerk guard → application service → domain interface → adapter → framework. Reflects PRD §9 v2 model.

## 1) Send Chat Message (SSE stream, per-conversation RAG)

Two consumers of the LLM stream: **(a)** each token is forwarded to the client as an SSE chunk immediately, **(b)** tokens are accumulated server-side into a local buffer, then persisted to DB once the stream completes.

```mermaid
sequenceDiagram
    actor User
    participant C as ChatController (route.ts)
    participant G as ClerkGuard
    participant S as ChatService
    participant CR as IConversationRepository
    participant MR as IMessageRepository
    participant VEC as IVectorInterface (Qdrant)
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

    S->>AI: streamChat(messages + retrievedContext)
    loop for each token (chunk)
        AI-->>S: token (chunk)
        S->>S: append token to local streamBuffer
        S-->>C: SSE data: {chunk}        %% live to client
        C-->>User: text/event-stream (token)
    end
    AI-->>S: stream done

    S->>MR: append(assistant, fullContent=streamBuffer, status:complete)
    MR->>DB: INSERT assistant message
    S-->>C: SSE data: [DONE]
    C-->>User: text/event-stream (end)
```

> **Stream handling:** `streamBuffer` is an in-memory accumulator in `ChatService` (or the controller) holding the full assistant text. The client receives tokens progressively; only after the stream closes does the assembled `streamBuffer` get written to the `Message` repository (`status: complete`). If the user terminates early, the buffer is flushed with `status: stopped` and content `"user terminated the response"`.

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
    participant VEC as IVectorInterface (Qdrant)
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

Same streaming behavior as #1: tokens stream live to the client and accumulate in a server-side buffer; the assembled content overwrites the same message ID after the stream ends.

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
    participant VEC as IVectorInterface
    participant CACHE as ICacheInterface
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
