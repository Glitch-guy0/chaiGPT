# Sequence Diagrams — chaiGPT (by Separation of Concern)

One diagram per primary flow. Each shows the full hexagonal traversal: inbound controller → cross-cutting → application service → domain port → adapter → framework.

## 1) Send Chat Message (SSE stream)

```mermaid
sequenceDiagram
    actor User
    participant C as ChatController (route.ts)
    participant MW as Middleware/Guards
    participant S as ChatService
    participant CR as IConversationRepository
    participant MR as IMessageRepository
    participant AI as IAiProvider (LangChain)
    participant DB as SQLite (TypeORM)

    User->>C: POST /api/chat (ChatRequest)
    C->>MW: validate + auth check
    MW-->>C: pass
    C->>S: send(req)
    S->>CR: findById(conversationId) or create
    CR->>DB: SELECT/INSERT conversation
    DB-->>CR: Conversation
    CR-->>S: Conversation
    S->>MR: append(conversationId, user, content)
    MR->>DB: INSERT message
    S->>MR: history(conversationId)
    MR->>DB: SELECT messages ASC
    DB-->>MR: Message[]
    MR-->>S: Message[]
    S->>AI: complete(messages)
    AI-->>S: assistantContent
    S->>MR: append(assistant)
    MR->>DB: INSERT message
    S-->>C: ChatResponse (SSE: data / [DONE])
    C-->>User: text/event-stream
```

## 2) List Conversations

```mermaid
sequenceDiagram
    actor User
    participant C as ConversationController
    participant G as Guard
    participant S as ConversationService
    participant CR as IConversationRepository
    participant DB as SQLite

    User->>C: GET /api/conversations
    C->>G: canActivate(ctx)
    G-->>C: true
    C->>S: list()
    S->>CR: findAll()
    CR->>DB: SELECT ORDER updatedAt DESC LIMIT 50
    DB-->>CR: Conversation[]
    CR-->>S: Conversation[]
    S-->>C: Conversation[]
    C-->>User: 200 JSON
```

## 3) Get Conversation by ID (with messages)

```mermaid
sequenceDiagram
    actor User
    participant C as ConversationController
    participant S as ConversationService
    participant CR as IConversationRepository
    participant DB as SQLite

    User->>C: GET /api/conversations/:id
    C->>S: getById(id)
    S->>CR: findById(id, {messages:true})
    CR->>DB: SELECT conv + JOIN messages ASC
    DB-->>CR: Conversation + Message[]
    CR-->>S: Conversation
    S-->>C: Conversation
    C-->>User: 200 JSON
```

## 4) Cache + Vector cross-cutting (future RAG plugin)

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
        S->>VEC: search(vec, k=5)
        VEC-->>S: Hit[]
        S->>CACHE: set(key, context, ttl)
    end
    S->>AI: complete(enrichedMessages)
```
