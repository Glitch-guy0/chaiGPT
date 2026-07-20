import { DataSource, Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';

export interface ConversationRepository {
  findById(id: string, userId: string): Promise<Conversation | null>;
  findAll(userId: string): Promise<Conversation[]>;
  save(c: Partial<Conversation>): Promise<Conversation>;
  branch(id: string, messageId: string, userId: string): Promise<Conversation>;
}

export class ConversationRepositoryImpl implements ConversationRepository {
  private repo: Repository<Conversation>

  constructor(private ds: DataSource) {
    this.repo = ds.getRepository(Conversation)
  }

  async findById(id: string, userId: string): Promise<Conversation | null> {
    return this.repo.findOne({ where: { id, userId } })
  }

  async findAll(userId: string): Promise<Conversation[]> {
    return this.repo.find({ where: { userId }, order: { updatedAt: 'DESC' }, take: 50 })
  }

  async save(c: Partial<Conversation>): Promise<Conversation> {
    return this.repo.save(c)
  }

  async branch(id: string, _messageId: string, userId: string): Promise<Conversation> {
    const source = await this.findById(id, userId)
    if (!source) throw new Error('Conversation not found')
    const branch = this.repo.create({
      userId,
      title: `${source.title} (branch)`,
      rootConversationId: source.rootConversationId || source.id,
      model: source.model,
    })
    return this.repo.save(branch)
  }
}
