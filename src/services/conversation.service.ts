import { Conversation } from "@/lib/db/entities/conversation.entity"

export interface CreateConversationInput {
  title: string
  model?: string
}

export interface ConversationService {
  list(userId: string): Promise<Conversation[]>
  create(userId: string, input: CreateConversationInput): Promise<Conversation>
  getById(id: string, userId: string): Promise<Conversation | null>
  branch(id: string, messageId: string, userId: string): Promise<Conversation>
}
