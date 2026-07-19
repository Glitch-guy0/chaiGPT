# Component Architecture — Ishikawa (Fishbone) by Concern & Type

Root-cause / concern analysis grouped by category. Each bone is a partition; effects are the risks the architecture must resolve or the value it delivers.

```mermaid
flowchart LR
    subgraph head["Scalable chaiGPT (Next.js + TypeORM)"]
        EFF["Effect:<br/>Coupled but simple; scale via external stores"]
    end

    subgraph bones[""]
        direction TB
        B1["Routes & Auth"] -->|app router, middleware, Clerk| EFF
        B2["Services"] -->|use-case logic| EFF
        B3["Data (TypeORM)"] -->|entities, repositories, migrations| EFF
        B4["Integrations"] -->|LangChain, Qdrant, Redis| EFF
        B5["Shared"] -->|types, utils, validation| EFF
        B6["Persistence Schema"] -->|entity SQL, cache KV, vector| EFF
    end

    B1 -->|risk: auth gaps| R1["Unauthenticated data access"]
    B2 -->|risk: fat services| R2["Service does repo + AI + HTTP"]
    B3 -->|risk: migration drift| R3["Schema vs entities unsynced"]
    B4 -->|risk: tight coupling| R4["Service imports LangChain directly"]
    B6 -->|risk: schema drift| R5["entity vs cache vs vector unsynced"]

    classDef bone fill:#0f172a,stroke:#f59e0b,color:#fff
    classDef risk fill:#7f1d1d,stroke:#fca5a5,color:#fff
    class B1,B2,B3,B4,B5,B6 bone
    class R1,R2,R3,R4,R5 risk
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
