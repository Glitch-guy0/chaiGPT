import { DataSource, Repository } from 'typeorm';
import { Message, MessageStatus } from '../entities/message.entity';

export type { MessageStatus };

export interface MessageRepository {
  findById(id: string, userId: string): Promise<Message | null>;
  findAll(userId: string): Promise<Message[]>;
  findByConversation(conversationId: string, userId: string): Promise<Message[]>;
  findLatestUserMessage(conversationId: string, userId: string): Promise<Message | null>;
  findTrailingAssistantMessage(conversationId: string, parentId: string, userId: string): Promise<Message | null>;
  save(m: Partial<Message>): Promise<Message>;
  updateStatus(id: string, status: MessageStatus, userId: string): Promise<void>;
}

export class MessageRepositoryImpl implements MessageRepository {
  private repo: Repository<Message>

  constructor(private ds: DataSource) {
    this.repo = ds.getRepository(Message)
  }

  async findById(id: string, userId: string): Promise<Message | null> {
    return this.repo.findOne({ where: { id, userId } })
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

  async save(m: Partial<Message>): Promise<Message> {
    return this.repo.save(m)
  }

  async updateStatus(id: string, status: MessageStatus, userId: string): Promise<void> {
    const result = await this.repo.update({ id, userId }, { status })
    if (result.affected === 0) throw new Error('Message not found')
  }
}
