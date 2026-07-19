# Package Diagram — chaiGPT (Target Hexagonal Architecture)

Planned package structure. The **domain** package has zero framework imports. Adapters depend on the domain ports, never the reverse.

## Package Tree

```mermaid
flowchart TD
    subgraph app["src/app (Next.js Interface / Inbound)"]
        routes["api/**/route.ts<br/>(Controllers)"]
        layout["layout.tsx / page.tsx<br/>(UI Shell)"]
    end

    subgraph interfaces["src/interfaces"]
        controllers["controllers/"]
        middleware["middleware/"]
        guards["guards/"]
        interceptors["interceptors/"]
        transformations["transformations/"]
    end

    subgraph appLayer["src/services (Application)"]
        convSvc["ConversationService"]
        chatSvc["ChatService"]
        msgSvc["MessageService"]
    end

    subgraph domain["src (Domain Core)"]
        entities["entities/"]
        ports["interfaces/<br/>(repository ports)"]
        types["types/"]
    end

    subgraph adapters["src/adapters"]
        repoAdapter["repository/<br/>(TypeORM impl)"]
        aiAdapter["ai/<br/>(LangChain impl)"]
        cacheAdapter["cache/"]
        vectorAdapter["vector/"]
    end

    subgraph plugins["src/plugins"]
        aiPlugins["ai-strategies/"]
    end

    subgraph lib["src/lib"]
        utils["utils/"]
        libIface["interfaces/"]
        libTypes["types/"]
    end

    subgraph schema["schema/ (Persistence Contracts)"]
        entSchema["entity/ (SQL)"]
        cacheSchema["cache/ (KV)"]
        vecSchema["vector/"]
    end

    routes --> interfaces
    interfaces --> appLayer
    appLayer --> domain
    appLayer --> adapters
    adapters --> domain
    appLayer --> plugins
    plugins --> domain
    domain --> lib
    schema -.defines.-> adapters
```

## Package Dependencies (allowed direction)

```mermaid
flowchart LR
    A[app / controllers] -->|calls| B[services]
    B -->|uses ports| C[domain interfaces]
    B -->|persists via| D[adapters.repository]
    B -->|generates via| E[adapters.ai]
    D -->|implements| C
    E -->|implements| F[ai port]
    G[lib / types / interfaces] --> C
    H[schema] -.contract.-> D
    H -.contract.-> I[adapters.cache]
    H -.contract.-> J[adapters.vector]
```
