import { Conversation } from "../entities/conversation.entity"

export type ConversationStatus = "active" | "archived" | "deleted"

export interface ConversationRepository {
  findById(id: string, userId: string): Promise<Conversation | null>
  findAll(userId: string): Promise<Conversation[]>
  save(conv: Conversation): Promise<Conversation>
  updateStatus(id: string, status: ConversationStatus): Promise<void>
}
