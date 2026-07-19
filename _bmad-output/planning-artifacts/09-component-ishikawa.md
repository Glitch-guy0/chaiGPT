# Component Architecture — Ishikawa (Fishbone) by Concern & Type

Root-cause / concern analysis grouped by category. Each bone is a partition; effects are the risks the architecture must resolve or the value it delivers.

```mermaid
flowchart LR
    EFF["Effect: Coupled but simple; scale via external stores"]

    B1["Routes & Auth<br/>(app router, middleware, Clerk)"]
    B2["Services<br/>(use-case logic)"]
    B3["Data / TypeORM<br/>(entities, repositories, migrations)"]
    B4["Integrations<br/>(LangChain, Qdrant, Redis)"]
    B5["Shared<br/>(types, utils, validation)"]
    B6["Persistence Schema<br/>(entity SQL, cache KV, vector)"]

    B1 -->|app router, middleware, Clerk| EFF
    B2 -->|use-case logic| EFF
    B3 -->|entities, repositories, migrations| EFF
    B4 -->|LangChain, Qdrant, Redis| EFF
    B5 -->|types, utils, validation| EFF
    B6 -->|entity SQL, cache KV, vector| EFF

    R1["Unauthenticated data access"]
    R2["Service does repo + AI + HTTP"]
    R3["Schema vs entities unsynced"]
    R4["Service imports LangChain directly"]
    R5["entity vs cache vs vector unsynced"]

    B1 -.->|risk: auth gaps| R1
    B2 -.->|risk: fat services| R2
    B3 -.->|risk: migration drift| R3
    B4 -.->|risk: tight coupling| R4
    B6 -.->|risk: schema drift| R5

    classDef bone fill:#0f172a,stroke:#f59e0b,color:#fff
    classDef risk fill:#7f1d1d,stroke:#fca5a5,color:#fff
    classDef effect fill:#111827,stroke:#22d3ee,color:#fff
    class B1,B2,B3,B4,B5,B6 bone
    class R1,R2,R3,R4,R5 risk
    class EFF effect
```

## Component grouping (concern × type)

| Concern | Class | Integration | Schema |
|---------|-------|-------------|--------|
| Routes & Auth | ChatRoute, ConversationsRoute, AssetsRoute | Clerk (`auth()`) | — |
| Services | ChatService, ConversationService, MessageService, AssetService | — | — |
| Data | ConversationRepository, MessageRepository, AssetRepository | TypeORM → Postgres | entity/ (SQL) |
| AI | AiProvider | LangChain `ChatOpenAI` | — |
| Retrieval | QdrantStore | `@langchain/qdrant` | vector/ |
| Cache | RedisCache | Redis | cache/ (KV) |
| Shared | utils, validation schemas | — | — |
