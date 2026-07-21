import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ConversationRepository } from "../lib/db/repositories/conversation.repository";
import type { MessageRepository } from "../lib/db/repositories/message.repository";
import type { Conversation } from "../lib/db/entities/conversation.entity";
import type { Message } from "../lib/db/entities/message.entity";
import { NotFoundError } from "../lib/errors";

function createMockRepo() {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    branch: vi.fn(),
  } satisfies ConversationRepository;
}

function createMockMessageRepo() {
  return {
    findById: vi.fn(),
    findByIdInConversation: vi.fn(),
    findAll: vi.fn(),
    findByConversation: vi.fn(),
    findLatestUserMessage: vi.fn(),
    findTrailingAssistantMessage: vi.fn(),
    findLatestSibling: vi.fn().mockResolvedValue(null),
    findSiblingsByParentId: vi.fn().mockResolvedValue([]),
    findByParentId: vi.fn().mockResolvedValue([]),
    findMessageChain: vi.fn().mockResolvedValue([]),
    save: vi.fn(),
    updateStatus: vi.fn(),
    tryStartRegenerate: vi.fn(),
    removeAssetId: vi.fn(),
  } satisfies MessageRepository;
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

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    conversationId: "conv-1",
    userId: "user-1",
    parentId: "msg-0",
    role: "assistant",
    content: "Hi there",
    status: "complete",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  } as Message;
}

describe("ConversationService (interface contract)", () => {
  it("should export the ConversationService interface type", async () => {
    const mod = await import("./conversation.service");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });
});

describe("ConversationServiceImpl", () => {
  let repo: ReturnType<typeof createMockRepo>;
  let messageRepo: ReturnType<typeof createMockMessageRepo>;
  let service: import("./conversation.service").ConversationServiceImpl;

  beforeEach(async () => {
    repo = createMockRepo();
    messageRepo = createMockMessageRepo();
    const mod = await import("./conversation.service");
    service = new mod.ConversationServiceImpl(repo, messageRepo);
  });

  describe("list", () => {
    it("returns only caller's conversations ordered by updatedAt DESC capped at 50", async () => {
      const older = makeConversation({
        id: "c1",
        updatedAt: new Date("2025-01-01T00:00:00Z"),
      });
      const newer = makeConversation({
        id: "c2",
        updatedAt: new Date("2025-01-02T00:00:00Z"),
      });
      repo.findAll.mockResolvedValue([older, newer]);

      const result = await service.list("user-1");

      expect(repo.findAll).toHaveBeenCalledWith("user-1");
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("c2");
      expect(result[1].id).toBe("c1");
    });

    it("caps results at 50", async () => {
      const many = Array.from({ length: 60 }, (_, i) =>
        makeConversation({
          id: `c${i}`,
          updatedAt: new Date(2025, 0, 1, 0, 0, i),
        })
      );
      repo.findAll.mockResolvedValue(many);

      const result = await service.list("user-1");

      expect(result).toHaveLength(50);
    });
  });

  describe("create", () => {
    it("creates with defaults when no input provided", async () => {
      const saved = makeConversation({ title: "New Chat" });
      repo.save.mockResolvedValue(saved);

      const result = await service.create("user-1", {});

      expect(repo.save).toHaveBeenCalledWith({
        userId: "user-1",
        title: "New Chat",
        model: "gpt-4o-mini",
      });
      expect(result.title).toBe("New Chat");
    });

    it("creates with explicit title and model", async () => {
      const saved = makeConversation({ title: "My Chat", model: "gpt-4" });
      repo.save.mockResolvedValue(saved);

      const result = await service.create("user-1", {
        title: "My Chat",
        model: "gpt-4",
      });

      expect(repo.save).toHaveBeenCalledWith({
        userId: "user-1",
        title: "My Chat",
        model: "gpt-4",
      });
      expect(result.title).toBe("My Chat");
      expect(result.model).toBe("gpt-4");
    });

    it("rejects invalid input via Zod", async () => {
      await expect(
        service.create("user-1", { title: "" })
      ).rejects.toThrow();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("returns conversation when found", async () => {
      const conv = makeConversation({ id: "conv-1", userId: "user-1" });
      repo.findById.mockResolvedValue(conv);

      const result = await service.getById("conv-1", "user-1");

      expect(repo.findById).toHaveBeenCalledWith("conv-1", "user-1");
      expect(result.id).toBe("conv-1");
    });

    it("throws NotFoundError when conversation is null", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        service.getById("nonexistent", "user-1")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("branch", () => {
    it("creates new conversation via repo.branch", async () => {
      const conv = makeConversation({ id: "conv-1", userId: "user-1" });
      const msg = makeMessage({ id: "msg-1", conversationId: "conv-1", userId: "user-1" });
      const branch = makeConversation({ id: "branch-1", userId: "user-1" });
      repo.findById.mockResolvedValue(conv);
      messageRepo.findById.mockResolvedValue(msg);
      repo.branch.mockResolvedValue(branch);

      const result = await service.branch("conv-1", "msg-1", "user-1");

      expect(repo.branch).toHaveBeenCalledWith("conv-1", "msg-1", "user-1");
      expect(result.id).toBe("branch-1");
    });

    it("throws NotFoundError on non-existent conversation", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        service.branch("missing", "msg-1", "user-1")
      ).rejects.toThrow(NotFoundError);
      expect(repo.branch).not.toHaveBeenCalled();
    });

    it("throws NotFoundError on non-existent message", async () => {
      const conv = makeConversation({ id: "conv-1", userId: "user-1" });
      repo.findById.mockResolvedValue(conv);
      messageRepo.findById.mockResolvedValue(null);

      await expect(
        service.branch("conv-1", "missing", "user-1")
      ).rejects.toThrow(NotFoundError);
      expect(repo.branch).not.toHaveBeenCalled();
    });

    it("rejects non-assistant messages", async () => {
      const conv = makeConversation({ id: "conv-1", userId: "user-1" });
      const msg = makeMessage({ id: "msg-1", role: "user" });
      repo.findById.mockResolvedValue(conv);
      messageRepo.findById.mockResolvedValue(msg);

      await expect(
        service.branch("conv-1", "msg-1", "user-1")
      ).rejects.toThrow(/assistant/);
      expect(repo.branch).not.toHaveBeenCalled();
    });

    it("rejects messages without parentId", async () => {
      const conv = makeConversation({ id: "conv-1", userId: "user-1" });
      const msg = makeMessage({ id: "msg-1", parentId: undefined });
      repo.findById.mockResolvedValue(conv);
      messageRepo.findById.mockResolvedValue(msg);

      await expect(
        service.branch("conv-1", "msg-1", "user-1")
      ).rejects.toThrow(/parentId/);
      expect(repo.branch).not.toHaveBeenCalled();
    });
  });
});
