import { Asset } from '../lib/db/entities/asset.entity';

export interface AssetService {
  ingest(userId: string, convId: string, file: unknown): Promise<Asset>;
  remove(assetId: string, userId: string): Promise<void>;
}
