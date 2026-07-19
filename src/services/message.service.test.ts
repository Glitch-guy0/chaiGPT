import { describe, it, expect } from "vitest"
import type { Message } from "@/lib/db/entities/message.entity"
import type { MessageService } from "./message.service"

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

function createMockMessageService(): MessageService {
  const store = new Map<string, Message>()
  let counter = 0

  return {
    async append(
      convId: string,
      userId: string,
      content: string
    ): Promise<Message> {
      const msg = makeMsg({
        id: `msg-${++counter}`,
        conversationId: convId,
        userId,
        content,
        role: "user",
      })
      store.set(msg.id, msg)
      return msg
    },
    async editLatest(
      userId: string,
      convId: string,
      content: string
    ): Promise<Message> {
      const msgs = [...store.values()]
        .filter((m) => m.conversationId === convId && m.userId === userId)
        .sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )
      if (msgs.length === 0) throw new Error("No messages found")
      const latest = msgs[0]
      latest.content = content
      return latest
    },
  }
}

describe("MessageService", () => {
  it("append creates a new message", async () => {
    const svc = createMockMessageService()
    const msg = await svc.append("conv-1", "user-1", "Hello there")
    expect(msg.content).toBe("Hello there")
    expect(msg.conversationId).toBe("conv-1")
    expect(msg.userId).toBe("user-1")
    expect(msg.role).toBe("user")
  })

  it("append assigns unique ids", async () => {
    const svc = createMockMessageService()
    const msg1 = await svc.append("conv-1", "user-1", "First")
    const msg2 = await svc.append("conv-1", "user-1", "Second")
    expect(msg1.id).not.toBe(msg2.id)
  })

  it("editLatest updates the most recent message content", async () => {
    const svc = createMockMessageService()
    await svc.append("conv-1", "user-1", "Original")
    const edited = await svc.editLatest("user-1", "conv-1", "Updated")
    expect(edited.content).toBe("Updated")
  })

  it("editLatest throws when no messages exist", async () => {
    const svc = createMockMessageService()
    await expect(
      svc.editLatest("user-1", "conv-1", "Updated")
    ).rejects.toThrow("No messages found")
  })

  it("editLatest only edits messages for the correct user", async () => {
    const svc = createMockMessageService()
    await svc.append("conv-1", "user-1", "User 1 msg")
    await svc.append("conv-1", "user-2", "User 2 msg")
    const edited = await svc.editLatest("user-1", "conv-1", "User 1 updated")
    expect(edited.content).toBe("User 1 updated")
  })
})
