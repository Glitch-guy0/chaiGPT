import { describe, it, expect, beforeEach, vi } from "vitest";
import type { MessageRepository } from "@/lib/db/repositories/message.repository";
import type { ConversationRepository } from "@/lib/db/repositories/conversation.repository";
import type { Message } from "@/lib/db/entities/message.entity";
import type { Conversation } from "@/lib/db/entities/conversation.entity";
import { NotFoundError } from "@/lib/errors";

function createMockMessageRepo() {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    findByConversation: vi.fn(),
    findLatestUserMessage: vi.fn(),
    findTrailingAssistantMessage: vi.fn(),
    save: vi.fn(),
    updateStatus: vi.fn(),
  } satisfies MessageRepository;
}

function createMockConversationRepo() {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    branch: vi.fn(),
  } satisfies ConversationRepository;
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    conversationId: "conv-1",
    userId: "user-1",
    role: "user",
    content: "original content",
    status: "complete",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Message;
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv-1",
    userId: "user-1",
    title: "Test Chat",
    model: "gpt-4o-mini",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  } as Conversation;
}

describe("MessageService (interface contract)", () => {
  it("should export the MessageService interface type", async () => {
    const mod = await import("./message.service");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });
});

describe("MessageServiceImpl", () => {
  let messageRepo: ReturnType<typeof createMockMessageRepo>;
  let conversationRepo: ReturnType<typeof createMockConversationRepo>;
  let MessageServiceImpl: typeof import("./message.service").MessageServiceImpl;
  let service: import("./message.service").MessageServiceImpl;

  beforeEach(async () => {
    messageRepo = createMockMessageRepo();
    conversationRepo = createMockConversationRepo();
    const mod = await import("./message.service");
    MessageServiceImpl = mod.MessageServiceImpl;
    service = new MessageServiceImpl(messageRepo, conversationRepo);
  });

  describe("editLatest", () => {
    const USER_ID = "user-1";
    const CONV_ID = "conv-1";
    const NEW_CONTENT = "edited content";

    it("updates latest user message content (same ID)", async () => {
      const conv = makeConversation();
      const userMsg = makeMessage({ id: "user-msg-1", role: "user", content: "original" });
      const assistantMsg = makeMessage({ id: "asst-msg-1", role: "assistant", content: "response" });

      conversationRepo.findById.mockResolvedValue(conv);
      messageRepo.findLatestUserMessage.mockResolvedValue(userMsg);
      messageRepo.findTrailingAssistantMessage.mockResolvedValue(assistantMsg);
      messageRepo.save.mockImplementation(async (m: Partial<Message>) => m as Message);

      const result = await service.editLatest(USER_ID, CONV_ID, NEW_CONTENT);

      expect(messageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: "user-msg-1", content: NEW_CONTENT }),
      );
      expect(result.userMessage.content).toBe(NEW_CONTENT);
      expect(result.userMessage.id).toBe("user-msg-1");
    });

    it("updates trailing assistant content (same ID)", async () => {
      const conv = makeConversation();
      const userMsg = makeMessage({ id: "user-msg-1", role: "user" });
      const assistantMsg = makeMessage({ id: "asst-msg-1", role: "assistant", content: "original response" });

      conversationRepo.findById.mockResolvedValue(conv);
      messageRepo.findLatestUserMessage.mockResolvedValue(userMsg);
      messageRepo.findTrailingAssistantMessage.mockResolvedValue(assistantMsg);
      messageRepo.save.mockImplementation(async (m: Partial<Message>) => m as Message);

      const result = await service.editLatest(USER_ID, CONV_ID, NEW_CONTENT);

      expect(messageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: "asst-msg-1", content: "" }),
      );
      expect(result.assistantMessage.content).toBe("");
      expect(result.assistantMessage.id).toBe("asst-msg-1");
    });

    it("throws NotFoundError when conversation not found", async () => {
      conversationRepo.findById.mockResolvedValue(null);

      await expect(
        service.editLatest(USER_ID, CONV_ID, NEW_CONTENT),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when no user messages exist", async () => {
      conversationRepo.findById.mockResolvedValue(makeConversation());
      messageRepo.findLatestUserMessage.mockResolvedValue(null);

      await expect(
        service.editLatest(USER_ID, CONV_ID, NEW_CONTENT),
      ).rejects.toThrow(NotFoundError);
    });

    it("does not change lastMessageId", async () => {
      const conv = makeConversation({ lastMessageId: "asst-msg-1" });
      const userMsg = makeMessage({ id: "user-msg-1", role: "user" });
      const assistantMsg = makeMessage({ id: "asst-msg-1", role: "assistant" });

      conversationRepo.findById.mockResolvedValue(conv);
      messageRepo.findLatestUserMessage.mockResolvedValue(userMsg);
      messageRepo.findTrailingAssistantMessage.mockResolvedValue(assistantMsg);
      messageRepo.save.mockImplementation(async (m: Partial<Message>) => m as Message);

      const before = conv.lastMessageId;
      await service.editLatest(USER_ID, CONV_ID, NEW_CONTENT);

      expect(conversationRepo.save).not.toHaveBeenCalled();
      expect(conv.lastMessageId).toBe(before);
    });

    it("queries with userId scoping", async () => {
      const conv = makeConversation();
      const userMsg = makeMessage({ id: "user-msg-1", role: "user" });
      const assistantMsg = makeMessage({ id: "asst-msg-1", role: "assistant" });

      conversationRepo.findById.mockResolvedValue(conv);
      messageRepo.findLatestUserMessage.mockResolvedValue(userMsg);
      messageRepo.findTrailingAssistantMessage.mockResolvedValue(assistantMsg);
      messageRepo.save.mockImplementation(async (m: Partial<Message>) => m as Message);

      await service.editLatest(USER_ID, CONV_ID, NEW_CONTENT);

      expect(conversationRepo.findById).toHaveBeenCalledWith(CONV_ID, USER_ID);
      expect(messageRepo.findLatestUserMessage).toHaveBeenCalledWith(CONV_ID, USER_ID);
      expect(messageRepo.findTrailingAssistantMessage).toHaveBeenCalledWith(CONV_ID, "user-msg-1", USER_ID);
    });
  });
});
