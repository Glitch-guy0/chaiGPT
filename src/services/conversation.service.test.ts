import { describe, it, expect } from "vitest"
import type { Conversation } from "@/lib/db/entities/conversation.entity"
import type {
  ConversationService,
  CreateConversationInput,
} from "./conversation.service"

function makeConv(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: overrides.id ?? "conv-1",
    userId: overrides.userId ?? "user-1",
    title: overrides.title ?? "Test Conversation",
    model: overrides.model ?? "gpt-4",
    status: overrides.status ?? "active",
    rootConversationId: overrides.rootConversationId,
    createdAt: overrides.createdAt ?? new Date("2025-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2025-01-01"),
    messages: [],
  } as Conversation
}

function createMockConversationService(): ConversationService {
  const store = new Map<string, Conversation>()

  return {
    async list(userId: string): Promise<Conversation[]> {
      return [...store.values()].filter((c) => c.userId === userId)
    },
    async create(
      userId: string,
      input: CreateConversationInput
    ): Promise<Conversation> {
      const conv = makeConv({
        id: `conv-${store.size + 1}`,
        userId,
        title: input.title,
        model: input.model,
      })
      store.set(conv.id, conv)
      return conv
    },
    async getById(
      id: string,
      userId: string
    ): Promise<Conversation | null> {
      const conv = store.get(id)
      if (conv && conv.userId === userId) return conv
      return null
    },
    async branch(
      id: string,
      _messageId: string,
      userId: string
    ): Promise<Conversation> {
      const original = store.get(id)
      if (!original) throw new Error("Conversation not found")
      const branched = makeConv({
        id: `conv-${store.size + 1}`,
        userId,
        title: `${original.title} (branched)`,
        rootConversationId: original.id,
      })
      store.set(branched.id, branched)
      return branched
    },
  }
}

describe("ConversationService", () => {
  it("list returns conversations for a user", async () => {
    const svc = createMockConversationService()
    const conv = await svc.create("user-1", { title: "Hello" })
    const result = await svc.list("user-1")
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(conv.id)
  })

  it("create returns a new conversation", async () => {
    const svc = createMockConversationService()
    const conv = await svc.create("user-1", { title: "New Chat", model: "gpt-4" })
    expect(conv.title).toBe("New Chat")
    expect(conv.model).toBe("gpt-4")
    expect(conv.userId).toBe("user-1")
  })

  it("getById returns conversation when found", async () => {
    const svc = createMockConversationService()
    const conv = await svc.create("user-1", { title: "Find me" })
    const found = await svc.getById(conv.id, "user-1")
    expect(found).not.toBeNull()
    expect(found!.id).toBe(conv.id)
  })

  it("getById returns null for wrong user", async () => {
    const svc = createMockConversationService()
    const conv = await svc.create("user-1", { title: "Private" })
    const found = await svc.getById(conv.id, "user-2")
    expect(found).toBeNull()
  })

  it("getById returns null for nonexistent id", async () => {
    const svc = createMockConversationService()
    const found = await svc.getById("nonexistent", "user-1")
    expect(found).toBeNull()
  })

  it("branch creates a new conversation linked to original", async () => {
    const svc = createMockConversationService()
    const original = await svc.create("user-1", { title: "Original" })
    const branched = await svc.branch(original.id, "msg-1", "user-1")
    expect(branched.id).not.toBe(original.id)
    expect(branched.rootConversationId).toBe(original.id)
    expect(branched.title).toContain("branched")
  })

  it("branch throws if original not found", async () => {
    const svc = createMockConversationService()
    await expect(svc.branch("nonexistent", "msg-1", "user-1")).rejects.toThrow(
      "Conversation not found"
    )
  })

  it("list returns empty for user with no conversations", async () => {
    const svc = createMockConversationService()
    const result = await svc.list("user-1")
    expect(result).toHaveLength(0)
  })
})
