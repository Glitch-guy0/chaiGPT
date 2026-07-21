import type { Hit } from '@/lib/vector/qdrant';
import type { Citation } from '@/types';

export type { Citation };

const MAX_CHUNK_CHARS = 2000;
const SNIPPET_LENGTH = 120;

export function formatRagContext(hits: Hit[]): string {
  if (hits.length === 0) return '';

  const lines = hits.map((h, i) => {
    const text = h.text.length > MAX_CHUNK_CHARS ? h.text.slice(0, MAX_CHUNK_CHARS) : h.text;
    return `[${i + 1}] (asset: ${h.assetId}, chunk: ${h.chunkId}, score: ${h.score}) ${text}`;
  });

  return `[RAG Context]\n${lines.join('\n')}\n[/RAG Context]`;
}

export function hitsToCitations(hits: Hit[]): Citation[] {
  return hits.map((h) => ({
    chunkId: h.chunkId,
    assetId: h.assetId,
    score: h.score,
    snippet: h.text.slice(0, SNIPPET_LENGTH),
  }));
}
