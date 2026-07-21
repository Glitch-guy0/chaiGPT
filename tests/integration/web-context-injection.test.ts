import { describe, it, expect, vi } from "vitest";
import { ChatServiceImpl } from "@/src/services/chat.service";
import { DefaultWebSearchTool } from "@/lib/websearch/webSearchTool";
import { MockJinaProvider } from "tests/fixtures/mock-jina-provider";
import { MockAiProvider } from "tests/fixtures/mock-ai-provider";
import { MockQdrantStore } from "tests/fixtures/mock-qdrant-store";

describe("Web Context Injection (Story 7.3)", () => {
  it("injects Jina web search results into messages alongside RAG context", async () => {
    const mockJina = new MockJinaProvider();
    mockJina.onSearch(async (query) => [
      {
        title: "Latest Next.js 15 Release Notes",
        url: "https://nextjs.org/blog/next-15",
        snippet: "Next.js 15 introduced React 19 support.",
      },
    ]);

    const mockTool = new DefaultWebSearchTool(mockJina);
    const mockAi = new MockAiProvider();
    const mockQdrant = new MockQdrantStore();
    mockQdrant.onEmbed(async () => [0.1, 0.2, 0.3]);
    mockQdrant.onSearch(async () => [
      {
        chunkId: "chunk-1",
        assetId: "asset-1",
        score: 0.95,
        text: "Project internal notes on React.",
      },
    ]);

    let capturedMessages: any[] = [];
    mockAi.onStreamChat(async (messages, onChunk) => {
      capturedMessages = messages;
      onChunk("Answer incorporating live web search.");
    });

    const mockConversationRepo = {
      findById: vi.fn().mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        userId: "user-1",
        title: "Test Chat",
        model: "gpt-4o-mini",
      }),
      save: vi.fn(),
    } as any;

    const mockMessageRepo = {
      save: vi.fn().mockResolvedValue({
        id: "msg-1",
        conversationId: "123e4567-e89b-12d3-a456-426614174000",
        userId: "user-1",
        role: "assistant",
        content: "",
        status: "processing",
      }),
      findByConversation: vi.fn().mockResolvedValue([]),
    } as any;

    const chatService = new ChatServiceImpl(
      mockConversationRepo,
      mockMessageRepo,
      mockAi as any,
      undefined,
      mockQdrant as any,
      undefined,
      mockTool
    );

    const stream = await chatService.send(
      {
        conversationId: "123e4567-e89b-12d3-a456-426614174000",
        messages: [{ role: "user", content: "What is new in Next.js 15?" }],
      },
      "user-1"
    );

    const reader = stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    const systemMessages = capturedMessages.filter((m) => m.role === "system");
    expect(systemMessages.length).toBeGreaterThanOrEqual(2);

    const hasRag = systemMessages.some((m) => m.content.includes("Project internal notes"));
    const hasWeb = systemMessages.some((m) => m.content.includes("Latest Next.js 15 Release Notes"));

    expect(hasRag).toBe(true);
    expect(hasWeb).toBe(true);
  });
});
