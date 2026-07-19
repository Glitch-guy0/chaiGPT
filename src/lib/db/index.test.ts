import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("typeorm", () => {
  return {
    DataSource: class MockDataSource {
      options = { type: "postgres" }
      isInitialized = false
      async initialize() {
        this.isInitialized = true
        return this
      }
    },
  }
})

vi.mock("./entities/conversation.entity", () => ({
  Conversation: class MockConversation {},
}))
vi.mock("./entities/message.entity", () => ({
  Message: class MockMessage {},
}))
vi.mock("./entities/asset.entity", () => ({
  Asset: class MockAsset {},
}))

describe("db/index", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exports AppDataSource", async () => {
    const mod = await import("./index")
    expect(mod.AppDataSource).toBeDefined()
  })

  it("exports entity classes", async () => {
    const mod = await import("./index")
    expect(mod.Conversation).toBeDefined()
    expect(mod.Message).toBeDefined()
    expect(mod.Asset).toBeDefined()
  })

  it("initializeDatabase initializes the data source", async () => {
    const mod = await import("./index")
    await mod.initializeDatabase()
    expect(mod.AppDataSource.isInitialized).toBe(true)
  })

  it("initializeDatabase skips if already initialized", async () => {
    const mod = await import("./index")
    ;(mod.AppDataSource as any).isInitialized = true
    const initSpy = vi.spyOn(mod.AppDataSource, "initialize")
    await mod.initializeDatabase()
    expect(initSpy).not.toHaveBeenCalled()
  })

  it("getDatabase initializes if not yet initialized", async () => {
    const mod = await import("./index")
    ;(mod.AppDataSource as any).isInitialized = false
    const ds = await mod.getDatabase()
    expect(ds).toBe(mod.AppDataSource)
    expect(mod.AppDataSource.isInitialized).toBe(true)
  })

  it("getDatabase returns existing if already initialized", async () => {
    const mod = await import("./index")
    ;(mod.AppDataSource as any).isInitialized = true
    const initSpy = vi.spyOn(mod.AppDataSource, "initialize")
    const ds = await mod.getDatabase()
    expect(initSpy).not.toHaveBeenCalled()
    expect(ds).toBe(mod.AppDataSource)
  })
})
