import { CharacterTextSplitter } from "@langchain/textsplitters";
import type { Chunk } from "@/lib/vector/qdrant";

const TEXT_SPLITTER = new CharacterTextSplitter({
  chunkSize: 2000,
  chunkOverlap: 0,
  separator: "\n",
});

async function chunkPdfBuffer(buffer: Buffer): Promise<Chunk[]> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  const rawPages = result.text.split(/\f/);
  const pages: Chunk[] = [];

  for (let i = 0; i < rawPages.length; i++) {
    const pageText = rawPages[i]?.trim() ?? "";
    if (pageText.length > 0) {
      pages.push({ index: i, text: pageText });
    }
  }

  if (pages.length === 0) return [];

  const chunks: Chunk[] = [];
  for (const page of pages) {
    if (page.text.length <= 2000) {
      chunks.push({ index: chunks.length, text: page.text });
    } else {
      const docs = await TEXT_SPLITTER.createDocuments([page.text]);
      for (const doc of docs) {
        if (doc.pageContent.trim().length > 0) {
          chunks.push({ index: chunks.length, text: doc.pageContent });
        }
      }
    }
  }

  return chunks;
}

export async function chunkDocument(
  text: string,
  mimeType: string,
  rawBuffer?: Buffer,
): Promise<Chunk[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  if (mimeType === "application/pdf" && rawBuffer) {
    return chunkPdfBuffer(rawBuffer);
  }

  const docs = await TEXT_SPLITTER.createDocuments([text]);

  return docs
    .map((doc, index) => ({ index, text: doc.pageContent }))
    .filter((chunk) => chunk.text.trim().length > 0);
}
