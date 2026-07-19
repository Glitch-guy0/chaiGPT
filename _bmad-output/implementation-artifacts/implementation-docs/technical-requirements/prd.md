# Technical Requirements Specification

## Functional Requirements

### Core Dependencies
- Next.js App Router (App Router route handlers, Clerk middleware)
- TypeORM (entities, migrations, repositories)
- LangChain integration for AI service
- Qdrant vector store for document embedding
- Jina AI Search API for live web context

### Service Layer Responsibilities
- ChatService: handles message streaming, regeneration, and asset reference
- ConversationService: manages conversation tree and branching
- AssetService: handles file upload, storage, and deletion

### Data Layer
- TypeORM entities: conversation, message, asset
- Qdrant collections: one per conversation for vector storage
- Redis cache: session state and token streaming

### Technology Stack
- Frontend: Tailwind v4 + shadcn/ui
- Backend: Next.js 16 + TypeORM 1.0
- Search: Jina AI Search API
- AI: OpenAI (with LangChain wrapper)

### Dependencies Diagram
```mermaid
graph LR
App -> ChatService -> Repositories
App -> VectorStore (Qdrant)
App -> AIProvider (LangChain)
ChatService -> WebSearchProvider
```

## Non-Functional Requirements

### Performance
- RAG retrieval: <300ms (p95)
- Streaming: <1s TTFB
- Web search: <1.5s (p95)

### Dependability
- Schema versioning for Qdrant
- Redis cache invalidation strategy
- Graceful degradation for failed Jina API

### Security
- Clerk auth token handling
- Input validation via Zod schemas
- Rate limiting on Jina API

## API Contracts
```json
// ChatRequest Schema
{
  "userId": "string",
  "content": "string",
  "branch": "boolean"
}

// ChatResponse Schema
{
  "status": "string", // processing/complete/stopped
  "content": "string",
  "assetReferences": "array"
}
```