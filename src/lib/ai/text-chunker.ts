import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Chunk } from "@/lib/vector/qdrant";

const TEXT_SPLITTER = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

export async function chunkText(text: string): Promise<Chunk[]> {
  const docs = await TEXT_SPLITTER.createDocuments([text]);

  return docs
    .map((doc, index) => ({ index, text: doc.pageContent }))
    .filter((chunk) => chunk.text.trim().length > 0);
}
