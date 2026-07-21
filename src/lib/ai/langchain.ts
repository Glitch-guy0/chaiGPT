import { ChatOpenAI } from '@langchain/openai';
import type { ChatMessage } from '@/types';

export const DEFAULT_MODEL = process.env.OPENAI_MODEL_NAME || process.env.OPENAI_MODEL || 'gpt-4o-mini';

export interface AiProvider {
  complete(messages: ChatMessage[]): Promise<string>;
  streamChat(messages: ChatMessage[], onChunk: (token: string) => void): Promise<void>;
}

export class OpenAiProvider implements AiProvider {
  private model: ChatOpenAI;

  constructor(modelName?: string) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY environment variable is required. ' +
        'Set it in your .env.local file or environment.',
      );
    }
    const resolvedModel = modelName || process.env.OPENAI_MODEL_NAME || process.env.OPENAI_MODEL || DEFAULT_MODEL;
    const baseUrl = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE;

    this.model = new ChatOpenAI({
      modelName: resolvedModel,
      configuration: baseUrl ? { baseURL: baseUrl } : undefined,
    });
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    const res = await this.model.invoke(
      messages.map(m => ({ role: m.role, content: m.content })),
    );
    return typeof res.content === 'string' ? res.content : '';
  }

  async streamChat(
    messages: ChatMessage[],
    onChunk: (token: string) => void,
  ): Promise<void> {
    const stream = await this.model.stream(
      messages.map(m => ({ role: m.role, content: m.content })),
    );
    for await (const chunk of stream) {
      if (typeof chunk.content === 'string') {
        onChunk(chunk.content);
      }
    }
  }
}
