import { Conversation } from '../lib/db/entities/conversation.entity';
import { ConversationRepository } from '../lib/db/repositories/conversation.repository';
import { generateId } from '../lib/utils';
import { MessageRepository } from '../lib/db/repositories/message.repository';
import { Message } from '../lib/db/entities/message.entity';

export interface IConversationService {
  list(userId: string): Promise<Conversation[]>;
  create(userId: string, input: any): Promise<Conversation>;
  getById(id: string, userId: string): Promise<Conversation | null>;
  branch(id: string, messageId: string, userId: string): Promise<Conversation>;
}

export class ConversationService implements IConversationService {
  private repo = new ConversationRepository();

  async list(userId: string): Promise<Conversation[]> {
    return this.repo.findAll(userId);
  }

  async create(userId: string, input: any): Promise<Conversation> {
    const conv = new Conversation();
    conv.id = generateId();
    conv.userId = userId;
    conv.title = input.title || 'New Chat';
    conv.model = input.model || 'gpt-4o-mini';
    return this.repo.save(conv);
  }

  async getById(id: string, userId: string): Promise<Conversation | null> {
    const conv = await this.repo.findById(id, userId);
    if (!conv) {
      const error: any = new Error('Not found');
      error.status = 404;
      throw error;
    }
    return conv;
  }

  async branch(id: string, messageId: string, userId: string): Promise<Conversation> {
    const parentConv = await this.getById(id, userId);
    if (!parentConv) throw new Error('Conversation not found');

    const msgRepo = new MessageRepository();

    const messages = await msgRepo.findByConversation(id, userId);
    const branchPointIndex = messages.findIndex((m: any) => m.id === messageId);
    if (branchPointIndex === -1) throw new Error('Message not found in conversation');

    const branchPointMsg = messages[branchPointIndex];
    if (branchPointMsg.role !== 'assistant') {
      throw new Error('Branching is only supported from assistant messages');
    }

    // Create new Conversation
    const conv = new Conversation();
    conv.id = generateId();
    conv.userId = userId;
    conv.title = parentConv.title + ' (Branch)';
    conv.model = parentConv.model;
    conv.rootConversationId = parentConv.rootConversationId || parentConv.id;
    await this.repo.save(conv);

    // Deep copy messages up to the branch point
    let lastCopiedId: string | null = null;
    let oldIdToNewId = new Map<string, string>();

    for (let i = 0; i <= branchPointIndex; i++) {
      const oldMsg = messages[i];

      const newMsg = new Message();
      newMsg.id = generateId();
      newMsg.conversationId = conv.id;
      newMsg.userId = userId;
      newMsg.role = oldMsg.role;
      newMsg.content = oldMsg.content;
      newMsg.status = oldMsg.status;
      newMsg.model = oldMsg.model;
      newMsg.parentId = oldMsg.parentId ? (oldIdToNewId.get(oldMsg.parentId) || null) : null;

      await msgRepo.save(newMsg as Message);
      oldIdToNewId.set(oldMsg.id, newMsg.id);
      lastCopiedId = newMsg.id;
    }

    if (lastCopiedId) {
      conv.lastMessageId = lastCopiedId;
      await this.repo.save(conv);
    }

    return conv;
  }
}
