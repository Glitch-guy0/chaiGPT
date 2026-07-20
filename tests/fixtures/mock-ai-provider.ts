import type { AiProvider } from "@/lib/ai/langchain";
import type { ChatMessage } from "@/types";

export class MockAiProvider implements AiProvider {
  private completeFn: (messages: ChatMessage[]) => Promise<string>;
  private streamFn: (
    messages: ChatMessage[],
    onChunk: (token: string) => void,
  ) => Promise<void>;

  constructor() {
    this.completeFn = async () => "mock completion response";
    this.streamFn = async (_msgs, onChunk) => {
      onChunk("mock ");
      onChunk("token");
    };
  }

  onComplete(fn: (messages: ChatMessage[]) => Promise<string>) {
    this.completeFn = fn;
  }

  onStream(
    fn: (
      messages: ChatMessage[],
      onChunk: (token: string) => void,
    ) => Promise<void>,
  ) {
    this.streamFn = fn;
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    return this.completeFn(messages);
  }

  async streamChat(
    messages: ChatMessage[],
    onChunk: (token: string) => void,
  ): Promise<void> {
    return this.streamFn(messages, onChunk);
  }
}
