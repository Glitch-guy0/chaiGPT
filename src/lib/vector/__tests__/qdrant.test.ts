import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertMock = vi.fn().mockResolvedValue(undefined);
const getCollectionMock = vi.fn();
const createCollectionMock = vi.fn().mockResolvedValue(undefined);
const searchMock = vi.fn();

vi.mock("@qdrant/js-client-rest", () => ({
  QdrantClient: vi.fn(function () {
    return {
      upsert: upsertMock,
      getCollection: getCollectionMock,
      createCollection: createCollectionMock,
      search: searchMock,
    };
  }),
}));

vi.mock("uuid", () => ({
  v5: vi.fn((input: string) => `uuid-of-${input}`),
}));

vi.mock("@langchain/openai", () => ({
  OpenAIEmbeddings: vi.fn(function () {
    return {
      embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };
  }),
}));

const { QdrantVectorStore } = await import("../qdrant");

describe("QdrantVectorStore", () => {
  let store: InstanceType<typeof QdrantVectorStore>;

  beforeEach(() => {
    upsertMock.mockReset().mockResolvedValue(undefined);
    getCollectionMock.mockReset().mockRejectedValue(new Error("not found"));
    createCollectionMock.mockReset().mockResolvedValue(undefined);
    searchMock.mockReset();
    store = new QdrantVectorStore("http://localhost:6333");
  });

  describe("embed", () => {
    it("returns embedding vector for valid text", async () => {
      const vec = await store.embed("hello world");
      expect(Array.isArray(vec)).toBe(true);
      expect(vec.length).toBeGreaterThan(0);
    });

    it("throws on empty text", async () => {
      await expect(store.embed("")).rejects.toThrow(
        "Cannot embed empty or whitespace-only text",
      );
    });

    it("throws on whitespace-only text", async () => {
      await expect(store.embed("   \n\t  ")).rejects.toThrow(
        "Cannot embed empty or whitespace-only text",
      );
    });
  });

  describe("upsertChunks", () => {
    beforeEach(() => {
      vi.spyOn(store, "embed").mockResolvedValue([0.1, 0.2, 0.3]);
    });

    it("creates collection on first upsert", async () => {
      await store.upsertChunks("asset-1", "conv-1", [
        { index: 0, text: "hello" },
      ]);

      expect(createCollectionMock).toHaveBeenCalledWith("conv_conv-1", {
        vectors: { size: 1536, distance: "Cosine" },
        payload_schema: {
          assetId: { type: "keyword" },
          chunkId: { type: "keyword" },
          index: { type: "integer" },
        },
      });
    });

    it("skips collection creation if it already exists", async () => {
      getCollectionMock.mockResolvedValueOnce({});

      await store.upsertChunks("asset-1", "conv-1", [
        { index: 0, text: "hello" },
      ]);

      expect(createCollectionMock).not.toHaveBeenCalled();
    });

    it("embeds each chunk and upserts with correct payload", async () => {
      await store.upsertChunks("asset-1", "conv-1", [
        { index: 0, text: "chunk one" },
        { index: 1, text: "chunk two" },
      ]);

      expect(upsertMock).toHaveBeenCalledTimes(1);
      const call = upsertMock.mock.calls[0];
      expect(call[0]).toBe("conv_conv-1");

      const points = call[1].points;
      expect(points).toHaveLength(2);

      expect(points[0].payload).toEqual({
        chunkId: "uuid-of-asset-1::0",
        assetId: "asset-1",
        index: 0,
        text: "chunk one",
      });
      expect(points[0].vector).toEqual([0.1, 0.2, 0.3]);

      expect(points[1].payload).toEqual({
        chunkId: "uuid-of-asset-1::1",
        assetId: "asset-1",
        index: 1,
        text: "chunk two",
      });
    });

    it("does nothing for empty chunks array", async () => {
      await store.upsertChunks("asset-1", "conv-1", []);
      expect(upsertMock).not.toHaveBeenCalled();
      expect(createCollectionMock).not.toHaveBeenCalled();
    });

    it("batches upserts in groups of 128", async () => {
      const chunks = Array.from({ length: 256 }, (_, i) => ({
        index: i,
        text: `chunk ${i}`,
      }));

      await store.upsertChunks("asset-1", "conv-1", chunks);

      expect(upsertMock).toHaveBeenCalledTimes(2);
      expect(upsertMock.mock.calls[0][1].points).toHaveLength(128);
      expect(upsertMock.mock.calls[1][1].points).toHaveLength(128);
    });

    it("generates deterministic chunk IDs", async () => {
      await store.upsertChunks("asset-1", "conv-1", [
        { index: 0, text: "text" },
      ]);

      const points = upsertMock.mock.calls[0][1].points;
      expect(points[0].id).toBe("uuid-of-asset-1::0");
    });
  });

  describe("search", () => {
    it("returns hits with correct shape", async () => {
      searchMock.mockResolvedValueOnce([
        {
          score: 0.95,
          payload: {
            chunkId: "c1",
            assetId: "a1",
            text: "result text",
          },
        },
      ]);

      const hits = await store.search([0.1, 0.2, 0.3], "conv-1", 5);

      expect(hits).toHaveLength(1);
      expect(hits[0]).toEqual({
        chunkId: "c1",
        assetId: "a1",
        score: 0.95,
        text: "result text",
      });

      expect(searchMock).toHaveBeenCalledWith("conv_conv-1", {
        vector: [0.1, 0.2, 0.3],
        limit: 5,
        with_payload: true,
      });
    });

    it("returns empty array when no results", async () => {
      searchMock.mockResolvedValueOnce([]);

      const hits = await store.search([0.1], "conv-1", 5);
      expect(hits).toEqual([]);
    });
  });
});
