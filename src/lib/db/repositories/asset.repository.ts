import { AppDataSource } from '../data-source';
import { Asset } from '../entities/asset.entity';

export interface IAssetRepository {
  save(asset: Asset): Promise<Asset>;
  findByConversation(conversationId: string, userId: string): Promise<Asset[]>;
  delete(id: string, userId: string): Promise<void>;
}

export class AssetRepository implements IAssetRepository {
  private repo = AppDataSource.getRepository(Asset);

  async save(asset: Asset): Promise<Asset> {
    return this.repo.save(asset);
  }

  async findByConversation(conversationId: string, userId: string): Promise<Asset[]> {
    return this.repo.find({
      where: { conversationId, userId },
      order: { createdAt: 'ASC' },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.repo.delete({ id, userId });
  }
}
