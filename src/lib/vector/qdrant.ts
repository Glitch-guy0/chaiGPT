export interface VectorChunk {
  id: string
  content: string
  assetId: string
  chunkIndex: number
  citation: string
  score: number
}

export interface QdrantStore {
  embed(text: string): Promise<number[]>
  search(
    vec: number[],
    convId: string,
    k: number
  ): Promise<VectorChunk[]>
  upsertChunks(assetId: string, chunks: string[]): Promise<void>
}
