import { randomUUID } from "crypto"
import { writeFile, unlink, mkdir } from "fs/promises"
import { join } from "path"
import { Asset } from "@/lib/db/entities/asset.entity"
import type { AssetRepository } from "@/lib/db/repositories/asset.repository"
import type { QdrantStore } from "@/lib/vector/qdrant"

export interface AssetService {
  ingest(userId: string, convId: string, file: File): Promise<Asset>
  remove(id: string, userId: string): Promise<void>
}

const VOLUME_PATH = process.env.ASSET_VOLUME_PATH ?? "/data/assets"
const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 200

const ALLOWED_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
}

function mimeFromName(name: string): string {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase()
  return ALLOWED_TYPES[ext] ?? "application/octet-stream"
}

function splitText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    if (end === text.length) break
    start += chunkSize - overlap
  }
  return chunks
}

async function extractText(buffer: Buffer, mime: string): Promise<string> {
  if (mime === "application/pdf") {
    const { PDFParse } = await import("pdf-parse")
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    await parser.destroy()
    return result.text
  }
  return buffer.toString("utf-8")
}

export class AssetServiceImpl implements AssetService {
  constructor(
    private repo: AssetRepository,
    private qdrant: QdrantStore,
    private volumePath = VOLUME_PATH
  ) {}

  async ingest(userId: string, convId: string, file: File): Promise<Asset> {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    const mime = mimeFromName(file.name)
    if (!ALLOWED_TYPES[ext]) {
      throw new Error(`Unsupported file type: ${ext}`)
    }

    const assetId = randomUUID()
    const stagedName = `${assetId}${ext}`
    const destDir = join(this.volumePath, userId)
    const destPath = join(destDir, stagedName)

    await mkdir(destDir, { recursive: true })
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await writeFile(destPath, buffer)

    try {
      const text = await extractText(buffer, mime)
      const chunks = splitText(text)
      if (chunks.length === 0) {
        throw new Error("Document produced no text chunks")
      }
      await this.qdrant.upsertChunks(assetId, chunks)
    } catch (err) {
      await unlink(destPath).catch(() => {})
      throw err
    }

    const asset = new Asset()
    asset.id = assetId
    asset.userId = userId
    asset.conversationId = convId
    asset.filename = file.name
    asset.mime = mime
    asset.path = destPath
    const saved = await this.repo.save(asset)

    await unlink(destPath).catch(() => {})
    return saved
  }

  async remove(id: string, userId: string): Promise<void> {
    const asset = await this.repo.findById(id, userId)
    if (!asset) {
      throw new Error("Asset not found")
    }

    await unlink(asset.path).catch(() => {})
    await this.repo.delete(id, userId)
  }
}
