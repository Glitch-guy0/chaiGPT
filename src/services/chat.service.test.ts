import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ChatRequest, ChatMessage } from "@/types";
import type { AssetRepository } from "@/lib/db/repositories/asset.repository";
import type { ConversationRepository } from "@/lib/db/repositories/conversation.repository";
import type { MessageRepository, MessageStatus } from "@/lib/db/repositories/message.repository";
import type { Conversation } from "@/lib/db/entities/conversation.entity";
import type { Message } from "@/lib/db/entities/message.entity";
import { MockAiProvider } from "../../tests/fixtures/mock-ai-provider";
import { MockQdrantStore } from "../../tests/fixtures/mock-qdrant-store";
import { NotFoundError } from "@/lib/errors";

const CONV_ID = "00000000-0000-0000-0000-000000000000";
const CONV_ID_ALT = "ffffffff-ffff-ffff-ffff-ffffffffffff";

function createMockConversationRepo() {
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
    findAll: vi.fn(),
    findByConversation: vi.fn(),
    findLatestUserMessage: vi.fn(),
    findTrailingAssistantMessage: vi.fn(),
    save: vi.fn(),
    updateStatus: vi.fn(),
  } satisfies MessageRepository;
}

function createMockAssetRepo() {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    findByConversation: vi.fn(),
    delete: vi.fn(),
  } satisfies AssetRepository;
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: CONV_ID,
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
    role: "assistant",
    content: "",
    status: "processing",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Message;
}

function makeChatRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    messages: [{ role: "user", content: "Hello" }],
    model: "gpt-4o-mini",
    ...overrides,
  };
}

async function collectStreamEvents(
  stream: ReadableStream,
): Promise<string[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    events.push(decoder.decode(value));
  }

  return events;
}

describe("ChatService (interface contract)", () => {
  it("should export the ChatService interface type", async () => {
    const mod = await import("./chat.service");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });
});

