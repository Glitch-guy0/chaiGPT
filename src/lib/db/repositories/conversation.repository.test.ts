import { describe, it, expect } from "vitest"
import type { Conversation } from "../entities/conversation.entity"
import type {
  ConversationRepository,
  ConversationStatus,
} from "./conversation.repository"

function makeConv(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: overrides.id ?? "conv-1",
    userId: overrides.userId ?? "user-1",
    title: overrides.title ?? "Test Conv",
    model: overrides.model,
    status: overrides.status ?? "active",
    createdAt: overrides.createdAt ?? new Date("2025-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2025-01-01"),
    messages: [],
  } as Conversation
}

function createInMemoryConversationRepo(): ConversationRepository {
  const store = new Map<string, Conversation>()
  const statuses = new Map<string, ConversationStatus>()

  return {
    async findById(id: string, userId: string) {
      const conv = store.get(id)
      if (conv && conv.userId === userId) return conv
      return null
    },
    async findAll(userId: string) {
      return [...store.values()].filter((c) => c.userId === userId)
    },
    async save(conv: Conversation) {
      store.set(conv.id, conv)
      return conv
    },
    async updateStatus(id: string, status: ConversationStatus) {
      if (!store.has(id)) throw new Error("Conversation not found")
      statuses.set(id, status)
    },
  }
}

describe("ConversationRepository", () => {
  it("save persists and findById retrieves a conversation", async () => {
    const repo = createInMemoryConversationRepo()
    const conv = makeConv({ id: "c1", userId: "u1" })
    await repo.save(conv)
    const found = await repo.findById("c1", "u1")
    expect(found).not.toBeNull()
    expect(found!.id).toBe("c1")
  })

  it("findById returns null for missing conversation", async () => {
    const repo = createInMemoryConversationRepo()
    const found = await repo.findById("missing", "u1")
    expect(found).toBeNull()
  })

  it("findById returns null for wrong user", async () => {
    const repo = createInMemoryConversationRepo()
    await repo.save(makeConv({ id: "c1", userId: "u1" }))
    const found = await repo.findById("c1", "u2")
    expect(found).toBeNull()
  })

  it("findAll returns only conversations for the given user", async () => {
    const repo = createInMemoryConversationRepo()
    await repo.save(makeConv({ id: "c1", userId: "u1" }))
    await repo.save(makeConv({ id: "c2", userId: "u1" }))
    await repo.save(makeConv({ id: "c3", userId: "u2" }))
    const results = await repo.findAll("u1")
    expect(results).toHaveLength(2)
  })

  it("findAll returns empty array when none exist", async () => {
    const repo = createInMemoryConversationRepo()
    const results = await repo.findAll("u1")
    expect(results).toHaveLength(0)
  })

  it("updateStatus updates the status of a conversation", async () => {
    const repo = createInMemoryConversationRepo()
    await repo.save(makeConv({ id: "c1" }))
    await expect(
      repo.updateStatus("c1", "archived")
    ).resolves.toBeUndefined()
  })

  it("updateStatus throws for nonexistent conversation", async () => {
    const repo = createInMemoryConversationRepo()
    await expect(
      repo.updateStatus("missing", "deleted")
    ).rejects.toThrow("Conversation not found")
  })
})
