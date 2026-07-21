import { QdrantClient } from "@qdrant/js-client-rest";
import { v5 as uuidv5 } from "uuid";
import { COLLECTION_CONFIG, BATCH_SIZE, collectionName } from "../../../schema/vector/collections";

const UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const MAX_CONCURRENT_EMBED = 10;

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
  upsertChunks(assetId: string, convId: string, chunks: Chunk[]): Promise<void>;
  deleteByAssetId(assetId: string): Promise<void>;
}

export class QdrantVectorStore implements QdrantStore {
  private client: QdrantClient;
  private collectionsCreated = new Set<string>();

  constructor(url: string) {
    this.client = new QdrantClient({ url });
  }

  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error("Cannot embed empty or whitespace-only text");
    }

    const { OpenAIEmbeddings } = await import("@langchain/openai");
    const embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-small",
    });

    const result = await embeddings.embedQuery(text);
    return result;
  }

  async search(vec: number[], convId: string, k: number): Promise<Hit[]> {
    const name = collectionName(convId);
    const results = await this.client.search(name, {
      vector: vec,
      limit: k,
      with_payload: true,
    });

    return results.map((point) => ({
      chunkId: (point.payload?.chunkId as string) ?? "",
      assetId: (point.payload?.assetId as string) ?? "",
      score: point.score,
      text: (point.payload?.text as string) ?? "",
    }));
  }

  async upsertChunks(
    assetId: string,
    convId: string,
    chunks: Chunk[],
  ): Promise<void> {
    if (chunks.length === 0) return;

    const name = collectionName(convId);
    await this.ensureCollection(name);

    const points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }> = [];
    for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_EMBED) {
      const batch = chunks.slice(i, i + MAX_CONCURRENT_EMBED);
      const embedded = await Promise.all(
        batch.map(async (chunk) => {
          const chunkId = uuidv5(`${assetId}::${chunk.index}`, UUID_NAMESPACE);
          const vector = await this.embed(chunk.text);
          return {
            id: chunkId,
            vector,
            payload: {
              chunkId,
              assetId,
              index: chunk.index,
              text: chunk.text,
            },
          };
        }),
      );
      points.push(...embedded);
    }

    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);
      await this.client.upsert(name, { points: batch });
    }
  }

  async deleteByAssetId(assetId: string): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      for (const collection of collections.collections) {
        const name = collection.name;
        try {
          await this.client.delete(name, {
            filter: {
              must: [{ key: "assetId", match: { value: assetId } }],
            },
          });
        } catch (err) {
          console.warn(`[Qdrant] deleteByAssetId failed for collection ${name}:`, err);
        }
      }
    } catch (err) {
      console.error("[Qdrant] deleteByAssetId failed to list collections:", err);
      throw err;
    }
  }

  private collectionPromises = new Map<string, Promise<void>>();

  private async ensureCollection(name: string): Promise<void> {
    if (this.collectionsCreated.has(name)) return;

    const existing = this.collectionPromises.get(name);
    if (existing) return existing;

    const promise = (async () => {
      try {
        await this.client.getCollection(name);
      } catch {
        try {
          await this.client.createCollection(name, COLLECTION_CONFIG);
        } catch (createErr: unknown) {
          const status = (createErr as { status?: number })?.status;
          if (status !== 409) throw createErr;
        }
      }
      this.collectionsCreated.add(name);
      this.collectionPromises.delete(name);
    })();

    this.collectionPromises.set(name, promise);
    return promise;
  }
}

let qdrantSingleton: QdrantVectorStore | null = null;

export function getQdrantStore(): QdrantVectorStore | undefined {
  const url = process.env.QDRANT_URL;
  if (!url) {
    console.warn("[Qdrant] QDRANT_URL not set — RAG features disabled");
    return undefined;
  }
  if (!qdrantSingleton) {
    qdrantSingleton = new QdrantVectorStore(url);
  }
  return qdrantSingleton;
}

export function resetQdrantSingleton(): void {
  qdrantSingleton = null;
}
