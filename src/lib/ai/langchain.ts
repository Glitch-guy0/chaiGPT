import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages"

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export class LangChainService {
  private chat: ChatOpenAI

  constructor() {
    this.chat = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.7,
      streaming: true,
    })
  }

  async *streamChat(
    messages: ChatMessage[],
    onChunk?: (chunk: string) => void
  ): AsyncGenerator<string, void, unknown> {
    const langchainMessages = messages.map((msg) => {
      if (msg.role === "user") {
        return new HumanMessage(msg.content)
      } else if (msg.role === "assistant") {
        return new AIMessage(msg.content)
      } else {
        return new SystemMessage(msg.content)
      }
    })

    const stream = await this.chat.stream(langchainMessages)

    for await (const chunk of stream) {
      const content = chunk.content as string
      if (onChunk) {
        onChunk(content)
      }
      yield content
    }
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    const langchainMessages = messages.map((msg) => {
      if (msg.role === "user") {
        return new HumanMessage(msg.content)
      } else if (msg.role === "assistant") {
        return new AIMessage(msg.content)
      } else {
        return new SystemMessage(msg.content)
      }
    })

    const response = await this.chat.invoke(langchainMessages)
    return response.content as string
  }
}

export const langChainService = new LangChainService()
