import type { Message } from "@/lib/validation/schemas"

export interface AiProvider {
  complete(messages: Message[]): Promise<string>
  streamChat(
    messages: Message[],
    onChunk: (chunk: string) => void
  ): Promise<void>
}
