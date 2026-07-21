import { DataSource, Repository } from 'typeorm';
import { Message, MessageStatus } from '../entities/message.entity';

export type { MessageStatus };

export interface MessageRepository {
  findById(id: string, userId: string): Promise<Message | null>;
  findByIdInConversation(id: string, conversationId: string, userId: string): Promise<Message | null>;
  findAll(userId: string): Promise<Message[]>;
  findByConversation(conversationId: string, userId: string): Promise<Message[]>;
  findLatestUserMessage(conversationId: string, userId: string): Promise<Message | null>;
  findTrailingAssistantMessage(conversationId: string, parentId: string, userId: string): Promise<Message | null>;
  findLatestSibling(parentId: string, conversationId: string, userId: string): Promise<Message | null>;
  findSiblingsByParentId(parentId: string, conversationId: string, userId: string): Promise<Message[]>;
  findByParentId(parentId: string, userId: string): Promise<Message[]>;
  findMessageChain(conversationId: string, fromMessageId: string, userId: string): Promise<Message[]>;
  save(m: Partial<Message>): Promise<Message>;
  updateStatus(id: string, status: MessageStatus, userId: string): Promise<void>;
  tryStartRegenerate(id: string, userId: string): Promise<boolean>;
  removeAssetId(messageId: string, assetId: string, userId: string): Promise<void>;
}

export class MessageRepositoryImpl implements MessageRepository {
  private repo: Repository<Message>

  constructor(private ds: DataSource) {
    this.repo = ds.getRepository(Message)
  }

  async findById(id: string, userId: string): Promise<Message | null> {
    return this.repo.findOne({ where: { id, userId } })
  }

  async findByIdInConversation(id: string, conversationId: string, userId: string): Promise<Message | null> {
    return this.repo.findOne({ where: { id, conversationId, userId } })
  }

  async findAll(userId: string): Promise<Message[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 })
  }

  async findByConversation(conversationId: string, userId: string): Promise<Message[]> {
    return this.repo.find({ where: { conversationId, userId }, order: { createdAt: 'ASC' } })
  }

  async findLatestUserMessage(conversationId: string, userId: string): Promise<Message | null> {
    return this.repo.findOne({ where: { conversationId, userId, role: 'user' }, order: { createdAt: 'DESC' } })
  }

  async findTrailingAssistantMessage(conversationId: string, parentId: string, userId: string): Promise<Message | null> {
    return this.repo.findOne({ where: { conversationId, userId, parentId, role: 'assistant' }, order: { createdAt: 'DESC' } })
  }

  async findLatestSibling(parentId: string, conversationId: string, userId: string): Promise<Message | null> {
    return this.repo.findOne({ where: { parentId, conversationId, userId }, order: { createdAt: 'DESC', id: 'DESC' } })
  }

  async findSiblingsByParentId(parentId: string, conversationId: string, userId: string): Promise<Message[]> {
    return this.repo.find({ where: { parentId, conversationId, userId }, order: { createdAt: 'ASC', id: 'ASC' } })
  }

  async findByParentId(parentId: string, userId: string): Promise<Message[]> {
    return this.repo.find({ where: { parentId, userId } })
  }

  async findMessageChain(conversationId: string, fromMessageId: string, userId: string): Promise<Message[]> {
    const start = await this.repo.findOne({ where: { id: fromMessageId, conversationId, userId } });
    if (!start) return [];

    const result: Message[] = [];
    let current: string | undefined = fromMessageId;
    let guard = 0;
    while (current && guard++ < 500) {
      const msg = await this.repo.findOne({ where: { id: current, conversationId, userId } });
      if (!msg) {
        console.warn(`findMessageChain: orphaned parent ${current}`);
        break;
      }
      result.unshift(msg);
      if (!msg.parentId) break;
      current = msg.parentId;
    }
    return result;
  }

  async save(m: Partial<Message>): Promise<Message> {
    return this.repo.save(m)
  }

  async updateStatus(id: string, status: MessageStatus, userId: string): Promise<void> {
    const result = await this.repo.update({ id, userId }, { status })
    if (result.affected === 0) throw new Error('Message not found')
  }

  async tryStartRegenerate(id: string, userId: string): Promise<boolean> {
    const result = await this.repo.update(
      { id, userId, role: 'assistant', status: 'stopped' },
      { status: 'processing' }
    )
    return (result.affected ?? 0) > 0
  }

  async removeAssetId(messageId: string, assetId: string, userId: string): Promise<void> {
    const msg = await this.repo.findOne({ where: { id: messageId, userId } })
    if (!msg) throw new Error('Message not found')

    msg.assetIds = (msg.assetIds ?? []).filter((id) => id !== assetId)
    await this.repo.save(msg)
  }
}
