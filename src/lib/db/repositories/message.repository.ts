import { Message } from "../entities/message.entity"

export type MessageStatus = "pending" | "sent" | "failed"

export interface MessageRepository {
  findById(id: string, userId: string): Promise<Message | null>
  findByConversation(convId: string, userId: string): Promise<Message[]>
  save(msg: Message): Promise<Message>
  updateStatus(id: string, status: MessageStatus): Promise<void>
}
