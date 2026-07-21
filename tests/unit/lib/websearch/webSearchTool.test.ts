import { describe, it, expect, vi } from "vitest";
import { DefaultWebSearchTool } from "@/lib/websearch/webSearchTool";
import { MockJinaProvider } from "tests/fixtures/mock-jina-provider";

describe("DefaultWebSearchTool", () => {
  it("runs search and returns formatted markdown string with title, url, snippet", async () => {
    const mockProvider = new MockJinaProvider();
    mockProvider.onSearch(async (query) => [
      {
        title: "ChaiGPT Docs",
        url: "https://chaigpt.io/docs",
        snippet: "AI assistant platform documentation.",
      },
    ]);

    const tool = new DefaultWebSearchTool(mockProvider);
    const output = await tool.run({ query: "ChaiGPT features" });

    expect(output).toContain('Web Search Results for "ChaiGPT features":');
    expect(output).toContain("[1] Title: ChaiGPT Docs");
    expect(output).toContain("URL: https://chaigpt.io/docs");
    expect(output).toContain("Snippet: AI assistant platform documentation.");
  });

  it("handles zero search results gracefully", async () => {
    const mockProvider = new MockJinaProvider();
    mockProvider.onSearch(async () => []);

    const tool = new DefaultWebSearchTool(mockProvider);
    const output = await tool.run({ query: "unknown term" });

    expect(output).toBe('No web search results found for: "unknown term"');
  });

  it("degrades gracefully when JinaProvider throws error", async () => {
    const mockProvider = new MockJinaProvider();
    mockProvider.onSearch(async () => {
      throw new Error("JINA_API_KEY environment variable is missing");
    });

    const tool = new DefaultWebSearchTool(mockProvider);
    const output = await tool.run({ query: "test query" });

    expect(output).toBe(
      "Web search unavailable: JINA_API_KEY environment variable is missing"
    );
  });

  it("rejects invalid argument shapes gracefully", async () => {
    const tool = new DefaultWebSearchTool();
    const output = await tool.run({ query: "" } as any);

    expect(output).toContain("Web search unavailable: Invalid arguments format.");
  });
});
