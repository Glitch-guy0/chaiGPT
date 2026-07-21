import type { QdrantStore, Hit, Chunk } from "@/lib/vector/qdrant";

export class MockQdrantStore implements QdrantStore {
  private embedFn: (text: string) => Promise<number[]> = async () =>
    new Array(384).fill(0.1);
  private searchFn: (
    vec: number[],
    convId: string,
    k: number,
  ) => Promise<Hit[]> = async () => [];
  private upsertFn: (
    assetId: string,
    convId: string,
    chunks: Chunk[],
  ) => Promise<void> = async () => {};
  private deleteFn: (assetId: string) => Promise<void> = async () => {};

  onEmbed(fn: (text: string) => Promise<number[]>) {
    this.embedFn = fn;
  }
  onSearch(
    fn: (vec: number[], convId: string, k: number) => Promise<Hit[]>,
  ) {
    this.searchFn = fn;
  }
  onUpsert(fn: (assetId: string, convId: string, chunks: Chunk[]) => Promise<void>) {
    this.upsertFn = fn;
  }
  onDelete(fn: (assetId: string) => Promise<void>) {
    this.deleteFn = fn;
  }

  async embed(text: string): Promise<number[]> {
    return this.embedFn(text);
  }
  async search(
    vec: number[],
    convId: string,
    k: number,
  ): Promise<Hit[]> {
    return this.searchFn(vec, convId, k);
  }
  async upsertChunks(
    assetId: string,
    convId: string,
    chunks: Chunk[],
  ): Promise<void> {
    return this.upsertFn(assetId, convId, chunks);
  }
  async deleteByAssetId(assetId: string): Promise<void> {
    return this.deleteFn(assetId);
  }
}
