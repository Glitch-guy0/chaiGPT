import { Repository } from "typeorm"
import { Conversation } from "../entities/conversation.entity"
import { getDatabase } from "../index"

export type ConversationStatus = "active" | "archived" | "deleted"

export interface ConversationRepository {
  findById(id: string, userId: string): Promise<Conversation | null>
  findAll(userId: string): Promise<Conversation[]>
  save(conv: Conversation): Promise<Conversation>
  updateStatus(id: string, status: ConversationStatus): Promise<void>
}

export class TypeORMConversationRepository implements ConversationRepository {
  private repo: Repository<Conversation>

  constructor(repo: Repository<Conversation>) {
    this.repo = repo
  }

  static async create(): Promise<TypeORMConversationRepository> {
    const ds = await getDatabase()
    return new TypeORMConversationRepository(ds.getRepository(Conversation))
  }

  async findById(id: string, userId: string): Promise<Conversation | null> {
    return this.repo.findOne({ where: { id, userId } })
  }

  async findAll(userId: string): Promise<Conversation[]> {
    return this.repo.find({
      where: { userId },
      order: { updatedAt: "DESC" },
      take: 50,
    })
  }

  async save(conv: Conversation): Promise<Conversation> {
    return this.repo.save(conv)
  }

  async updateStatus(id: string, status: ConversationStatus): Promise<void> {
    await this.repo.update({ id }, { status } as any)
  }
}
