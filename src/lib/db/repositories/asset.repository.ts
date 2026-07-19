import { Asset } from "../entities/asset.entity"

export interface AssetRepository {
  findById(id: string, userId: string): Promise<Asset | null>
  findByConversation(convId: string, userId: string): Promise<Asset[]>
  save(asset: Asset): Promise<Asset>
  delete(id: string, userId: string): Promise<void>
}
