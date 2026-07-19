# Object Diagram — chaiGPT Runtime Instances

Snapshots of live objects during a chat request, showing concrete instances wired to services (dependency injection at runtime). The `AiProvider` is a LangChain extension wrapping the OpenAI provider (`ChatOpenAI`); there is no separate strategy/port layer.

```mermaid
flowchart TD
    subgraph req["Chat POST request"]
        cr["ChatRequest{ messages: [user:'hi'], conversationId: 'c1'}"]
    end

    subgraph svc["Runtime wiring"]
        chatSvc["ChatService instance"]
        convRepo["TypeOrmConversationRepository \(ds=AppDataSource\)"]
        msgRepo["TypeOrmMessageRepository \(ds=AppDataSource\)"]
        aiProv["AiProvider \(LangChain extension over OpenAI ChatOpenAI\)"]
        jinaProv["JinaProvider \(apiKey: JINA_API_KEY\)"]
        wsTool["WebSearchTool \(registered on AiProvider/agent\)"]
    end

    subgraph data["Live entities"]
        conv["Conversation{ id:'c1', title:'hi' }"]
        m1["Message{ role:'user', content:'hi' }"]
        m2["Message{ role:'assistant', content:'...' }"]
        resp["ChatResponse{ id, content, conversationId:'c1' }"]
    end

    subgraph test["Test harness (FR-30)"]
        mockJina["MockJinaProvider"]
        mockVec["MockQdrantStore"]
        mockAi["MockAiProvider"]
        vitest["vitestRunner"]
        pw["playwrightRunner"]
    end

    cr --> chatSvc
    chatSvc --> convRepo
    chatSvc --> msgRepo
    chatSvc --> aiProv
    aiProv --> wsTool
    wsTool --> jinaProv
    jinaProv --> JINA["Jina AI API"]
    convRepo --> conv
    msgRepo --> m1
    msgRepo --> m2
    aiProv --> resp

    vitest -.-> mockJina
    vitest -.-> mockVec
    vitest -.-> mockAi
    pw -.-> chatSvc
```
