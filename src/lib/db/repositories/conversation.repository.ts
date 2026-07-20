import { Conversation } from '../entities/conversation.entity';

export interface ConversationRepository {
  findById(id: string, userId: string): Promise<Conversation | null>;
  findAll(userId: string): Promise<Conversation[]>;
  save(c: Partial<Conversation>): Promise<Conversation>;
  branch(id: string, messageId: string, userId: string): Promise<Conversation>;
}
