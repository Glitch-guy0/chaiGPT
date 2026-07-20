export interface Hit {
  chunkId: string;
  assetId: string;
  score: number;
  text: string;
}

export interface Chunk {
  index: number;
  text: string;
}

export interface QdrantStore {
  embed(text: string): Promise<number[]>;
  search(vec: number[], convId: string, k: number): Promise<Hit[]>;
  upsertChunks(assetId: string, chunks: Chunk[]): Promise<void>;
}
