import { describe, it, expect } from "vitest"
import { Message } from "./message.entity"

describe("Message entity", () => {
  it("creates an instance", () => {
    const msg = new Message()
    expect(msg).toBeDefined()
    expect(msg).toBeInstanceOf(Message)
  })

  it("allows setting all properties", () => {
    const msg = new Message()
    msg.id = "msg-1"
    msg.conversationId = "conv-1"
    msg.userId = "user-1"
    msg.parentId = "parent-msg"
    msg.role = "assistant"
    msg.content = "Hello!"
    msg.model = "gpt-4"
    msg.status = "complete"
    msg.createdAt = new Date("2025-06-01")

    expect(msg.id).toBe("msg-1")
    expect(msg.conversationId).toBe("conv-1")
    expect(msg.userId).toBe("user-1")
    expect(msg.parentId).toBe("parent-msg")
    expect(msg.role).toBe("assistant")
    expect(msg.content).toBe("Hello!")
    expect(msg.model).toBe("gpt-4")
    expect(msg.status).toBe("complete")
    expect(msg.createdAt).toEqual(new Date("2025-06-01"))
  })

  it("has nullable optional fields", () => {
    const msg = new Message()
    expect(msg.parentId).toBeUndefined()
    expect(msg.model).toBeUndefined()
    expect(msg.parent).toBeUndefined()
  })

  it("allows setting status", () => {
    const msg = new Message()
    msg.status = "processing"
    expect(msg.status).toBe("processing")
    msg.status = "complete"
    expect(msg.status).toBe("complete")
    msg.status = "stopped"
    expect(msg.status).toBe("stopped")
  })
})
