# Architecture Diagram — chaiGPT (Hexagonal / Interfaces & Adapters, v2)

The domain core is the hub. Inbound adapters (Next controllers, Clerk middleware/guard, interceptors, transformations) drive application services. Outbound adapters (Postgres repository, LangChain AI, Redis cache, Qdrant vector, asset filesystem) implement domain interfaces. `schema/` is the persistence contract layer (entity/cache/vector). Reflects PRD §9 v2 model.

```mermaid
flowchart TB
    subgraph client["Client (Browser)"]
        ui["React UI + hooks<br/>(useChat, useConversations)"]
    end

    subgraph inbound["Inbound Adapters (Interfaces)"]
        ctrl["Controllers<br/>(route handlers)"]
        mw["Middleware (Clerk)"]
        grd["Guards (ClerkGuard)"]
        intc["Interceptors"]
        trf["Transformations<br/>(DTO <-> Entity)"]
    end

    subgraph app["Application Layer (Services)"]
        svc["ChatService · ConversationService · MessageService · AssetService"]
    end

    subgraph domain["Domain Core (Pure)"]
        ent["Entities<br/>Conversation · Message · Asset"]
        interfaces["Interfaces (Contracts)<br/>IConversationRepository · IMessageRepository · IAssetRepository<br/>IAiProvider · ICacheInterface · IVectorInterface · IGuard"]
        domTypes["Domain Types"]
    end

    subgraph outbound["Outbound Adapters"]
        repoA["Repository Adapter<br/>(TypeORM + Postgres)"]
        aiA["AI Adapter<br/>(LangChain)"]
        cacheA["Cache Adapter<br/>(Redis KV)"]
        vecA["Vector Adapter<br/>(Qdrant)"]
        assetA["Asset Adapter<br/>(shared Docker volume)"]
        plug["Plugins<br/>(AI strategies)"]
    end

    subgraph persist["schema/ (Persistence Contracts)"]
        se["entity/ Postgres SQL"]
        sc["cache/ KV"]
        sv["vector/ Qdrant"]
    end

    ui -->|HTTP SSE| ctrl
    ctrl --> mw --> grd --> intc --> trf
    trf --> svc
    svc --> interfaces
    interfaces --> ent
    svc -.uses.-> repoA
    svc -.uses.-> aiA
    svc -.uses.-> cacheA
    svc -.uses.-> vecA
    svc -.uses.-> assetA
    plug -.configures.-> aiA
    repoA --> se
    cacheA --> sc
    vecA --> sv
    assetA --> vol[(Shared Docker Volume)]

    classDef core fill:#1f2937,stroke:#f59e0b,color:#fff
    classDef adapter fill:#334155,stroke:#38bdf8,color:#fff
    class domain core
    class repoA,aiA,cacheA,vecA,assetA,plug adapter
```
