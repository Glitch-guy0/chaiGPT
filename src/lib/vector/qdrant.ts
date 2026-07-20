export interface Chunk {
  text: string;
  metadata: any;
}

export interface ChunkResult {
  text: string;
  metadata: any;
  score: number;
}

export interface IQdrantStore {
  embed(text: string): Promise<number[]>;
  search(vec: number[], convId: string, k: number): Promise<ChunkResult[]>;
  upsertChunks(assetId: string, chunks: Chunk[]): Promise<void>;
  deleteAssetChunks(assetId: string): Promise<void>;
}

export class DummyQdrantStore implements IQdrantStore {
  async embed(text: string) { return [0,1,2]; }
  async search(vec: number[], convId: string, k: number) { return []; }
  async upsertChunks(assetId: string, chunks: Chunk[]) {}
  async deleteAssetChunks(assetId: string) {}
}

export const qdrantStore = new DummyQdrantStore();
