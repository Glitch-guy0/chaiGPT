# Object Diagram — chaiGPT Runtime Instances

Snapshots of live objects during a chat request, showing concrete adapter instances wired to services (dependency injection at runtime).

```mermaid
flowchart TD
    subgraph req["Chat POST request"]
        cr["ChatRequest{<br/>messages: [user:'hi'],<br/>conversationId: 'c1'}"]
    end

    subgraph svc["Runtime wiring"]
        chatSvc["ChatService instance"]
        convRepo["TypeOrmConversationRepository<br/>(ds=AppDataSource)"]
        msgRepo["TypeOrmMessageRepository<br/>(ds=AppDataSource)"]
        aiProv["LangChainAiProvider<br/>(chat=ChatOpenAI gpt-4o-mini)"]
        strat["Gpt4oMiniStrategy"]
    end

    subgraph data["Live entities"]
        conv["Conversation{ id:'c1', title:'hi' }"]
        m1["Message{ role:'user', content:'hi' }"]
        m2["Message{ role:'assistant', content:'...' }"]
        resp["ChatResponse{ id, content, conversationId:'c1' }"]
    end

    cr --> chatSvc
    chatSvc --> convRepo
    chatSvc --> msgRepo
    chatSvc --> aiProv
    aiProv --> strat
    convRepo --> conv
    msgRepo --> m1
    msgRepo --> m2
    aiProv --> resp
```
