import { describe, it, expect, beforeEach, vi } from "vitest";
import type { MessageRepository } from "@/lib/db/repositories/message.repository";
import type { ConversationRepository } from "@/lib/db/repositories/conversation.repository";
import type { Message } from "@/lib/db/entities/message.entity";
import type { Conversation } from "@/lib/db/entities/conversation.entity";
import { NotFoundError } from "@/lib/errors";

function createMockMessageRepo() {
  return {
    findById: vi.fn(),
    findByIdInConversation: vi.fn(),
    findAll: vi.fn(),
    findByConversation: vi.fn(),
    findLatestUserMessage: vi.fn(),
    findTrailingAssistantMessage: vi.fn(),
    findLatestSibling: vi.fn(),
    findSiblingsByParentId: vi.fn().mockResolvedValue([]),
    findByParentId: vi.fn().mockResolvedValue([]),
    findMessageChain: vi.fn().mockResolvedValue([]),
    save: vi.fn(),
    updateStatus: vi.fn(),
    tryStartRegenerate: vi.fn(),
    removeAssetId: vi.fn(),
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

function createMockAssetService() {
  return {
    ingest: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
  };
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

  describe("removeAssetFromMessage", () => {
    const USER_ID = "user-1";
    const MSG_ID = "msg-1";
    const ASSET_ID = "asset-1";

    it("delegates to repo.removeAssetId and assetService.remove", async () => {
      const assetSvc = createMockAssetService();
      const svcWithAsset = new MessageServiceImpl(
        messageRepo,
        conversationRepo,
        assetSvc as never,
      );

      messageRepo.findById.mockResolvedValue(makeMessage({ id: MSG_ID, assetIds: [ASSET_ID] }));

      await svcWithAsset.removeAssetFromMessage(MSG_ID, ASSET_ID, USER_ID);

      expect(messageRepo.findById).toHaveBeenCalledWith(MSG_ID, USER_ID);
      expect(messageRepo.removeAssetId).toHaveBeenCalledWith(MSG_ID, ASSET_ID, USER_ID);
      expect(assetSvc.remove).toHaveBeenCalledWith(ASSET_ID, USER_ID);
    });

    it("throws NotFoundError when message not found", async () => {
      messageRepo.findById.mockResolvedValue(null);

      await expect(
        service.removeAssetFromMessage(MSG_ID, ASSET_ID, USER_ID),
      ).rejects.toThrow(NotFoundError);
      expect(messageRepo.removeAssetId).not.toHaveBeenCalled();
    });

    it("works without assetService (optional)", async () => {
      messageRepo.findById.mockResolvedValue(makeMessage({ id: MSG_ID, assetIds: [ASSET_ID] }));

      await service.removeAssetFromMessage(MSG_ID, ASSET_ID, USER_ID);

      expect(messageRepo.removeAssetId).toHaveBeenCalledWith(MSG_ID, ASSET_ID, USER_ID);
    });

    it("enforces userId scoping", async () => {
      messageRepo.findById.mockResolvedValue(null);

      await expect(
        service.removeAssetFromMessage(MSG_ID, ASSET_ID, "wrong-user"),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("branch-aware editLatest", () => {
    const USER_ID = "user-1";
    const CONV_ID = "conv-1";
    const NEW_CONTENT = "edited content";

    function makeSibling(id: string, parentId: string, createdAt: Date, role: "user" | "assistant" = "user") {
      return makeMessage({ id, parentId, role, createdAt, content: `orig-${id}` });
    }

    it("AC#1 edits only the most-recently-created sibling", async () => {
      const conv = makeConversation({ lastMessageId: "asst-3" });
      const t1 = makeSibling("user-1", "P-1", new Date("2025-01-01T00:00:01Z"));
      const t2 = makeSibling("user-2", "P-1", new Date("2025-01-01T00:00:02Z"));
      const t3 = makeSibling("user-3", "P-1", new Date("2025-01-01T00:00:03Z"));

      conversationRepo.findById.mockResolvedValue(conv);
      messageRepo.findByIdInConversation
        .mockResolvedValueOnce(makeMessage({ id: "asst-3", role: "assistant", parentId: "user-3" }))
        .mockResolvedValueOnce(makeMessage({ id: "user-3", role: "user", parentId: "P-1" }));
      messageRepo.findSiblingsByParentId.mockResolvedValue([t1, t2, t3]);
      messageRepo.findLatestSibling.mockResolvedValue(t3);
      messageRepo.findTrailingAssistantMessage.mockResolvedValue(null);
      messageRepo.findByParentId.mockResolvedValue([]);
      messageRepo.save.mockImplementation(async (m: Partial<Message>) => m as Message);

      const result = await service.editLatest(USER_ID, CONV_ID, NEW_CONTENT);

      expect(messageRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: "user-3", content: NEW_CONTENT }));
      expect(result.userMessage.id).toBe("user-3");
      const savedIds = messageRepo.save.mock.calls.map((c) => c[0].id);
      expect(savedIds).not.toContain("user-1");
      expect(savedIds).not.toContain("user-2");
    });

    it("AC#2/AC#5 leaves lastMessageId and conversation untouched", async () => {
      const conv = makeConversation({ lastMessageId: "asst-3" });
      const t3 = makeSibling("user-3", "P-1", new Date("2025-01-01T00:00:03Z"));

      conversationRepo.findById.mockResolvedValue(conv);
      messageRepo.findByIdInConversation
        .mockResolvedValueOnce(makeMessage({ id: "asst-3", role: "assistant", parentId: "user-3" }))
        .mockResolvedValueOnce(makeMessage({ id: "user-3", role: "user", parentId: "P-1" }));
      messageRepo.findSiblingsByParentId.mockResolvedValue([t3]);
      messageRepo.findLatestSibling.mockResolvedValue(t3);
      messageRepo.findTrailingAssistantMessage.mockResolvedValue(null);
      messageRepo.findByParentId.mockResolvedValue([]);
      messageRepo.save.mockImplementation(async (m: Partial<Message>) => m as Message);

      const before = conv.lastMessageId;
      await service.editLatest(USER_ID, CONV_ID, NEW_CONTENT);

      expect(conversationRepo.save).not.toHaveBeenCalled();
      expect(conv.lastMessageId).toBe(before);
    });

    it("AC#3 rejects editing a branched-away sibling", async () => {
      const conv = makeConversation({ lastMessageId: "asst-3" });
      const t3 = makeSibling("user-3", "P-1", new Date("2025-01-01T00:00:03Z"));

      conversationRepo.findById.mockResolvedValue(conv);
      messageRepo.findByIdInConversation
        .mockResolvedValueOnce(makeMessage({ id: "asst-3", role: "assistant", parentId: "user-3" }))
        .mockResolvedValueOnce(makeMessage({ id: "user-3", role: "user", parentId: "P-1" }));
      messageRepo.findSiblingsByParentId.mockResolvedValue([t3]);
      messageRepo.findLatestSibling.mockResolvedValue(t3);
      messageRepo.findTrailingAssistantMessage.mockResolvedValue(null);
      messageRepo.findByParentId.mockResolvedValue([makeMessage({ id: "forked", conversationId: "conv-other", parentId: "user-3" })]);
      messageRepo.save.mockImplementation(async (m: Partial<Message>) => m as Message);

      await expect(service.editLatest(USER_ID, CONV_ID, NEW_CONTENT)).rejects.toThrow(
        "Cannot edit a message that has been branched from",
      );
      expect(messageRepo.save).not.toHaveBeenCalled();
    });

    it("AC#3 rejects editing a non-latest sibling", async () => {
      const conv = makeConversation({ lastMessageId: "asst-1" });
      const older = makeSibling("user-1", "P-1", new Date("2025-01-01T00:00:01Z"));
      const newer = makeSibling("user-2", "P-1", new Date("2025-01-01T00:00:02Z"));

      conversationRepo.findById.mockResolvedValue(conv);
      messageRepo.findByIdInConversation
        .mockResolvedValueOnce(makeMessage({ id: "asst-1", role: "assistant", parentId: "user-1" }))
        .mockResolvedValueOnce(makeMessage({ id: "user-1", role: "user", parentId: "P-1" }));
      messageRepo.findSiblingsByParentId.mockResolvedValue([older]);
      messageRepo.findLatestSibling.mockResolvedValue(newer);
      messageRepo.findByParentId.mockResolvedValue([]);
      messageRepo.save.mockImplementation(async (m: Partial<Message>) => m as Message);

      await expect(service.editLatest(USER_ID, CONV_ID, NEW_CONTENT)).rejects.toThrow(
        "Can only edit the most recent sibling",
      );
      expect(messageRepo.save).not.toHaveBeenCalled();
    });

    it("AC#4 regression: no parentId falls back to global latest user message", async () => {
      const conv = makeConversation({ lastMessageId: undefined });
      const userMsg = makeMessage({ id: "user-msg-1", role: "user", content: "original" });
      const assistantMsg = makeMessage({ id: "asst-msg-1", role: "assistant", content: "response" });

      conversationRepo.findById.mockResolvedValue(conv);
      messageRepo.findLatestUserMessage.mockResolvedValue(userMsg);
      messageRepo.findTrailingAssistantMessage.mockResolvedValue(assistantMsg);
      messageRepo.save.mockImplementation(async (m: Partial<Message>) => m as Message);

      const result = await service.editLatest(USER_ID, CONV_ID, NEW_CONTENT);

      expect(messageRepo.findLatestUserMessage).toHaveBeenCalledWith(CONV_ID, USER_ID);
      expect(result.userMessage.id).toBe("user-msg-1");
      expect(result.userMessage.content).toBe(NEW_CONTENT);
    });
  });
});
