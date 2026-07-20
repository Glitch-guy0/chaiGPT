import { Message, MessageStatus } from '../entities/message.entity';

export interface MessageRepository {
  findById(id: string, userId: string): Promise<Message | null>;
  findAll(userId: string): Promise<Message[]>;
  findByConversation(conversationId: string, userId: string): Promise<Message[]>;
  save(m: Partial<Message>): Promise<Message>;
  updateStatus(id: string, status: MessageStatus, userId: string): Promise<void>;
}
