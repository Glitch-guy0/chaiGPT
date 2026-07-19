import { describe, it, expect } from "vitest"
import type { Asset } from "../entities/asset.entity"
import type { AssetRepository } from "./asset.repository"

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: overrides.id ?? "asset-1",
    userId: overrides.userId ?? "user-1",
    conversationId: overrides.conversationId ?? "conv-1",
    filename: overrides.filename ?? "doc.pdf",
    mime: overrides.mime ?? "application/pdf",
    path: overrides.path ?? "/uploads/doc.pdf",
    createdAt: overrides.createdAt ?? new Date("2025-01-01"),
  } as Asset
}

function createInMemoryAssetRepo(): AssetRepository {
  const store = new Map<string, Asset>()

  return {
    async findById(id: string, userId: string) {
      const asset = store.get(id)
      if (asset && asset.userId === userId) return asset
      return null
    },
    async findByConversation(convId: string, userId: string) {
      return [...store.values()].filter(
        (a) => a.conversationId === convId && a.userId === userId
      )
    },
    async save(asset: Asset) {
      store.set(asset.id, asset)
      return asset
    },
    async delete(id: string, userId: string) {
      const asset = store.get(id)
      if (!asset) throw new Error("Asset not found")
      if (asset.userId !== userId) throw new Error("Unauthorized")
      store.delete(id)
    },
  }
}

describe("AssetRepository", () => {
  it("save persists and findById retrieves an asset", async () => {
    const repo = createInMemoryAssetRepo()
    const asset = makeAsset({ id: "a1", userId: "u1" })
    await repo.save(asset)
    const found = await repo.findById("a1", "u1")
    expect(found).not.toBeNull()
    expect(found!.id).toBe("a1")
  })

  it("findById returns null for missing asset", async () => {
    const repo = createInMemoryAssetRepo()
    expect(await repo.findById("nope", "u1")).toBeNull()
  })

  it("findById returns null for wrong user", async () => {
    const repo = createInMemoryAssetRepo()
    await repo.save(makeAsset({ id: "a1", userId: "u1" }))
    expect(await repo.findById("a1", "u2")).toBeNull()
  })

  it("findByConversation returns assets for a conversation", async () => {
    const repo = createInMemoryAssetRepo()
    await repo.save(makeAsset({ id: "a1", conversationId: "c1", userId: "u1" }))
    await repo.save(makeAsset({ id: "a2", conversationId: "c1", userId: "u1" }))
    await repo.save(makeAsset({ id: "a3", conversationId: "c2", userId: "u1" }))
    const results = await repo.findByConversation("c1", "u1")
    expect(results).toHaveLength(2)
  })

  it("findByConversation filters by userId", async () => {
    const repo = createInMemoryAssetRepo()
    await repo.save(makeAsset({ id: "a1", conversationId: "c1", userId: "u1" }))
    await repo.save(makeAsset({ id: "a2", conversationId: "c1", userId: "u2" }))
    const results = await repo.findByConversation("c1", "u1")
    expect(results).toHaveLength(1)
  })

  it("findByConversation returns empty for no matches", async () => {
    const repo = createInMemoryAssetRepo()
    expect(await repo.findByConversation("c1", "u1")).toHaveLength(0)
  })

  it("delete removes an asset", async () => {
    const repo = createInMemoryAssetRepo()
    await repo.save(makeAsset({ id: "a1", userId: "u1" }))
    await expect(repo.delete("a1", "u1")).resolves.toBeUndefined()
    expect(await repo.findById("a1", "u1")).toBeNull()
  })

  it("delete throws if asset not found", async () => {
    const repo = createInMemoryAssetRepo()
    await expect(repo.delete("nope", "u1")).rejects.toThrow("Asset not found")
  })

  it("delete throws if user is not the owner", async () => {
    const repo = createInMemoryAssetRepo()
    await repo.save(makeAsset({ id: "a1", userId: "u1" }))
    await expect(repo.delete("a1", "u2")).rejects.toThrow("Unauthorized")
  })
})
