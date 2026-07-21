import { DataSource, Repository } from 'typeorm';
import { Asset } from '../entities/asset.entity';

export interface AssetRepository {
  findById(id: string, userId: string): Promise<Asset | null>;
  findAll(userId: string): Promise<Asset[]>;
  save(a: Partial<Asset>): Promise<Asset>;
  findByConversation(conversationId: string, userId: string): Promise<Asset[]>;
  findIds(ids: string[], userId: string): Promise<Asset[]>;
  delete(id: string, userId: string): Promise<void>;
}

export class AssetRepositoryImpl implements AssetRepository {
  private repo: Repository<Asset>

  constructor(private ds: DataSource) {
    this.repo = ds.getRepository(Asset)
  }

  async findById(id: string, userId: string): Promise<Asset | null> {
    return this.repo.findOne({ where: { id, userId } })
  }

  async findAll(userId: string): Promise<Asset[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 })
  }

  async save(a: Partial<Asset>): Promise<Asset> {
    return this.repo.save(a)
  }

  async findByConversation(conversationId: string, userId: string): Promise<Asset[]> {
    return this.repo.find({ where: { conversationId, userId } })
  }

  async findIds(ids: string[], userId: string): Promise<Asset[]> {
    if (ids.length === 0) return []
    return this.repo.createQueryBuilder('asset')
      .where('asset.id IN (:...ids)', { ids })
      .andWhere('asset.userId = :userId', { userId })
      .getMany()
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.repo.delete({ id, userId })
    if (result.affected === 0) throw new Error('Asset not found')
  }
}
