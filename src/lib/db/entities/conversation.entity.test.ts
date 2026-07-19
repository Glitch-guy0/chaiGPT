import { describe, it, expect } from "vitest"
import { Conversation } from "./conversation.entity"

describe("Conversation entity", () => {
  it("creates an instance with expected properties", () => {
    const conv = new Conversation()
    expect(conv).toBeDefined()
    expect(conv).toBeInstanceOf(Conversation)
  })

  it("allows setting all properties", () => {
    const conv = new Conversation()
    conv.id = "test-id"
    conv.userId = "user-1"
    conv.title = "My Chat"
    conv.model = "gpt-4"
    conv.rootConversationId = "root-id"
    conv.lastMessageId = "msg-1"
    conv.createdAt = new Date("2025-01-01")
    conv.updatedAt = new Date("2025-01-02")
    conv.messages = []

    expect(conv.id).toBe("test-id")
    expect(conv.userId).toBe("user-1")
    expect(conv.title).toBe("My Chat")
    expect(conv.model).toBe("gpt-4")
    expect(conv.rootConversationId).toBe("root-id")
    expect(conv.lastMessageId).toBe("msg-1")
    expect(conv.createdAt).toEqual(new Date("2025-01-01"))
    expect(conv.updatedAt).toEqual(new Date("2025-01-02"))
    expect(conv.messages).toEqual([])
  })

  it("has nullable optional fields", () => {
    const conv = new Conversation()
    expect(conv.model).toBeUndefined()
    expect(conv.rootConversationId).toBeUndefined()
    expect(conv.lastMessageId).toBeUndefined()
    expect(conv.rootConversation).toBeUndefined()
    expect(conv.lastMessage).toBeUndefined()
  })
})
