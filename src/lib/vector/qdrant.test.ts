import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCollections = vi.fn();
const mockDelete = vi.fn();
const mockCreateCollection = vi.fn();
const mockGetCollection = vi.fn();
const mockUpsert = vi.fn();
const mockSearch = vi.fn();

vi.mock("@qdrant/js-client-rest", () => {
  return {
    QdrantClient: vi.fn().mockImplementation(function () {
      return {
        getCollections: mockGetCollections,
        delete: mockDelete,
        createCollection: mockCreateCollection,
        getCollection: mockGetCollection,
        upsert: mockUpsert,
        search: mockSearch,
      };
    }),
  };
});

vi.mock("@langchain/openai", () => ({
  OpenAIEmbeddings: vi.fn().mockImplementation(() => ({
    embedQuery: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  })),
}));

const { QdrantVectorStore } = await import("./qdrant");

describe("QdrantVectorStore", () => {
  let store: InstanceType<typeof QdrantVectorStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new QdrantVectorStore("http://localhost:6333");
  });

  describe("deleteByAssetId", () => {
    it("calls Qdrant delete API with correct filter for each collection", async () => {
      mockGetCollections.mockResolvedValue({
        collections: [{ name: "conv_conv-1" }, { name: "conv_conv-2" }],
      });
      mockDelete.mockResolvedValue(undefined);

      await store.deleteByAssetId("asset-abc");

      expect(mockGetCollections).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalledTimes(2);
      expect(mockDelete).toHaveBeenCalledWith("conv_conv-1", {
        filter: {
          must: [{ key: "assetId", match: { value: "asset-abc" } }],
        },
      });
      expect(mockDelete).toHaveBeenCalledWith("conv_conv-2", {
        filter: {
          must: [{ key: "assetId", match: { value: "asset-abc" } }],
        },
      });
    });

    it("handles empty collection list gracefully", async () => {
      mockGetCollections.mockResolvedValue({ collections: [] });

      await store.deleteByAssetId("asset-abc");

      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("handles Qdrant error on one collection without failing others", async () => {
      mockGetCollections.mockResolvedValue({
        collections: [{ name: "conv-1" }, { name: "conv-2" }],
      });
      mockDelete
        .mockRejectedValueOnce(new Error("qdrant down"))
        .mockResolvedValueOnce(undefined);

      await store.deleteByAssetId("asset-abc");

      expect(mockDelete).toHaveBeenCalledTimes(2);
    });

    it("handles getCollections failure gracefully", async () => {
      mockGetCollections.mockRejectedValue(new Error("connection refused"));

      await expect(store.deleteByAssetId("asset-abc")).rejects.toThrow("connection refused");
    });
  });
});
