# Class Diagram — chaiGPT (Layered, Next.js + TypeORM, v2)

Two views: **(A) Concrete classes** grouped by layer, **(B) Entities + key types**. Separation is by concern; Next.js and TypeORM are used directly (no port/adapter indirection). Reflects PRD §9 v2 model.

## A) Concrete Classes

```mermaid
classDiagram
    %% Entities (TypeORM)
    class Conversation {
        +id: string
        +userId: string
        +rootConversationId?: string
        +lastMessageId?: string
        +title: string
        +model?: string
        +createdAt: Date
        +updatedAt: Date
        +addMessage(content, role): Message
        +branchFrom(messageId): Conversation
    }
    class Message {
        +id: string
        +conversationId: string
        +userId: string
        +parentId?: string
        +role: "user"|"assistant"|"system"
        +content: string
        +model?: string
        +status: "processing"|"complete"|"stopped"
        +createdAt: Date
        +regenerate(): void
    }
    class Asset {
        +id: string
        +userId: string
        +conversationId: string
        +filename: string
        +mime: string
        +path: string
        +createdAt: Date
    }

    %% Services
    class ChatService {
        -convRepo: ConversationRepository
        -msgRepo: MessageRepository
        -ai: AiProvider
        -vector: QdrantStore
        -cache: RedisCache
        +send(req): Promise~ChatResponse~
        +stream(req, onChunk)
        +regenerate(messageId)
    }
    class ConversationService {
        -repo: ConversationRepository
        +list(userId): Promise~Conversation[]~
        +create(userId, input)
        +getById(id, userId)
        +branch(id, messageId)
    }
    class MessageService {
        -repo: MessageRepository
        +append(cid, role, content)
        +history(cid): Message[]
        +editLatest(userId, cid, content)
    }
    class AssetService {
        -assetRepo: AssetRepository
        -vector: QdrantStore
        +ingest(userId, convId, file): Promise~Asset~
        +remove(assetId, userId)
    }

    %% TypeORM repositories
    class ConversationRepository {
        -ds: DataSource
        +findById(id, userId)
        +save(c)
        +findAll(userId)
        +branch(...)
    }
    class MessageRepository {
        -ds: DataSource
        +findByConversation(cid)
        +save(m)
        +updateStatus(id, status)
    }
    class AssetRepository {
        -ds: DataSource
        +save(a)
        +findByConversation(cid)
        +delete(id)
    }

    %% Integrations (used directly)
    class AiProvider {
        -chat: ChatOpenAI
        +complete(msgs)
        +streamChat(msgs, onChunk)
    }
    class QdrantStore {
        +embed(text): Promise~number[]~
        +search(vec, convId, k): Promise~Hit[]~
        +upsertChunks(assetId, chunks)
    }
    class RedisCache {
        +get(k)
        +set(k, v, ttl)
    }

    %% Routes (Next.js)
    class ChatRoute {
        +POST(req): Response
    }
    class ConversationsRoute {
        +GET()
        +POST()
        +GET(id)
    }
    class AssetsRoute {
        +POST(upload)
        +DELETE(id)
    }

    Conversation "1" *-- "0..*" Message
    Conversation "1" *-- "0..*" Asset
    Message "0..1" *-- "0..*" Message : "parent of"

    ChatService --> Conversation
    ChatService --> Message
    ConversationService --> Conversation
    MessageService --> Message
    AssetService --> Asset
    ChatService --> ConversationRepository
    ChatService --> MessageRepository
    ChatService --> AiProvider
    ChatService --> QdrantStore
    ChatService --> RedisCache
    AssetService --> AssetRepository
    AssetService --> QdrantStore
    ChatRoute --> ChatService
    ConversationsRoute --> ConversationService
    AssetsRoute --> AssetService
```

## B) Entities & Types

```mermaid
classDiagram
    class Conversation {
        +id: string
        +userId: string
        +rootConversationId?: string
        +lastMessageId?: string
        +title: string
        +model?: string
        +createdAt: Date
        +updatedAt: Date
    }
    class Message {
        +id: string
        +conversationId: string
        +userId: string
        +parentId?: string
        +role: "user"|"assistant"|"system"
        +content: string
        +model?: string
        +status: "processing"|"complete"|"stopped"
        +createdAt: Date
    }
    class Asset {
        +id: string
        +userId: string
        +conversationId: string
        +filename: string
        +mime: string
        +path: string
        +createdAt: Date
    }
    class ChatRequest {
        <<type>>
        +messages: Role content[]
        +model?: string
        +conversationId?: string
    }
    class ChatResponse {
        <<type>>
        +id: string
        +content: string
        +conversationId: string
        +model?: string
    }
    class Role {
        <<type>>
        +"user"|"assistant"|"system"
    }

    Conversation "1" *-- "0..*" Message
    Conversation "1" *-- "0..*" Asset
```
