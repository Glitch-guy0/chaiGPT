# Git Commit Plan — chaiGPT (main branch only)

Conventional-commit messages for landing the re-architecture on `main`, ordered so each step is independently reviewable and the build stays green.

```mermaid
gitGraph
    commit id: "init" tag: "v0.0.0"
    commit id: "feat(db): TypeORM entities + Postgres DataSource (v2: userId/parentId/status/Asset)"
    commit id: "feat(db): Postgres migrations; retire SQLite"
    commit id: "feat(services): ChatService/ConversationService/MessageService/AssetService"
    commit id: "feat(routes): Next.js route handlers delegating to services + Clerk middleware"
    commit id: "feat(ai): LangChain AiProvider with streaming"
    commit id: "feat(rag): asset pipeline + Qdrant via @langchain/qdrant"
    commit id: "feat(cache): Redis KV cache for RAG context reuse"
    commit id: "chore(types): shared lib/types, utils, validation schemas"
    commit id: "docs: architecture UML diagrams under planning-artifacts"
```

## Commit message table

| # | Scope | Type | Message |
|---|-------|------|---------|
| 1 | db | feat | TypeORM entities + Postgres DataSource (v2) |
| 2 | db | feat | Postgres migrations; retire SQLite |
| 3 | services | feat | Chat/Conversation/Message/Asset services |
| 4 | routes | feat | Next.js route handlers + Clerk middleware |
| 5 | ai | feat | LangChain AiProvider with streaming |
| 6 | rag | feat | asset pipeline + Qdrant via @langchain/qdrant |
| 7 | cache | feat | Redis KV cache for RAG context reuse |
| 8 | types | chore | shared lib/types, utils, validation schemas |
| 9 | docs | docs | architecture UML diagrams |
