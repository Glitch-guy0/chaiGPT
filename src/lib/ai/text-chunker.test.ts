import { describe, it, expect, vi, beforeEach } from "vitest";

const createDocumentsMock = vi.fn();

vi.mock("@langchain/textsplitters", () => {
  class MockRecursiveCharacterTextSplitter {
    constructor(_opts: unknown) {}
    async createDocuments(texts: string[]) {
      return createDocumentsMock(texts);
    }
  }
  return { RecursiveCharacterTextSplitter: MockRecursiveCharacterTextSplitter };
});

const { chunkText } = await import("./text-chunker");

describe("chunkText", () => {
  beforeEach(() => {
    createDocumentsMock.mockImplementation(async (texts: string[]) => {
      const text = texts[0];
      const chunks: { pageContent: string }[] = [];
      const chunkSize = 1000;
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push({ pageContent: text.slice(i, i + chunkSize) });
      }
      return chunks;
    });
  });

  it("produces chunks for known-length text", async () => {
    const text = "a".repeat(2500);
    const chunks = await chunkText(text);
    expect(chunks.length).toBe(3);
    expect(chunks[0]).toEqual({ index: 0, text: "a".repeat(1000) });
    expect(chunks[1]).toEqual({ index: 1, text: "a".repeat(1000) });
    expect(chunks[2]).toEqual({ index: 2, text: "a".repeat(500) });
  });

  it("filters empty chunks", async () => {
    createDocumentsMock.mockResolvedValueOnce([
      { pageContent: "hello" },
      { pageContent: "   " },
      { pageContent: "world" },
    ]);

    const chunks = await chunkText("some text");
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe("hello");
    expect(chunks[1].text).toBe("world");
  });

  it("returns empty array for empty text", async () => {
    createDocumentsMock.mockResolvedValueOnce([]);
    const chunks = await chunkText("");
    expect(chunks).toEqual([]);
  });

  it("chunks conform to Chunk interface", async () => {
    const chunks = await chunkText("hello");
    expect(chunks).toHaveLength(1);
    expect(typeof chunks[0].index).toBe("number");
    expect(typeof chunks[0].text).toBe("string");
  });
});
