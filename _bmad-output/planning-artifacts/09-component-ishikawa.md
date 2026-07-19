# Component Architecture — Ishikawa (Fishbone) by Concern & Type

Root cause / concern analysis grouped by category. Each bone is a partition; effects are the risks the re-architecture must resolve or the value it delivers.

```mermaid
flowchart LR
    subgraph head["Scalable Hexagonal chaiGPT"]
        EFF["Effect:<br/>Framework-coupled, hard to scale/test"]
    end

    subgraph bones[""]
        direction TB
        B1["Domain & Types"] -->|entities, types, lib/types| EFF
        B2["Ports / Interfaces"] -->|interfaces, lib/interfaces, repository ports| EFF
        B3["Application"] -->|services| EFF
        B4["Inbound"] -->|controllers, middleware, guards, interceptors, transformations| EFF
        B5["Outbound Adapters"] -->|repository, ai, cache, vector, plugins| EFF
        B6["Persistence Schema"] -->|entity SQL, cache KV, vector| EFF
    end

    B1 -->|risk: anemic domain| R1["No behavior on entities"]
    B2 -->|risk: leaky ports| R2["Adapters import framework into domain"]
    B3 -->|risk: fat services| R3["Service does repo + AI + HTTP"]
    B4 -->|gap: no auth| R4["Guards/interceptors thin until auth lands"]
    B5 -->|risk: tight coupling| R5["Service imports LangChain directly"]
    B6 -->|risk: schema drift| R6["entity vs cache vs vector unsynced"]

    classDef bone fill:#0f172a,stroke:#f59e0b,color:#fff
    classDef risk fill:#7f1d1d,stroke:#fca5a5,color:#fff
    class B1,B2,B3,B4,B5,B6 bone
    class R1,R2,R3,R4,R5,R6 risk
```

## Component grouping (concern × type)

| Concern | Class | Interface/Port | Schema |
|---------|-------|----------------|--------|
| Domain | Conversation, Message | — | — |
| Persistence | TypeOrmConversationRepository, TypeOrmMessageRepository | IConversationRepository, IMessageRepository | entity/ (SQL) |
| AI | LangChainAiProvider | IAiProvider, IAiStrategy | — |
| Caching | SqliteCacheAdapter | ICachePort | cache/ (KV) |
| Retrieval | VectorStoreAdapter | IVectorPort | vector/ |
| Delivery | ChatController, ConversationController | IGuard, IInterceptor, ITransform | — |
| Strategy | Gpt4oMiniStrategy | — | — |
