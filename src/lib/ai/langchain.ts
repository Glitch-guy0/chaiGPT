import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages"
import type { DynamicTool } from "@langchain/core/tools"
import type { Runnable } from "@langchain/core/runnables"
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base"
import type { AIMessageChunk } from "@langchain/core/messages"
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
  private boundChat: Runnable<BaseLanguageModelInput, AIMessageChunk> | null =
    null

  constructor(modelName?: string) {
    this.chat = new ChatOpenAI({
      modelName: modelName ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
      temperature: 0.7,
      streaming: true,
    })
  }

  bindTools(tools: DynamicTool[]): void {
    this.boundChat = this.chat.bindTools(tools)
  }

  private invokeChat(messages: Message[]) {
    const langchainMessages = toLangChainMessages(messages)
    const target = this.boundChat ?? this.chat
    return target.invoke(langchainMessages)
  }

  private streamChatTarget(messages: Message[]) {
    const langchainMessages = toLangChainMessages(messages)
    const target = this.boundChat ?? this.chat
    return target.stream(langchainMessages)
  }

  async complete(messages: Message[]): Promise<string> {
    const response = await this.invokeChat(messages)
    return response.content as string
  }

  async streamChat(
    messages: Message[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const stream = await this.streamChatTarget(messages)

    for await (const chunk of stream) {
      const content = chunk.content as string
      onChunk(content)
    }
  }

  async *streamChatGen(
    messages: Message[]
  ): AsyncGenerator<string, void, unknown> {
    const stream = await this.streamChatTarget(messages)

    for await (const chunk of stream) {
      yield chunk.content as string
    }
  }
}

export const aiProvider = new LangChainAiProvider()
