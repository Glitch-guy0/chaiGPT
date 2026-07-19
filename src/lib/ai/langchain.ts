import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages"
import type { AiProvider } from "./provider"
import type { Message } from "@/lib/validation/schemas"

const DEFAULT_MODEL = "gpt-4o-mini"

function toLangChainMessages(messages: Message[]) {
  return messages.map((msg) => {
    if (msg.role === "user") {
      return new HumanMessage(msg.content)
    } else if (msg.role === "assistant") {
      return new AIMessage(msg.content)
    } else {
      return new SystemMessage(msg.content)
    }
  })
}

export class LangChainAiProvider implements AiProvider {
  private chat: ChatOpenAI

  constructor(modelName?: string) {
    this.chat = new ChatOpenAI({
      modelName: modelName ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
      temperature: 0.7,
      streaming: true,
    })
  }

  async complete(messages: Message[]): Promise<string> {
    const langchainMessages = toLangChainMessages(messages)
    const response = await this.chat.invoke(langchainMessages)
    return response.content as string
  }

  async streamChat(
    messages: Message[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const langchainMessages = toLangChainMessages(messages)
    const stream = await this.chat.stream(langchainMessages)

    for await (const chunk of stream) {
      const content = chunk.content as string
      onChunk(content)
    }
  }

  async *streamChatGen(
    messages: Message[]
  ): AsyncGenerator<string, void, unknown> {
    const langchainMessages = toLangChainMessages(messages)
    const stream = await this.chat.stream(langchainMessages)

    for await (const chunk of stream) {
      yield chunk.content as string
    }
  }
}

export const aiProvider = new LangChainAiProvider()
