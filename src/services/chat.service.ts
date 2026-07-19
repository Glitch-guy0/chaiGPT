export interface ChatRequest {
  conversationId: string
  content: string
  model?: string
}

export interface ChatResponse {
  messageId: string
  content: string
  model: string
}

export interface ChatService {
  send(req: ChatRequest, userId: string): Promise<ChatResponse>
  regenerate(messageId: string, userId: string): Promise<ChatResponse>
}
