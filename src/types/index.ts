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

export interface Citation {
  chunkId: string;
  assetId: string;
  score: number;
  snippet: string;
  url?: string;
  title?: string;
}

export interface ChatResponse {
  id: string;
  content: string;
  conversationId: string;
  model?: string;
  citations?: Citation[];
  ragDegraded?: boolean;
}
