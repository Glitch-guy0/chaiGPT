import { Asset } from '../entities/asset.entity';

export interface AssetRepository {
  findById(id: string, userId: string): Promise<Asset | null>;
  findAll(userId: string): Promise<Asset[]>;
  save(a: Partial<Asset>): Promise<Asset>;
  findByConversation(conversationId: string, userId: string): Promise<Asset[]>;
  delete(id: string, userId: string): Promise<void>;
}
