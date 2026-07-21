import { describe, it, expect } from "vitest";
import { formatRagContext, hitsToCitations } from "./inject";
import type { Hit } from "@/lib/vector/qdrant";

function makeHit(overrides: Partial<Hit> = {}): Hit {
  return {
    chunkId: "chunk-001",
    assetId: "asset-abc",
    score: 0.87,
    text: "The company policy states that remote work is allowed on Fridays.",
    ...overrides,
  };
}

describe("formatRagContext", () => {
  it("returns empty string for empty hits array", () => {
    expect(formatRagContext([])).toBe("");
  });

  it("formats a single hit correctly", () => {
    const hits = [makeHit()];
    const result = formatRagContext(hits);

    expect(result).toBe(
      "[RAG Context]\n" +
      "[1] (asset: asset-abc, chunk: chunk-001, score: 0.87) The company policy states that remote work is allowed on Fridays.\n" +
      "[/RAG Context]"
    );
  });

  it("formats three hits with correct numbering", () => {
    const hits = [
      makeHit({ chunkId: "c1", assetId: "a1", score: 0.9, text: "First chunk" }),
      makeHit({ chunkId: "c2", assetId: "a2", score: 0.8, text: "Second chunk" }),
      makeHit({ chunkId: "c3", assetId: "a3", score: 0.7, text: "Third chunk" }),
    ];
    const result = formatRagContext(hits);

    expect(result).toContain("[1] (asset: a1, chunk: c1, score: 0.9) First chunk");
    expect(result).toContain("[2] (asset: a2, chunk: c2, score: 0.8) Second chunk");
    expect(result).toContain("[3] (asset: a3, chunk: c3, score: 0.7) Third chunk");
    expect(result).toContain("[RAG Context]");
    expect(result).toContain("[/RAG Context]");
    expect(result.split("\n").length).toBe(5);
  });

  it("truncates chunks exceeding 2000 chars", () => {
    const longText = "x".repeat(3000);
    const hits = [makeHit({ text: longText })];
    const result = formatRagContext(hits);

    expect(result).toContain("x".repeat(2000));
    expect(result).not.toContain("x".repeat(2001));
  });

  it("does not truncate chunks under 2000 chars", () => {
    const text = "y".repeat(1999);
    const hits = [makeHit({ text })];
    const result = formatRagContext(hits);

    expect(result).toContain(text);
  });

  it("preserves exact score values", () => {
    const hits = [makeHit({ score: 0.123456 })];
    const result = formatRagContext(hits);

    expect(result).toContain("score: 0.123456");
  });
});

describe("hitsToCitations", () => {
  it("returns empty array for empty hits", () => {
    expect(hitsToCitations([])).toEqual([]);
  });

  it("maps hit fields to citation format", () => {
    const hits = [makeHit()];
    const citations = hitsToCitations(hits);

    expect(citations).toEqual([
      {
        chunkId: "chunk-001",
        assetId: "asset-abc",
        score: 0.87,
        snippet: "The company policy states that remote work is allowed on Fridays.",
      },
    ]);
  });

  it("truncates snippet to 120 chars", () => {
    const longText = "z".repeat(200);
    const hits = [makeHit({ text: longText })];
    const citations = hitsToCitations(hits);

    expect(citations[0].snippet).toBe("z".repeat(120));
    expect(citations[0].snippet.length).toBe(120);
  });

  it("does not truncate short snippets", () => {
    const hits = [makeHit({ text: "short" })];
    const citations = hitsToCitations(hits);

    expect(citations[0].snippet).toBe("short");
  });

  it("maps multiple hits", () => {
    const hits = [
      makeHit({ chunkId: "c1", assetId: "a1" }),
      makeHit({ chunkId: "c2", assetId: "a2" }),
    ];
    const citations = hitsToCitations(hits);

    expect(citations).toHaveLength(2);
    expect(citations[0].chunkId).toBe("c1");
    expect(citations[1].chunkId).toBe("c2");
  });
});
