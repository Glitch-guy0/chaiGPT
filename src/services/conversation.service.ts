import { Conversation } from '../lib/db/entities/conversation.entity';

export interface ConversationService {
  list(userId: string): Promise<Conversation[]>;
  create(
    userId: string,
    input: { title?: string; model?: string }
  ): Promise<Conversation>;
  getById(id: string, userId: string): Promise<Conversation | null>;
  branch(id: string, messageId: string, userId: string): Promise<Conversation>;
}
