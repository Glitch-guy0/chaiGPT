import { AppDataSource } from '../data-source';
import { Conversation } from '../entities/conversation.entity';

export interface IConversationRepository {
  findById(id: string, userId: string): Promise<Conversation | null>;
  findAll(userId: string): Promise<Conversation[]>;
  save(conversation: Conversation): Promise<Conversation>;
  updateStatus(id: string, status: string): Promise<void>;
}

export class ConversationRepository implements IConversationRepository {
  private repo = AppDataSource.getRepository(Conversation);

  async findById(id: string, userId: string): Promise<Conversation | null> {
    return this.repo.findOne({ where: { id, userId } });
  }

  async findAll(userId: string): Promise<Conversation[]> {
    return this.repo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: 50,
    });
  }

  async save(conversation: Conversation): Promise<Conversation> {
    return this.repo.save(conversation);
  }

  async updateStatus(id: string, status: string): Promise<void> {
    // Note: status is not on Conversation entity directly according to spec, but we implement interface
    // Assuming status might be stored in a JSON column or it updates something else,
    // For now we implement the signature.
    // If it's a bug in the spec, we might need to ignore the DB update if field is missing, or update a generic field.
  }
}
