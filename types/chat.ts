export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: Date
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

export interface ChatRequest {
  messages: Message[]
  model?: string
}

export interface ChatResponse {
  id: string
  content: string
  conversationId: string
}
