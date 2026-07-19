import { OpenAIEmbeddings } from "@langchain/openai"

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
  search(vec: number[], convId: string, k: number): Promise<VectorChunk[]>
  upsertChunks(assetId: string, chunks: string[]): Promise<void>
}

const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333"
const COLLECTION = process.env.QDRANT_COLLECTION ?? "chai-gpt"
const EMBED_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small"

export class LangChainQdrantStore implements QdrantStore {
  private embeddings: OpenAIEmbeddings

  constructor() {
    this.embeddings = new OpenAIEmbeddings({ modelName: EMBED_MODEL })
  }

  async embed(text: string): Promise<number[]> {
    const vectors = await this.embeddings.embedQuery(text)
    return vectors
  }

  async upsertChunks(assetId: string, chunks: string[]): Promise<void> {
    const vectors = await this.embeddings.embedDocuments(chunks)
    const points = chunks.map((content, i) => ({
      id: crypto.randomUUID(),
      vector: vectors[i],
      payload: { content, assetId, chunkIndex: i, citation: `${assetId}#${i}` },
    }))

    await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/upsert`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    })
  }

  async search(vec: number[], convId: string, k: number): Promise<VectorChunk[]> {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vector: vec,
        limit: k,
        filter: {
          must: [{ key: "conversationId", match: { value: convId } }],
        },
        with_payload: true,
      }),
    })

    const data = await res.json()
    return (data.result ?? []).map((r: Record<string, unknown>) => {
      const payload = r.payload as Record<string, unknown>
      return {
        id: r.id as string,
        content: payload.content as string,
        assetId: payload.assetId as string,
        chunkIndex: payload.chunkIndex as number,
        citation: payload.citation as string,
        score: r.score as number,
      }
    })
  }
}
