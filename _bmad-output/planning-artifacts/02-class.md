# Class Diagram — chaiGPT (Layered, Next.js + TypeORM, v2)

Two views: **(A) Concrete classes** grouped by layer, **(B) Entities + key types**. Separation is by concern; Next.js and TypeORM are used directly (no port/adapter indirection). Reflects PRD §9 v2 model.

## A) Concrete Classes

```mermaid
classDiagram

%% -----------------------------------------------------------------
%% Web Search (FR-24..FR-28)
%% -----------------------------------------------------------------

class WebSearchProvider {
    <<interface>>
    +search(query) WebResult[]
}

class JinaProvider {
    -apiKey: string
    -baseUrl: string
    +search(query) WebResult[]
    +setApiKey(key)
}

class WebSearchTool {
    -provider: WebSearchProvider
    -schema: ZodSchema
    +run(query) string
}

class WebResult {
    +title: string
    +url: string
    +snippet: string
}

class JinaAPI {
    <<External>>
    +env: JINA_API_KEY
}

%% -----------------------------------------------------------------
%% Enumerations
%% -----------------------------------------------------------------

class Role {
    <<enumeration>>
    user
    assistant
    system
}

class MessageStatus {
    <<enumeration>>
    processing
    complete
    stopped
}

%% -----------------------------------------------------------------
%% Test doubles
%% -----------------------------------------------------------------

class MockJinaProvider {
    +search(query) WebResult[]
}

class MockQdrantStore {
    +embed(text) number[]
    +search(vec, convId, k) Hit[]
    +upsertChunks(assetId, chunks)
}

class MockAiProvider {
    +complete(msgs)
    +streamChat(msgs, onChunk)
}

%% -----------------------------------------------------------------
%% Entities
%% -----------------------------------------------------------------

class Conversation {
    +id: string
    +userId: string
    +rootConversationId: string
    +lastMessageId: string
    +title: string
    +model: string
    +createdAt: Date
    +updatedAt: Date
    +addMessage(content, role)
    +branchFrom(messageId)
}

class Message {
    +id: string
    +conversationId: string
    +userId: string
    +parentId: string
    +role: Role
    +content: string
    +model: string
    +status: MessageStatus
    +createdAt: Date
    +regenerate()
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

%% -----------------------------------------------------------------
%% Services
%% -----------------------------------------------------------------

class ChatService {
    -convRepo: ConversationRepository
    -msgRepo: MessageRepository
    -ai: AiProvider
    -vector: QdrantStore
    -cache: RedisCache
    +send(req)
    +stream(req, onChunk)
    +regenerate(messageId)
}

class ConversationService {
    -repo: ConversationRepository
    +list(userId) Conversation[]
    +create(userId, input)
    +getById(id, userId)
    +branch(id, messageId)
}

class MessageService {
    -repo: MessageRepository
    +append(cid, role, content)
    +history(cid) Message[]
    +editLatest(userId, cid, content)
}

class AssetService {
    -assetRepo: AssetRepository
    -vector: QdrantStore
    +ingest(userId, convId, file)
    +remove(assetId, userId)
}

%% -----------------------------------------------------------------
%% Repositories
%% -----------------------------------------------------------------

class ConversationRepository {
    -ds: DataSource
    +findById(id, userId)
    +save(c)
    +findAll(userId)
    +branch()
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

%% -----------------------------------------------------------------
%% Integrations
%% -----------------------------------------------------------------

class AiProvider {
    -chat: ChatOpenAI
    +complete(msgs)
    +streamChat(msgs, onChunk)
}

class QdrantStore {
    +embed(text) number[]
    +search(vec, convId, k) Hit[]
    +upsertChunks(assetId, chunks)
}

class RedisCache {
    +get(key)
    +set(key, value, ttl)
}

%% -----------------------------------------------------------------
%% Routes
%% -----------------------------------------------------------------

class ChatRoute {
    +POST(req)
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

%% -----------------------------------------------------------------
%% Relationships
%% -----------------------------------------------------------------

Conversation "1" *-- "0..*" Message
Conversation "1" *-- "0..*" Asset
Message "0..1" *-- "0..*" Message : parent

WebSearchTool --> WebSearchProvider
JinaProvider ..|> WebSearchProvider
WebSearchTool --> WebResult
AiProvider --> WebSearchTool : registers
ChatService --> WebSearchTool : optional
JinaProvider --> JinaAPI : HTTPS

ChatService ..> MockJinaProvider : tests
ChatService ..> MockQdrantStore : tests
ChatService ..> MockAiProvider : tests

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
        +role: Role
        +content: string
        +model?: string
        +status: MessageStatus
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
        +user|assistant|system
    }

    Conversation "1" *-- "0..*" Message
    Conversation "1" *-- "0..*" Asset
```
