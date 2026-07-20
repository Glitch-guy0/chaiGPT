import { AppDataSource } from '../data-source';
import { Message, MessageStatus } from '../entities/message.entity';

export interface IMessageRepository {
  findByConversation(conversationId: string, userId: string): Promise<Message[]>;
  findById(id: string, userId: string): Promise<Message | null>;
  save(message: Message): Promise<Message>;
  updateStatus(id: string, status: MessageStatus): Promise<void>;
}

export class MessageRepository implements IMessageRepository {
  private repo = AppDataSource.getRepository(Message);

  async findById(id: string, userId: string): Promise<Message | null> {
    return this.repo.findOne({ where: { id, userId } });
  }

  async findByConversation(conversationId: string, userId: string): Promise<Message[]> {
    return this.repo.find({
      where: { conversationId, userId },
      order: { createdAt: 'ASC' },
    });
  }

  async save(message: Message): Promise<Message> {
    return this.repo.save(message);
  }

  async updateStatus(id: string, status: MessageStatus): Promise<void> {
    await this.repo.update(id, { status });
  }
}
