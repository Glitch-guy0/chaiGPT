# Entity Diagram — chaiGPT Persistence Model (v2)

Mirrors the PRD §9 v2 data model and `schema/`: `entity/` (Postgres SQL via TypeORM), `cache/` (KV), `vector/` (Qdrant). Entities are defined with TypeORM decorators and persisted to Postgres.

> **Note — no entity change for web search (FR-24..FR-28):** Web search results from Jina AI are ephemeral runtime objects (`WebResult`). They are injected into the prompt as additional context alongside Qdrant RAG and cited via source URLs in the assistant message. No new table or entity is added; only `JINA_API_KEY` is required as an environment variable (FR-25).

```mermaid
erDiagram
    USER {
        string id PK "Clerk sub"
    }
    CONVERSATION {
        uuid id PK
        string userId FK
        uuid rootConversationId FK
        uuid lastMessageId FK
        string title
        string model
        datetime createdAt
        datetime updatedAt
    }
    MESSAGE {
        uuid id PK
        uuid conversationId FK
        uuid userId FK
        uuid parentId FK
        string role "user|assistant|system"
        text content
        string model
        string status "processing|complete|stopped"
        datetime createdAt
    }
    ASSET {
        uuid id PK
        uuid userId FK
        uuid conversationId FK
        string filename
        string mime
        string path "shared docker volume"
        datetime createdAt
    }
    CACHE_ENTRY {
        string key PK
        string value
        int ttl
        datetime expiresAt
    }
    VECTOR_RECORD {
        uuid id PK
        uuid assetId FK
        uuid chunkIndex
        float embedding
        text chunkText
        string kind "doc"
    }
    USER ||--o{ CONVERSATION : owns
    CONVERSATION ||--o{ MESSAGE : contains
    MESSAGE ||--o{ MESSAGE : "parent of - branch"
    CONVERSATION ||--o{ ASSET : references
    MESSAGE ||--o{ ASSET : "embeds into vector"
    ASSET ||--o{ VECTOR_RECORD : chunked_into
```

## Entity as Class (domain model)

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
        -messages: Message[]
        +addMessage(content, role): Message
        +branchFrom(messageId): Conversation
        +rename(title): void
        +latest(): Message|null
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
        +isUser(): boolean
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
    Conversation "1" *-- "0..*" Message : contains
    Conversation "1" *-- "0..*" Asset : references
    Message "0..1" *-- "0..*" Message : "parent of - branch"
```

## schema/ partition (entity / cache / vector)

```mermaid
erDiagram
    CONVERSATION ||--o{ MESSAGE : has
    CONVERSATION ||--o{ ASSET : references
    ASSET ||--o{ VECTOR_RECORD : chunked_into
    CACHE_ENTRY {
        string key PK
        string value
        int ttl
        datetime expiresAt
    }
    VECTOR_RECORD {
        uuid id PK
        uuid assetId FK
        uuid chunkIndex
        float embedding
        text chunkText
    }
```
