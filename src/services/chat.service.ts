import type { ChatRequest, ChatResponse } from '@/types';

export interface ChatService {
  send(req: ChatRequest, userId: string): Promise<ChatResponse>;
  stream(req: ChatRequest, onChunk: (chunk: string) => void): Promise<void>;
  regenerate(messageId: string, userId: string): Promise<void>;
}
