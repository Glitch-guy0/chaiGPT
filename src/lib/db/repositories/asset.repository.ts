import { Repository } from "typeorm"
import { Asset } from "../entities/asset.entity"
import { getDatabase } from "../index"

export interface AssetRepository {
  findById(id: string, userId: string): Promise<Asset | null>
  findByConversation(convId: string, userId: string): Promise<Asset[]>
  save(asset: Asset): Promise<Asset>
  delete(id: string, userId: string): Promise<void>
}

export class TypeORMAssetRepository implements AssetRepository {
  private repo: Repository<Asset>

  constructor(repo: Repository<Asset>) {
    this.repo = repo
  }

  static async create(): Promise<TypeORMAssetRepository> {
    const ds = await getDatabase()
    return new TypeORMAssetRepository(ds.getRepository(Asset))
  }

  async findById(id: string, userId: string): Promise<Asset | null> {
    return this.repo.findOne({ where: { id, userId } })
  }

  async findByConversation(convId: string, userId: string): Promise<Asset[]> {
    return this.repo.find({
      where: { conversationId: convId, userId },
    })
  }

  async save(asset: Asset): Promise<Asset> {
    return this.repo.save(asset)
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.repo.delete({ id, userId })
  }
}
