export const COLLECTION_CONFIG = {
  vectors: {
    size: 1536,
    distance: "Cosine" as const,
  },
  payload_schema: {
    assetId: { type: "keyword" as const },
    chunkId: { type: "keyword" as const },
    index: { type: "integer" as const },
  },
};

export const BATCH_SIZE = 128;

export function collectionName(convId: string): string {
  return `conv_${convId}`;
}