describe("ChatServiceImpl", () => {
  let conversationRepo: ReturnType<typeof createMockConversationRepo>;
  let messageRepo: ReturnType<typeof createMockMessageRepo>;
  let aiProvider: MockAiProvider;
  let ChatServiceImpl: typeof import("./chat.service").ChatServiceImpl;
  let service: import("./chat.service").ChatServiceImpl;
  let msgCounter: number;

  beforeEach(async () => {
    msgCounter = 0;
    conversationRepo = createMockConversationRepo();
    messageRepo = createMockMessageRepo();

    messageRepo.findByConversation.mockResolvedValue([]);

    messageRepo.save.mockImplementation(
      async (m: Partial<Message>) => {
        msgCounter++;
        return makeMessage({
          id: m.id || `msg-${msgCounter}`,
          conversationId: m.conversationId || CONV_ID,
          userId: m.userId || "user-1",
          role: m.role || "assistant",
          content: m.content || "",
          status: (m.status as MessageStatus) || "processing",
        } as Message);
      },
    );

    aiProvider = new MockAiProvider();
    const mod = await import("./chat.service");
    ChatServiceImpl = mod.ChatServiceImpl;
    service = new ChatServiceImpl(
      conversationRepo,
      messageRepo,
      aiProvider,
    );
  });

  describe("send", () => {
    it("saves user message with status complete", async () => {
      const conv = makeConversation({ id: CONV_ID });
      conversationRepo.save.mockResolvedValue(conv);
      conversationRepo.findById.mockResolvedValue(null);

      const stream = await service.send(makeChatRequest(), "user-1");
      await collectStreamEvents(stream);

      expect(messageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "user",
          content: "Hello",
          status: "complete",
        }),
      );
    });

    it("creates assistant message with status processing before streaming begins", async () => {
      conversationRepo.save.mockResolvedValue(makeConversation());
      conversationRepo.findById.mockResolvedValue(null);

      const stream = await service.send(makeChatRequest(), "user-1");
      await collectStreamEvents(stream);

      const saveCalls = messageRepo.save.mock.calls;
      const assistantSave = saveCalls.find(
        (call: Partial<Message>[]) => call[0]?.role === "assistant",
      );
      expect(assistantSave).toBeDefined();
      expect(assistantSave![0]).toMatchObject({
        role: "assistant",
        content: "",
        status: "processing",
      });
    });

    it("streams tokens through SSE data events", async () => {
      conversationRepo.save.mockResolvedValue(makeConversation());
      conversationRepo.findById.mockResolvedValue(null);

      aiProvider.onStream(async (_msgs, onChunk) => {
        onChunk("Hello ");
        onChunk("world");
      });

      const stream = await service.send(makeChatRequest(), "user-1");
      const events = await collectStreamEvents(stream);

      expect(events).toEqual(
        expect.arrayContaining([
          `data: ${JSON.stringify({ token: "Hello " })}\n\n`,
          `data: ${JSON.stringify({ token: "world" })}\n\n`,
        ]),
      );
    });

    it("persists assistant content and status complete on stream completion", async () => {
      conversationRepo.save.mockResolvedValue(makeConversation());
      conversationRepo.findById.mockResolvedValue(null);

      aiProvider.onStream(async (_msgs, onChunk) => {
        onChunk("Final response");
      });

      const stream = await service.send(makeChatRequest(), "user-1");
      await collectStreamEvents(stream);

      const completeSaves = messageRepo.save.mock.calls.filter(
        (c: Partial<Message>[]) => c[0]?.status === "complete" && c[0]?.role === undefined,
      );
      expect(completeSaves.length).toBe(1);
      expect(completeSaves[0][0]).toMatchObject({
        content: "Final response",
        status: "complete",
      });
    });

    it("sends done SSE event on completion", async () => {
      conversationRepo.save.mockResolvedValue(makeConversation());
      conversationRepo.findById.mockResolvedValue(null);

      aiProvider.onStream(async (_msgs, onChunk) => {
        onChunk("Done");
      });

      const stream = await service.send(makeChatRequest(), "user-1");
      const events = await collectStreamEvents(stream);

      const hasDoneEvent = events.some((e) => e.includes("event: done"));
      expect(hasDoneEvent).toBe(true);
      const doneEvent = events.find((e) => e.includes("event: done"));
      expect(doneEvent).toContain('"status":"complete"');
    });

    it("persists stopped status when AI provider throws", async () => {
      conversationRepo.save.mockResolvedValue(makeConversation());
      conversationRepo.findById.mockResolvedValue(null);

      aiProvider.onStream(async () => {
        throw new Error("AI failed");
      });

      const stream = await service.send(makeChatRequest(), "user-1");
      await collectStreamEvents(stream);

      expect(messageRepo.updateStatus).toHaveBeenCalledWith(
        expect.any(String),
        "stopped",
        "user-1",
      );
      expect(messageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "user terminated the response",
        }),
      );
    });

    it("sends stopped SSE event on stream error", async () => {
      conversationRepo.save.mockResolvedValue(makeConversation());
      conversationRepo.findById.mockResolvedValue(null);

      aiProvider.onStream(async () => {
        throw new Error("AI failed");
      });

      const stream = await service.send(makeChatRequest(), "user-1");
      const events = await collectStreamEvents(stream);

      const hasStoppedEvent = events.some((e) => e.includes("event: stopped"));
      expect(hasStoppedEvent).toBe(true);
      const stoppedEvent = events.find((e) => e.includes("event: stopped"));
      expect(stoppedEvent).toContain('"status":"stopped"');
    });

    it("creates new conversation when conversationId not provided", async () => {
      const newConv = makeConversation({ id: CONV_ID });
      conversationRepo.save.mockResolvedValue(newConv);

      const stream = await service.send(makeChatRequest({ conversationId: undefined }), "user-1");
      await collectStreamEvents(stream);

      expect(conversationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          title: "Hello",
          model: "gpt-4o-mini",
        }),
      );
    });

    it("uses existing conversation when conversationId provided", async () => {
      const existingConv = makeConversation({ id: CONV_ID });
      conversationRepo.findById.mockResolvedValue(existingConv);
      messageRepo.findByConversation.mockResolvedValue([]);

      const stream = await service.send(
        makeChatRequest({ conversationId: CONV_ID }),
        "user-1",
      );
      await collectStreamEvents(stream);

      expect(conversationRepo.findById).toHaveBeenCalledWith(
        CONV_ID,
        "user-1",
      );
      expect(conversationRepo.save).not.toHaveBeenCalled();
    });

    it("throws NotFoundError for missing conversation", async () => {
      conversationRepo.findById.mockResolvedValue(null);

      await expect(
        service.send(
          makeChatRequest({ conversationId: CONV_ID }),
          "user-1",
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it("rejects invalid input via Zod before any persistence", async () => {
      const invalidReq = { messages: [] } as unknown as ChatRequest;

      await expect(
        service.send(invalidReq, "user-1"),
      ).rejects.toThrow();

      expect(conversationRepo.save).not.toHaveBeenCalled();
      expect(conversationRepo.findById).not.toHaveBeenCalled();
      expect(messageRepo.save).not.toHaveBeenCalled();
    });

    it("includes conversation history in AI messages", async () => {
      conversationRepo.save.mockResolvedValue(makeConversation());
      conversationRepo.findById.mockResolvedValue(null);
      messageRepo.findByConversation.mockResolvedValue([
        makeMessage({
          id: "hist-1",
          role: "user",
          content: "Previous user message",
          status: "complete",
        }),
        makeMessage({
          id: "hist-2",
          role: "assistant",
          content: "Previous assistant response",
          status: "complete",
        }),
      ]);

      let sentMessages: ChatMessage[] = [];
      aiProvider.onStream(async (msgs, onChunk) => {
        sentMessages = msgs;
        onChunk("ok");
      });

      const stream = await service.send(makeChatRequest(), "user-1");
      await collectStreamEvents(stream);

      expect(sentMessages.length).toBeGreaterThanOrEqual(3);
      expect(sentMessages[0]).toMatchObject({ role: "system" });
      const historyMsgs = sentMessages.filter(
        (m) => m.role === "user" || m.role === "assistant",
      );
      expect(historyMsgs.length).toBeGreaterThanOrEqual(2);
    });

    it("injects RAG context when qdrantStore available", async () => {
      const ragConv = makeConversation({ id: CONV_ID_ALT });
      conversationRepo.save.mockResolvedValue(ragConv);
      conversationRepo.findById.mockResolvedValue(ragConv);

      const qdrant = new MockQdrantStore();
      qdrant.onEmbed(async () => [0.1, 0.2, 0.3]);
      qdrant.onSearch(async () => [
        { chunkId: "c1", assetId: "a1", score: 0.9, text: "Relevant doc text" },
      ]);

      const mod = await import("./chat.service");
      service = new ChatServiceImpl(
        conversationRepo,
        messageRepo,
        aiProvider,
        undefined,
        qdrant,
      );

      let sentMessages: ChatMessage[] = [];
      aiProvider.onStream(async (msgs, onChunk) => {
        sentMessages = msgs;
        onChunk("ok");
      });

      const stream = await service.send(
        makeChatRequest({ conversationId: CONV_ID_ALT }),
        "user-1",
      );
      await collectStreamEvents(stream);

      const ragMsg = sentMessages.find(
        (m) => m.role === "system" && m.content.includes("Relevant context"),
      );
      expect(ragMsg).toBeDefined();
      expect(ragMsg!.content).toContain("Relevant doc text");
    });

    it("gracefully degrades when RAG fails", async () => {
      const ragConv = makeConversation();
      conversationRepo.findById.mockResolvedValue(ragConv);

      const qdrant = new MockQdrantStore();
      qdrant.onEmbed(async () => { throw new Error("Embed failed"); });

      const mod = await import("./chat.service");
      service = new ChatServiceImpl(
        conversationRepo,
        messageRepo,
        aiProvider,
        undefined,
        qdrant,
      );

      let sentMessages: ChatMessage[] = [];
      aiProvider.onStream(async (msgs, onChunk) => {
        sentMessages = msgs;
        onChunk("ok");
      });

      const stream = await service.send(
        makeChatRequest({ conversationId: CONV_ID }),
        "user-1",
      );
      await collectStreamEvents(stream);

      const ragMsg = sentMessages.find(
        (m) => m.role === "system" && m.content.includes("Relevant context"),
      );
      expect(ragMsg).toBeUndefined();
    });

    it("splits content over 500 chars and saves inline part only", async () => {
      conversationRepo.save.mockResolvedValue(makeConversation());
      conversationRepo.findById.mockResolvedValue(null);

      const longContent = "x".repeat(600);
      const stream = await service.send(
        makeChatRequest({ messages: [{ role: "user", content: longContent }] }),
        "user-1",
      );
      await collectStreamEvents(stream);

      const userSaveCall = messageRepo.save.mock.calls.find(
        (c: Partial<Message>[]) => c[0]?.role === "user",
      );
      expect(userSaveCall![0]).toMatchObject({
        content: "x".repeat(500),
        status: "complete",
      });
    });

    it("creates asset when content exceeds 500 chars", async () => {
      conversationRepo.save.mockResolvedValue(makeConversation());
      conversationRepo.findById.mockResolvedValue(null);

      const assetRepo = createMockAssetRepo();
      assetRepo.save.mockResolvedValue({ id: "asset-1" } as any);

      const mod = await import("./chat.service");
      service = new ChatServiceImpl(
        conversationRepo,
        messageRepo,
        aiProvider,
        assetRepo,
      );

      const longContent = "y".repeat(600);
      const stream = await service.send(
        makeChatRequest({ messages: [{ role: "user", content: longContent }] }),
        "user-1",
      );
      await collectStreamEvents(stream);

      expect(assetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: expect.stringMatching(/^pasted-\d+-\d+\.txt$/),
          mime: "text/plain",
        }),
      );
    });

    it("does not create asset when content ≤ 500 chars", async () => {
      conversationRepo.save.mockResolvedValue(makeConversation());
      conversationRepo.findById.mockResolvedValue(null);

      const assetRepo = createMockAssetRepo();

      const mod = await import("./chat.service");
      service = new ChatServiceImpl(
        conversationRepo,
        messageRepo,
        aiProvider,
        assetRepo,
      );

      const stream = await service.send(
        makeChatRequest({ messages: [{ role: "user", content: "Hello" }] }),
        "user-1",
      );
      await collectStreamEvents(stream);

      expect(assetRepo.save).not.toHaveBeenCalled();
    });

    it("does not create asset when assetRepo not configured", async () => {
      conversationRepo.save.mockResolvedValue(makeConversation());
      conversationRepo.findById.mockResolvedValue(null);

      const longContent = "z".repeat(600);
      const stream = await service.send(
        makeChatRequest({ messages: [{ role: "user", content: longContent }] }),
        "user-1",
      );
      await collectStreamEvents(stream);

      const userSaveCall = messageRepo.save.mock.calls.find(
        (c: Partial<Message>[]) => c[0]?.role === "user",
      );
      expect(userSaveCall![0]).toMatchObject({
        content: "z".repeat(500),
        status: "complete",
      });
    });
  });

  describe("stream", () => {
    it("delegates to aiProvider.streamChat", async () => {
      const chunks: string[] = [];
      aiProvider.onStream(async (_msgs, onChunk) => {
        onChunk("token1");
        onChunk("token2");
      });

      await service.stream(
        makeChatRequest(),
        (token) => chunks.push(token),
      );

      expect(chunks).toEqual(["token1", "token2"]);
    });
  });

  describe("regenerate", () => {
    it("re-processes a stopped message and returns a stream", async () => {
      const stoppedMsg = makeMessage({ id: "msg-stop-1", status: "stopped", role: "assistant", content: "previous" });
      messageRepo.findById.mockResolvedValue(stoppedMsg);
      messageRepo.findByConversation.mockResolvedValue([
        makeMessage({ id: "hist-1", role: "user", content: "Hello", status: "complete" }),
        stoppedMsg,
      ]);

      aiProvider.onStream(async (_msgs, onChunk) => {
        onChunk("New ");
        onChunk("response");
      });

      const stream = await service.regenerate("msg-stop-1", "user-1");
      const events = await collectStreamEvents(stream);

      expect(messageRepo.updateStatus).toHaveBeenCalledWith("msg-stop-1", "processing", "user-1");
      expect(events).toEqual(
        expect.arrayContaining([
          `data: ${JSON.stringify({ token: "New " })}\n\n`,
          `data: ${JSON.stringify({ token: "response" })}\n\n`,
        ]),
      );
      const doneEvent = events.find((e) => e.includes("event: done"));
      expect(doneEvent).toContain('"id":"msg-stop-1"');
      expect(doneEvent).toContain('"status":"complete"');
    });

    it("rejects non-stopped messages", async () => {
      const completeMsg = makeMessage({ id: "msg-c-1", status: "complete", role: "assistant" });
      messageRepo.findById.mockResolvedValue(completeMsg);

      await expect(
        service.regenerate("msg-c-1", "user-1"),
      ).rejects.toThrow("Can only regenerate stopped assistant messages");
    });

    it("throws NotFoundError for non-existent or non-owned message", async () => {
      messageRepo.findById.mockResolvedValue(null);

      await expect(
        service.regenerate("msg-nonexistent", "user-1"),
      ).rejects.toThrow(NotFoundError);
    });

    it("does not create a new message row during regenerate", async () => {
      const stoppedMsg = makeMessage({ id: "msg-stop-2", status: "stopped", role: "assistant" });
      messageRepo.findById.mockResolvedValue(stoppedMsg);
      messageRepo.findByConversation.mockResolvedValue([
        makeMessage({ id: "hist-2", role: "user", content: "Hi", status: "complete" }),
        stoppedMsg,
      ]);

      aiProvider.onStream(async (_msgs, onChunk) => {
        onChunk("OK");
      });

      await collectStreamEvents(await service.regenerate("msg-stop-2", "user-1"));

      const saveCalls = messageRepo.save.mock.calls.filter(
        (c: Partial<Message>[]) => c[0]?.id === "msg-stop-2",
      );
      expect(saveCalls.length).toBeGreaterThanOrEqual(1);
      const newMsgCalls = messageRepo.save.mock.calls.filter(
        (c: Partial<Message>[]) => c[0]?.id === undefined,
      );
      expect(newMsgCalls.length).toBe(0);
    });

    it("sets stopped status on abort during regenerate", async () => {
      const stoppedMsg = makeMessage({ id: "msg-abort", status: "stopped", role: "assistant" });
      messageRepo.findById.mockResolvedValue(stoppedMsg);
      messageRepo.findByConversation.mockResolvedValue([
        makeMessage({ id: "hist-3", role: "user", content: "Hi", status: "complete" }),
        stoppedMsg,
      ]);

      aiProvider.onStream(async () => {
        throw new Error("Stream aborted");
      });

      const stream = await service.regenerate("msg-abort", "user-1");
      await collectStreamEvents(stream);

      expect(messageRepo.updateStatus).toHaveBeenCalledWith("msg-abort", "stopped", "user-1");
      const stoppedSave = messageRepo.save.mock.calls.find(
        (c: Partial<Message>[]) => c[0]?.id === "msg-abort" && c[0]?.content === "user terminated the response",
      );
      expect(stoppedSave).toBeDefined();
    });
  });
});
