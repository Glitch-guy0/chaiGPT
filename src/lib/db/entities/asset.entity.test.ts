import { describe, it, expect } from "vitest"
import { Asset } from "./asset.entity"

describe("Asset entity", () => {
  it("creates an instance", () => {
    const asset = new Asset()
    expect(asset).toBeDefined()
    expect(asset).toBeInstanceOf(Asset)
  })

  it("allows setting all properties", () => {
    const asset = new Asset()
    asset.id = "asset-1"
    asset.userId = "user-1"
    asset.conversationId = "conv-1"
    asset.filename = "document.pdf"
    asset.mime = "application/pdf"
    asset.path = "/uploads/document.pdf"
    asset.createdAt = new Date("2025-06-01")

    expect(asset.id).toBe("asset-1")
    expect(asset.userId).toBe("user-1")
    expect(asset.conversationId).toBe("conv-1")
    expect(asset.filename).toBe("document.pdf")
    expect(asset.mime).toBe("application/pdf")
    expect(asset.path).toBe("/uploads/document.pdf")
    expect(asset.createdAt).toEqual(new Date("2025-06-01"))
  })
})
