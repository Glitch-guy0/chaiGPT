import { Asset } from "@/lib/db/entities/asset.entity"

export interface AssetService {
  ingest(userId: string, convId: string, file: File): Promise<Asset>
  remove(id: string, userId: string): Promise<void>
}
