# Requirements Diagram — chaiGPT Re-architecture

Captures functional + non-functional requirements and traces them to the planned architecture partitions. Architecture is a layered Next.js + TypeORM structure (tight integration, no port/adapter decoupling).

```mermaid
requirementDiagram
    functionalRequirement REQ1 {
        id: 1
        text: Store conversations and messages via Postgres and TypeORM
        risk: high
        verifymethod: demonstration
    }
    functionalRequirement REQ2 {
        id: 2
        text: Stream chat completions via LangChain using SSE
        risk: high
        verifymethod: demonstration
    }
    functionalRequirement REQ3 {
        id: 3
        text: Validate inbound requests with Zod
        risk: low
        verifymethod: test
    }
    functionalRequirement REQ4 {
        id: 4
        text: Layered structure with Next.js routes services and TypeORM repositories
        risk: medium
        verifymethod: inspection
    }
    functionalRequirement REQ5 {
        id: 5
        text: Swap AI model via the LangChain AiProvider module without rewriting services
        risk: low
        verifymethod: test
    }
    functionalRequirement REQ6 {
        id: 6
        text: Add KV cache and vector store via Redis and Qdrant for scalability
        risk: high
        verifymethod: demonstration
    }
    performanceRequirement NFR1 {
        id: 7
        text: SOLID compliance with single responsibility per layer
        risk: medium
        verifymethod: inspection
    }
    performanceRequirement NFR2 {
        id: 8
        text: Horizontal scale with stateless route handlers and externalized stores
        risk: high
        verifymethod: analysis
    }

    element Routes {
        type: module
        docRef: "src/app"
    }
    element Services {
        type: module
        docRef: "src/services"
    }
    element Data {
        type: module
        docRef: "src/lib/db"
    }
    element Integrations {
        type: module
        docRef: "src/lib"
    }
    element Schema {
        type: module
        docRef: "schema"
    }

    Routes - satisfies -> REQ4
    Services - satisfies -> REQ2
    Services - satisfies -> NFR1
    Data - satisfies -> REQ1
    Integrations - satisfies -> REQ5
    Integrations - satisfies -> REQ6
    Routes - satisfies -> REQ3
    Routes - satisfies -> NFR2
    Schema - satisfies -> REQ6

    REQ4 - verifies -> REQ1
    REQ5 - verifies -> REQ2
    NFR1 - satisfies -> REQ4
```
