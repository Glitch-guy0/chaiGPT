import type { ChatMessage } from '@/types';

export interface AiProvider {
  complete(messages: ChatMessage[]): Promise<string>;
  streamChat(messages: ChatMessage[], onChunk: (token: string) => void): Promise<void>;
}
