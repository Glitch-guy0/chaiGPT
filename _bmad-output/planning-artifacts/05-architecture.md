# Architecture Diagram — chaiGPT (Layered, Next.js + TypeORM, v2)

Tightly integrated with Next.js (App Router, route handlers, middleware) and TypeORM (entities, repositories, migrations). Separation is by concern — routes → services → data/integrations — with **no port/adapter abstraction** to decouple frameworks. Reflects PRD §9 v2 model.

```mermaid
flowchart TB
    subgraph client["Client (Browser)"]
        ui["React UI + hooks<br/>(useChat, useConversations)"]
    end

    subgraph routes["Next.js App Router (src/app)"]
        ctrl["Route handlers<br/>chat / conversations / assets"]
        mw["middleware.ts<br/>(Clerk session)"]
    end

    subgraph services["Services (src/services)"]
        svc["ChatService · ConversationService<br/>MessageService · AssetService"]
    end

    subgraph data["Data — TypeORM (src/lib/db)"]
        ent["Entities<br/>Conversation · Message · Asset"]
        repo["Repositories<br/>Conversation/Message/Asset"]
        ds["DataSource (Postgres)"]
    end

    subgraph integ["Integrations (src/lib)"]
        ai["ai/langchain.ts<br/>(ChatOpenAI, stream)"]
        vec["vector/qdrant.ts<br/>(@langchain/qdrant)"]
        ws["websearch/jina.ts + webSearchTool.ts<br/>(Jina AI + LangChain tool, FR-24..FR-28)"]
        cache["cache/redis.ts<br/>(Redis KV)"]
        auth["auth/session.ts<br/>(Clerk auth())"]
    end

    subgraph test["Testing (cross-cutting)"]
        vitest["Vitest unit tests<br/>(mocked externals, ≥80% coverage, FR-29..FR-31)"]
        playwright["Playwright e2e<br/>(Docker Compose, smoke gating CI, FR-32..FR-34)"]
    end

    subgraph persist["schema/ (Persistence Contracts)"]
        se["entity/ Postgres SQL"]
        sc["cache/ KV"]
        sv["vector/ Qdrant"]
    end

    ui -->|HTTP SSE| ctrl
    mw --> ctrl
    ctrl --> svc
    svc --> repo
    svc --> ai
    svc --> vec
    svc --> ws
    svc --> cache
    svc --> auth
    vec --> Q[("Qdrant")]
    ws --> JINA[("Jina AI API")]
    cache --> RED[("Redis")]
    vitest -.-> svc
    vitest -.-> integ
    playwright -.->|"docker compose"| PG
    playwright -.->|"docker compose"| Q

    classDef core fill:#1f2937,stroke:#f59e0b,color:#fff
    classDef integ fill:#334155,stroke:#38bdf8,color:#fff
    classDef test fill:#065f46,stroke:#34d399,color:#fff
    class data core
    class ai,vec,ws,cache,auth integ
    class vitest,playwright test
```
