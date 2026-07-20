import { Conversation } from '../lib/db/entities/conversation.entity';
import { Message, Role, MessageStatus } from '../lib/db/entities/message.entity';
import { Asset } from '../lib/db/entities/asset.entity';

export type { Conversation, Message, Role, MessageStatus, Asset };

export interface ChatRequest {
  conversationId: string;
  content: string;
}

export interface ChatResponse {
  message: Message;
}
