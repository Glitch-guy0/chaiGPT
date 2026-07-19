# Architecture Diagram — chaiGPT (Hexagonal / Ports & Adapters)

The domain core is the hub. Inbound adapters (Next controllers, middleware, guards, interceptors) drive application services. Outbound adapters (repository, AI, cache, vector) implement domain ports. `schema/` is the persistence contract layer.

```mermaid
flowchart TB
    subgraph client["Client (Browser)"]
        ui["React UI + hooks<br/>(useChat, useConversations)"]
    end

    subgraph inbound["Inbound Adapters (Interfaces)"]
        ctrl["Controllers<br/>(route handlers)"]
        mw["Middleware"]
        grd["Guards"]
        intc["Interceptors"]
        trf["Transformations<br/>(DTO <-> Entity)"]
    end

    subgraph app["Application Layer (Services)"]
        svc["ChatService · ConversationService · MessageService"]
    end

    subgraph domain["Domain Core (Pure)"]
        ent["Entities<br/>Conversation · Message"]
        ports["Ports (Interfaces)<br/>IConversationRepository · IMessageRepository<br/>IAiProvider · ICachePort · IVectorPort"]
        domTypes["Domain Types"]
    end

    subgraph outbound["Outbound Adapters"]
        repoA["Repository Adapter<br/>(TypeORM + SQLite)"]
        aiA["AI Adapter<br/>(LangChain)"]
        cacheA["Cache Adapter<br/>(KV)"]
        vecA["Vector Adapter"]
        plug["Plugins<br/>(AI strategies)"]
    end

    subgraph persist["schema/ (Persistence Contracts)"]
        se["entity/ SQL"]
        sc["cache/ KV"]
        sv["vector/"]
    end

    ui -->|HTTP SSE| ctrl
    ctrl --> mw --> grd --> intc --> trf
    trf --> svc
    svc --> ports
    ports --> ent
    svc -.uses.-> repoA
    svc -.uses.-> aiA
    svc -.uses.-> cacheA
    svc -.uses.-> vecA
    plug -.configures.-> aiA
    repoA --> se
    cacheA --> sc
    vecA --> sv

    classDef core fill:#1f2937,stroke:#f59e0b,color:#fff
    classDef adapter fill:#334155,stroke:#38bdf8,color:#fff
    class domain core
    class repoA,aiA,cacheA,vecA,plug adapter
```
