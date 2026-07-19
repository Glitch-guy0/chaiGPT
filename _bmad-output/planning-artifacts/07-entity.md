# Entity Diagram — chaiGPT Persistence Model

Mirrors `schema/entity/` (SQL) and the TypeORM entities today: `Conversation` 1—* `Message`.

```mermaid
erDiagram
    CONVERSATION {
        uuid id PK
        string title
        string model "nullable"
        datetime createdAt
        datetime updatedAt
    }
    MESSAGE {
        uuid id PK
        uuid conversationId FK
        string role "user|assistant|system"
        text content
        string model "nullable"
        datetime createdAt
    }
    CONVERSATION ||--o{ MESSAGE : "has"
```

## Entity as Class (for domain modeling)

```mermaid
classDiagram
    class Conversation {
        +id: string
        +title: string
        +model?: string
        +createdAt: Date
        +updatedAt: Date
        -messages: Message[]
        +addMessage(content, role): Message
        +rename(title): void
        +latest(): Message|null
    }
    class Message {
        +id: string
        +conversationId: string
        +role: "user"|"assistant"|"system"
        +content: string
        +model?: string
        +createdAt: Date
        +isUser(): boolean
    }
    Conversation "1" *-- "0..*" Message : contains
```

## schema/ partition (entity / cache / vector)

```mermaid
erDiagram
    CONVERSATION ||--o{ MESSAGE : has
    CACHE_ENTRY {
        string key PK
        string value
        int ttl
        datetime expiresAt
    }
    VECTOR_RECORD {
        uuid id PK
        uuid refId FK
        float embedding
        string kind "message|doc"
    }
    MESSAGE ||--o{ VECTOR_RECORD : embedded_as
```
