import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';

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

  async branch(id: string, messageId: string, userId: string): Promise<Conversation> {
    const source = await this.findById(id, userId)
    if (!source) throw new Error('Conversation not found')

    const messageRepo = this.ds.getRepository(Message)
    const messages = await messageRepo.find({
      where: { conversationId: id, userId },
      order: { createdAt: 'ASC', id: 'ASC' },
    })

    const branchPointIdx = messages.findIndex((m) => m.id === messageId)
    if (branchPointIdx === -1) {
      throw new Error('Message not found in conversation')
    }

    return this.ds.transaction(async (manager) => {
      const convRepo = manager.getRepository(Conversation)
      const msgRepo = manager.getRepository(Message)

      const branch = convRepo.create({
        userId,
        title: `${source.title} (branch)`,
        rootConversationId: source.rootConversationId || source.id,
        model: source.model,
      })
      const savedBranch = await convRepo.save(branch)

      const idMap = new Map<string, string>()
      const toCopy = messages.slice(0, branchPointIdx + 1)
      for (const m of toCopy) {
        const newId = randomUUID()
        idMap.set(m.id, newId)
        const copy = msgRepo.create({
          id: newId,
          conversationId: savedBranch.id,
          userId: m.userId,
          parentId: m.parentId ? (idMap.get(m.parentId) ?? m.parentId) : undefined,
          role: m.role,
          content: m.content,
          model: m.model,
          status: m.status,
          assetIds: m.assetIds,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })
        await msgRepo.save(copy)
      }

      savedBranch.lastMessageId = idMap.get(messageId) || messageId
      return convRepo.save(savedBranch)
    })
  }
}
