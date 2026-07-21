import { randomUUID } from "node:crypto";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Asset } from "@/lib/db/entities/asset.entity";
import type { AssetRepository } from "@/lib/db/repositories/asset.repository";
import type { QdrantStore } from "@/lib/vector/qdrant";
import { NotFoundError } from "@/lib/errors";
import { extractText, SUPPORTED_MIME_TYPES } from "@/lib/ai/text-extractor";
import { chunkDocument } from "@/lib/chunking/chunker";

export class AssetServiceImpl {
  private volumeRoot: string;

  constructor(
    private assetRepo: AssetRepository,
    private qdrantStore: QdrantStore | undefined,
    volumeRoot?: string,
  ) {
    this.volumeRoot = volumeRoot ?? process.env.ASSETS_VOLUME_PATH ?? "/app/assets";
  }

  async ingest(userId: string, convId: string, file: File): Promise<Asset> {
    const mime = file.type;
    if (!SUPPORTED_MIME_TYPES.includes(mime as (typeof SUPPORTED_MIME_TYPES)[number])) {
      const err = new Error(`Unsupported MIME type: ${mime}`) as Error & { status: number };
      err.status = 400;
      throw err;
    }

    const ext = this.extForMime(mime);
    const assetId = randomUUID();
    const relativePath = `${userId}/${convId}/${assetId}.${ext}`;
    const absolutePath = join(this.volumeRoot, relativePath);

    await mkdir(join(this.volumeRoot, userId, convId), { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, buffer);

    let text: string;
    try {
      text = await extractText(file);
    } catch {
      await this.safeUnlink(absolutePath);
      throw new Error("Failed to extract text from file");
    }

    let chunks: Awaited<ReturnType<typeof chunkDocument>>;
    try {
      chunks = await chunkDocument(text, mime, buffer);
    } catch {
      await this.safeUnlink(absolutePath);
      throw new Error("Failed to chunk text");
    }

    try {
      await this.qdrantStore?.upsertChunks(assetId, convId, chunks);
    } finally {
      await this.safeUnlink(absolutePath);
    }

    const saved = await this.assetRepo.save({
      id: assetId,
      userId,
      conversationId: convId,
      filename: file.name,
      mime,
      path: relativePath,
      text,
    });

    return saved;
  }

  async remove(assetId: string, userId: string): Promise<void> {
    const asset = await this.assetRepo.findById(assetId, userId);
    if (!asset) {
      throw new NotFoundError("Asset not found");
    }

    if (this.qdrantStore) {
      try {
        await this.qdrantStore.deleteByAssetId(assetId);
      } catch {
        console.warn(`[AssetService] Qdrant vector cleanup failed for asset ${assetId}`);
      }
    }

    if (asset.path) {
      await this.safeUnlink(join(this.volumeRoot, asset.path));
    }

    await this.assetRepo.delete(assetId, userId);
  }

  private extForMime(mime: string): string {
    switch (mime) {
      case "application/pdf":
        return "pdf";
      case "text/markdown":
        return "md";
      case "text/plain":
        return "txt";
      default:
        return "bin";
    }
  }

  private async safeUnlink(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch {
      // best-effort: file may already be gone
    }
  }
}
