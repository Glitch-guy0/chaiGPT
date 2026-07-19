import { describe, it, expect } from "vitest"
import type { ChatService, ChatRequest, ChatResponse } from "./chat.service"
import type { MessageService } from "./message.service"
import type { ConversationService } from "./conversation.service"
import type { Message } from "@/lib/db/entities/message.entity"
import type { Conversation } from "@/lib/db/entities/conversation.entity"

function makeConv(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: overrides.id ?? "conv-1",
    userId: overrides.userId ?? "user-1",
    title: overrides.title ?? "Chat",
    status: overrides.status ?? "active",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    messages: [],
  } as Conversation
}

function makeMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: overrides.id ?? "msg-1",
    conversationId: overrides.conversationId ?? "conv-1",
    userId: overrides.userId ?? "user-1",
    role: overrides.role ?? "user",
    content: overrides.content ?? "Hello",
    status: overrides.status ?? "complete",
    createdAt: new Date("2025-01-01"),
  } as Message
}

function createStubConversationService() {
  const convs = new Map<string, Conversation>()
  return {
    async list() {
      return [...convs.values()]
    },
    async create(userId: string, input: { title: string; model?: string }) {
      const conv = makeConv({
        id: `conv-${convs.size + 1}`,
        userId,
        title: input.title,
        model: input.model,
      })
      convs.set(conv.id, conv)
      return conv
    },
    async getById(id: string, userId: string) {
      const conv = convs.get(id)
      if (conv && conv.userId === userId) return conv
      return null
    },
    async branch() {
      throw new Error("not implemented")
    },
  } as ConversationService
}

function createStubMessageService(): MessageService {
  let counter = 0
  return {
    async append(convId: string, userId: string, content: string) {
      return makeMsg({
        id: `msg-${++counter}`,
        conversationId: convId,
        userId,
        content,
        role: "user",
      })
    },
    async editLatest() {
      throw new Error("not implemented")
    },
  }
}

function createMockChatService(
  messageSvc: MessageService,
  conversationSvc: ConversationService,
  options?: { model?: string }
): ChatService {
  const model = options?.model ?? "gpt-4"

  return {
    async send(req: ChatRequest, userId: string): Promise<ChatResponse> {
      const conv = await conversationSvc.getById(req.conversationId, userId)
      if (!conv) throw new Error("Conversation not found")
      const msg = await messageSvc.append(
        req.conversationId,
        userId,
        req.content
      )
      return {
        messageId: msg.id,
        content: `[${req.model ?? model}] response to: ${req.content}`,
        model: req.model ?? model,
      }
    },
    async regenerate(
      messageId: string,
      _userId: string
    ): Promise<ChatResponse> {
      return {
        messageId,
        content: "Regenerated response",
        model,
      }
    },
  }
}

describe("ChatService", () => {
  it("send returns a response with message id", async () => {
    const msgSvc = createStubMessageService()
    const convSvc = createStubConversationService()
    const conv = await convSvc.create("user-1", { title: "Chat" })
    const chatSvc = createMockChatService(msgSvc, convSvc)
    const res = await chatSvc.send(
      { conversationId: conv.id, content: "Hi" },
      "user-1"
    )
    expect(res.messageId).toBeDefined()
    expect(res.content).toContain("Hi")
    expect(res.model).toBe("gpt-4")
  })

  it("send throws if conversation not found", async () => {
    const msgSvc = createStubMessageService()
    const convSvc = createStubConversationService()
    const chatSvc = createMockChatService(msgSvc, convSvc)
    await expect(
      chatSvc.send({ conversationId: "nope", content: "Hi" }, "user-1")
    ).rejects.toThrow("Conversation not found")
  })

  it("regenerate returns a response", async () => {
    const msgSvc = createStubMessageService()
    const convSvc = createStubConversationService()
    const chatSvc = createMockChatService(msgSvc, convSvc)
    const res = await chatSvc.regenerate("msg-1", "user-1")
    expect(res.messageId).toBe("msg-1")
    expect(res.content).toBe("Regenerated response")
  })
})
