import { Repository } from "typeorm"
import { Message } from "../entities/message.entity"
import { getDatabase } from "../index"

export type MessageStatus = "pending" | "sent" | "failed"

export interface MessageRepository {
  findById(id: string, userId: string): Promise<Message | null>
  findByConversation(convId: string, userId: string): Promise<Message[]>
  save(msg: Message): Promise<Message>
  updateStatus(id: string, status: MessageStatus): Promise<void>
}

export class TypeORMMessageRepository implements MessageRepository {
  private repo: Repository<Message>

  constructor(repo: Repository<Message>) {
    this.repo = repo
  }

  static async create(): Promise<TypeORMMessageRepository> {
    const ds = await getDatabase()
    return new TypeORMMessageRepository(ds.getRepository(Message))
  }

  async findById(id: string, userId: string): Promise<Message | null> {
    return this.repo.findOne({ where: { id, userId } })
  }

  async findByConversation(convId: string, userId: string): Promise<Message[]> {
    return this.repo.find({
      where: { conversationId: convId, userId },
      order: { createdAt: "ASC" },
    })
  }

  async save(msg: Message): Promise<Message> {
    return this.repo.save(msg)
  }

  async updateStatus(id: string, status: MessageStatus): Promise<void> {
    await this.repo.update({ id }, { status } as any)
  }
}
