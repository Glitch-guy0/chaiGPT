import { Message } from '../lib/db/entities/message.entity';

export interface MessageService {
  append(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string
  ): Promise<Message>;
  history(conversationId: string): Promise<Message[]>;
  editLatest(userId: string, conversationId: string, content: string): Promise<Message>;
}
