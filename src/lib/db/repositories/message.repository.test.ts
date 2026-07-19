import { describe, it, expect } from "vitest"
import type { Message } from "../entities/message.entity"
import type { MessageRepository, MessageStatus } from "./message.repository"

function makeMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: overrides.id ?? "msg-1",
    conversationId: overrides.conversationId ?? "conv-1",
    userId: overrides.userId ?? "user-1",
    role: overrides.role ?? "user",
    content: overrides.content ?? "Hello",
    status: overrides.status ?? "complete",
    createdAt: overrides.createdAt ?? new Date("2025-01-01"),
  } as Message
}

function createInMemoryMessageRepo(): MessageRepository {
  const store = new Map<string, Message>()
  const statuses = new Map<string, MessageStatus>()

  return {
    async findById(id: string, userId: string) {
      const msg = store.get(id)
      if (msg && msg.userId === userId) return msg
      return null
    },
    async findByConversation(convId: string, userId: string) {
      return [...store.values()].filter(
        (m) => m.conversationId === convId && m.userId === userId
      )
    },
    async save(msg: Message) {
      store.set(msg.id, msg)
      return msg
    },
    async updateStatus(id: string, status: MessageStatus) {
      if (!store.has(id)) throw new Error("Message not found")
      statuses.set(id, status)
    },
  }
}

describe("MessageRepository", () => {
  it("save persists and findById retrieves a message", async () => {
    const repo = createInMemoryMessageRepo()
    const msg = makeMsg({ id: "m1", userId: "u1" })
    await repo.save(msg)
    const found = await repo.findById("m1", "u1")
    expect(found).not.toBeNull()
    expect(found!.id).toBe("m1")
  })

  it("findById returns null for missing message", async () => {
    const repo = createInMemoryMessageRepo()
    expect(await repo.findById("nope", "u1")).toBeNull()
  })

  it("findById returns null for wrong user", async () => {
    const repo = createInMemoryMessageRepo()
    await repo.save(makeMsg({ id: "m1", userId: "u1" }))
    expect(await repo.findById("m1", "u2")).toBeNull()
  })

  it("findByConversation returns messages for a conversation", async () => {
    const repo = createInMemoryMessageRepo()
    await repo.save(makeMsg({ id: "m1", conversationId: "c1", userId: "u1" }))
    await repo.save(makeMsg({ id: "m2", conversationId: "c1", userId: "u1" }))
    await repo.save(makeMsg({ id: "m3", conversationId: "c2", userId: "u1" }))
    const results = await repo.findByConversation("c1", "u1")
    expect(results).toHaveLength(2)
  })

  it("findByConversation filters by userId", async () => {
    const repo = createInMemoryMessageRepo()
    await repo.save(makeMsg({ id: "m1", conversationId: "c1", userId: "u1" }))
    await repo.save(makeMsg({ id: "m2", conversationId: "c1", userId: "u2" }))
    const results = await repo.findByConversation("c1", "u1")
    expect(results).toHaveLength(1)
    expect(results[0].userId).toBe("u1")
  })

  it("findByConversation returns empty for no matches", async () => {
    const repo = createInMemoryMessageRepo()
    expect(await repo.findByConversation("c1", "u1")).toHaveLength(0)
  })

  it("updateStatus updates the status", async () => {
    const repo = createInMemoryMessageRepo()
    await repo.save(makeMsg({ id: "m1" }))
    await expect(repo.updateStatus("m1", "failed")).resolves.toBeUndefined()
  })

  it("updateStatus throws for nonexistent message", async () => {
    const repo = createInMemoryMessageRepo()
    await expect(repo.updateStatus("nope", "sent")).rejects.toThrow(
      "Message not found"
    )
  })
})
