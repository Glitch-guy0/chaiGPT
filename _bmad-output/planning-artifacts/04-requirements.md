# Requirements Diagram — chaiGPT Re-architecture

Captures functional + non-functional requirements and traces them to the planned architecture partitions. Items marked `satisfies` exist today; `verifies` are the new hexagonal goals.

```mermaid
requirementDiagram
    requirement Existing {
        id: REQ1
        text: Store conversations and messages (SQLite via TypeORM)
        risk: medium
        verifymethod: demonstration
    }
    requirement Existing {
        id: REQ2
        text: Stream chat completions via LangChain (SSE)
        risk: medium
        verifymethod: demonstration
    }
    requirement Existing {
        id: REQ3
        text: Validate inbound requests with Zod
        risk: low
        verifymethod: test
    }
    requirement New {
        id: REQ4
        text: Isolate domain from framework (hexagonal, no Next/TypeORM imports in domain)
        risk: medium
        verifymethod: inspection
    }
    requirement New {
        id: REQ5
        text: Swap AI provider without touching services (Open/Closed via IAiPort + plugins)
        risk: low
        verifymethod: test
    }
    requirement New {
        id: REQ6
        text: Add KV cache + vector store behind ports (scalability)
        risk: high
        verifymethod: demonstration
    }
    requirement NFR {
        id: NFR1
        text: SOLID compliance — single responsibility per layer
        risk: medium
        verifymethod: inspection
    }
    requirement NFR {
        id: NFR2
        text: Horizontal scale — stateless controllers, pluggable stores
        risk: high
        verifymethod: analysis
    }

    element Domain { type: component }
    element Services { type: component }
    element Adapters { type: component }
    element Controllers { type: component }
    element Schema { type: component }

    REQ1 -> Domain
    REQ1 -> Adapters
    REQ2 -> Services
    REQ2 -> Adapters
    REQ3 -> Controllers
    REQ4 -> Domain
    REQ5 -> Adapters
    REQ6 -> Schema
    NFR1 -> Services
    NFR2 -> Controllers

    REQ4 verifies REQ1
    REQ5 verifies REQ2
    NFR1 satisfies REQ4
```
