import { describe, it, expect } from "vitest"
import type { Asset } from "@/lib/db/entities/asset.entity"
import type { AssetService } from "./asset.service"

function makeAssetData(overrides: Partial<Asset> = {}): Asset {
  return {
    id: overrides.id ?? "asset-1",
    userId: overrides.userId ?? "user-1",
    conversationId: overrides.conversationId ?? "conv-1",
    filename: overrides.filename ?? "document.pdf",
    mime: overrides.mime ?? "application/pdf",
    path: overrides.path ?? "/uploads/document.pdf",
    createdAt: overrides.createdAt ?? new Date("2025-01-01"),
  } as Asset
}

function createMockAssetService(): AssetService {
  const store = new Map<string, Asset>()
  let counter = 0

  return {
    async ingest(
      userId: string,
      convId: string,
      file: File
    ): Promise<Asset> {
      const asset = makeAssetData({
        id: `asset-${++counter}`,
        userId,
        conversationId: convId,
        filename: file.name,
        mime: file.type,
        path: `/uploads/${file.name}`,
      })
      store.set(asset.id, asset)
      return asset
    },
    async remove(id: string, userId: string): Promise<void> {
      const asset = store.get(id)
      if (!asset) throw new Error("Asset not found")
      if (asset.userId !== userId) throw new Error("Unauthorized")
      store.delete(id)
    },
  }
}

describe("AssetService", () => {
  it("ingest creates an asset from a file", async () => {
    const svc = createMockAssetService()
    const file = new File(["content"], "test.txt", { type: "text/plain" })
    const asset = await svc.ingest("user-1", "conv-1", file)
    expect(asset.filename).toBe("test.txt")
    expect(asset.mime).toBe("text/plain")
    expect(asset.userId).toBe("user-1")
    expect(asset.conversationId).toBe("conv-1")
  })

  it("ingest assigns unique ids", async () => {
    const svc = createMockAssetService()
    const f1 = new File(["a"], "a.txt", { type: "text/plain" })
    const f2 = new File(["b"], "b.txt", { type: "text/plain" })
    const a1 = await svc.ingest("user-1", "conv-1", f1)
    const a2 = await svc.ingest("user-1", "conv-1", f2)
    expect(a1.id).not.toBe(a2.id)
  })

  it("remove deletes an existing asset", async () => {
    const svc = createMockAssetService()
    const file = new File(["x"], "del.txt", { type: "text/plain" })
    const asset = await svc.ingest("user-1", "conv-1", file)
    await expect(svc.remove(asset.id, "user-1")).resolves.toBeUndefined()
  })

  it("remove throws if asset not found", async () => {
    const svc = createMockAssetService()
    await expect(svc.remove("nonexistent", "user-1")).rejects.toThrow(
      "Asset not found"
    )
  })

  it("remove throws if user is not the owner", async () => {
    const svc = createMockAssetService()
    const file = new File(["x"], "own.txt", { type: "text/plain" })
    const asset = await svc.ingest("user-1", "conv-1", file)
    await expect(svc.remove(asset.id, "user-2")).rejects.toThrow(
      "Unauthorized"
    )
  })
})
