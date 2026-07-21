import { describe, it, expect, vi, beforeEach } from "vitest";

const createDocumentsMock = vi.fn();

vi.mock("@langchain/textsplitters", () => {
  class MockCharacterTextSplitter {
    constructor(_opts: unknown) {}
    async createDocuments(texts: string[]) {
      return createDocumentsMock(texts);
    }
  }
  return { CharacterTextSplitter: MockCharacterTextSplitter };
});

const { chunkDocument } = await import("../chunker");

describe("chunkDocument", () => {
  beforeEach(() => {
    createDocumentsMock.mockReset();
    createDocumentsMock.mockImplementation(async (texts: string[]) => {
      const text = texts[0];
      const chunks: { pageContent: string }[] = [];
      const chunkSize = 2000;
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push({ pageContent: text.slice(i, i + chunkSize) });
      }
      return chunks;
    });
  });

  it("splits text/plain at 2000 characters", async () => {
    const text = "a".repeat(5000);
    const chunks = await chunkDocument(text, "text/plain");
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual({ index: 0, text: "a".repeat(2000) });
    expect(chunks[1]).toEqual({ index: 1, text: "a".repeat(2000) });
    expect(chunks[2]).toEqual({ index: 2, text: "a".repeat(1000) });
  });

  it("splits text/markdown at 2000 characters", async () => {
    const text = "x".repeat(4000);
    const chunks = await chunkDocument(text, "text/markdown");
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ index: 0, text: "x".repeat(2000) });
    expect(chunks[1]).toEqual({ index: 1, text: "x".repeat(2000) });
  });

  it("returns single chunk for text under 2000 chars", async () => {
    const text = "hello world";
    const chunks = await chunkDocument(text, "text/plain");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe("hello world");
    expect(chunks[0].index).toBe(0);
  });

  it("returns empty array for empty string", async () => {
    const chunks = await chunkDocument("", "text/plain");
    expect(chunks).toEqual([]);
  });

  it("returns empty array for whitespace-only string", async () => {
    const chunks = await chunkDocument("   \n\t  ", "text/plain");
    expect(chunks).toEqual([]);
  });

  it("returns empty array for null-like input", async () => {
    createDocumentsMock.mockResolvedValueOnce([]);
    const chunks = await chunkDocument("", "application/pdf");
    expect(chunks).toEqual([]);
  });

  it("filters out empty chunks from splitter", async () => {
    createDocumentsMock.mockResolvedValueOnce([
      { pageContent: "content here" },
      { pageContent: "   " },
      { pageContent: "more content" },
    ]);

    const chunks = await chunkDocument("some text", "text/plain");
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe("content here");
    expect(chunks[1].text).toBe("more content");
  });

  it("preserves chunk ordering with correct indices", async () => {
    createDocumentsMock.mockResolvedValueOnce([
      { pageContent: "first" },
      { pageContent: "second" },
      { pageContent: "third" },
    ]);

    const chunks = await chunkDocument("text", "text/plain");
    expect(chunks[0]).toEqual({ index: 0, text: "first" });
    expect(chunks[1]).toEqual({ index: 1, text: "second" });
    expect(chunks[2]).toEqual({ index: 2, text: "third" });
  });

  it("handles text at exactly 2000 chars", async () => {
    createDocumentsMock.mockResolvedValueOnce([
      { pageContent: "a".repeat(2000) },
    ]);

    const chunks = await chunkDocument("a".repeat(2000), "text/plain");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toHaveLength(2000);
  });

  it("handles text at 2001 chars", async () => {
    createDocumentsMock.mockResolvedValueOnce([
      { pageContent: "a".repeat(2000) },
      { pageContent: "a" },
    ]);

    const chunks = await chunkDocument("a".repeat(2001), "text/plain");
    expect(chunks).toHaveLength(2);
  });

  it("works with application/pdf mime type", async () => {
    const text = "PDF extracted content here";
    createDocumentsMock.mockResolvedValueOnce([
      { pageContent: text },
    ]);

    const chunks = await chunkDocument(text, "application/pdf");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text);
  });
});
