export type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  conversationId?: string;
}

export interface ChatResponse {
  id: string;
  content: string;
  conversationId: string;
  model?: string;
}
