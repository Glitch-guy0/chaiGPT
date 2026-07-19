# Class Diagram — chaiGPT (by Separation of Concern)

Two views: **(A) Concrete classes** grouped by layer, **(B) Interfaces + Types** (the ports/contracts) grouped by layer. The dependency rule: outer layers reference inner layers only through interfaces.

## A) Concrete Classes

```mermaid
classDiagram
    %% Domain entities
    class Conversation {
        +id: string
        +title: string
        +model?: string
        +createdAt: Date
        +updatedAt: Date
        +messages: Message[]
        +addMessage(m)
    }
    class Message {
        +id: string
        +conversationId: string
        +role: "user"|"assistant"|"system"
        +content: string
        +model?: string
        +createdAt: Date
    }

    %% Application services
    class ChatService {
        -convRepo: IConversationRepository
        -msgRepo: IMessageRepository
        -ai: IAiProvider
        +send(req): Promise~ChatResponse~
        +stream(req, onChunk)
    }
    class ConversationService {
        -repo: IConversationRepository
        +list(): Promise~Conversation[]~
        +create(input)
        +getById(id)
    }
    class MessageService {
        -repo: IMessageRepository
        +append(cid, role, content)
        +history(cid): Message[]
    }

    %% Adapters
    class TypeOrmConversationRepository {
        -ds: DataSource
        +findById(id)
        +save(c)
        +findAll()
    }
    class TypeOrmMessageRepository {
        -ds: DataSource
        +findByConversation(cid)
        +save(m)
    }
    class LangChainAiProvider {
        -chat: ChatOpenAI
        +complete(msgs)
        +streamChat(msgs, onChunk)
    }
    class SqliteCacheAdapter {
        +get(k)
        +set(k, v, ttl)
    }
    class VectorStoreAdapter {
        +embed(text)
        +search(vec, k)
    }

    %% Framework interface (inbound)
    class ChatController {
        +POST(req): Response
    }
    class ConversationController {
        +GET()
        +POST()
        +GET(id)
    }

    %% Plugins
    class Gpt4oMiniStrategy {
        +modelName: "gpt-4o-mini"
    }

    Conversation "1" *-- "0..*" Message
    ChatService --> Conversation
    ChatService --> Message
    ConversationService --> Conversation
    MessageService --> Message
    ChatService ..> TypeOrmConversationRepository : via port
    ChatService ..> TypeOrmMessageRepository : via port
    ChatService ..> LangChainAiProvider : via port
    TypeOrmConversationRepository ..|> IConversationRepository
    TypeOrmMessageRepository ..|> IMessageRepository
    LangChainAiProvider ..|> IAiProvider
    Gpt4oMiniStrategy ..|> IAiStrategy
    ChatController --> ChatService
    ConversationController --> ConversationService
```

## B) Interfaces & Types (Ports + Contracts)

```mermaid
classDiagram
    %% Repository ports (domain interfaces)
    class IConversationRepository {
        <<interface>>
        +findById(id): Promise~Conversation|null~
        +save(c): Promise~Conversation~
        +findAll(): Promise~Conversation[]~
    }
    class IMessageRepository {
        <<interface>>
        +findByConversation(cid): Promise~Message[]~
        +save(m): Promise~Message~
    }
    %% AI port + strategy
    class IAiProvider {
        <<interface>>
        +complete(msgs): Promise~string~
        +streamChat(msgs, onChunk?): AsyncGenerator~string~
    }
    class IAiStrategy {
        <<interface>>
        +modelName: string
        +build(messages): LangChainMessage[]
    }
    %% Cache / vector ports
    class ICachePort {
        <<interface>>
        +get(k): Promise~string|null~
        +set(k, v, ttl): Promise~void~
    }
    class IVectorPort {
        <<interface>>
        +embed(text): Promise~number[]~
        +search(vec, k): Promise~Hit[]~
    }
    %% Cross-cutting ports
    class IGuard {
        <<interface>>
        +canActivate(ctx): Promise~boolean~
    }
    class IInterceptor {
        <<interface>>
        +intercept(ctx, next): Promise~Response~
    }
    class ITransform {
        <<interface>>
        +toDto(entity): Dto
        +toEntity(dto): Entity
    }

    %% Shared types
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

    IConversationRepository <|.. TypeOrmConversationRepository
    IMessageRepository <|.. TypeOrmMessageRepository
    IAiProvider <|.. LangChainAiProvider
    IAiStrategy <|.. Gpt4oMiniStrategy
    ICachePort <|.. SqliteCacheAdapter
    IVectorPort <|.. VectorStoreAdapter
```
