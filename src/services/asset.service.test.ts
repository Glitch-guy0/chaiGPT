import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AssetRepository } from "@/lib/db/repositories/asset.repository";
import type { QdrantStore } from "@/lib/vector/qdrant";
import type { Asset } from "@/lib/db/entities/asset.entity";
import { NotFoundError } from "@/lib/errors";

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ai/text-extractor", () => ({
  extractText: vi.fn().mockResolvedValue("extracted text content"),
  SUPPORTED_MIME_TYPES: ["application/pdf", "text/plain", "text/markdown"],
}));

vi.mock("@/lib/chunking/chunker", () => ({
  chunkDocument: vi.fn().mockResolvedValue([
    { index: 0, text: "chunk one" },
    { index: 1, text: "chunk two" },
  ]),
}));

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn().mockReturnValue("mock-uuid-123"),
}));

const { AssetServiceImpl } = await import("./asset.service.impl");

function createMockAssetRepo() {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    findByConversation: vi.fn(),
    findIds: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
  } satisfies AssetRepository;
}

function createMockQdrantStore() {
  return {
    embed: vi.fn(),
    search: vi.fn(),
    upsertChunks: vi.fn().mockResolvedValue(undefined),
    deleteByAssetId: vi.fn().mockResolvedValue(undefined),
  } satisfies QdrantStore;
}

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-1",
    userId: "user-1",
    conversationId: "conv-1",
    filename: "doc.pdf",
    mime: "application/pdf",
    path: "user-1/conv-1/asset-1.pdf",
    text: "some text",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  } as Asset;
}

function makeFile(name = "doc.pdf", mime = "application/pdf", content = "file bytes") {
  return new File([content], name, { type: mime });
}

describe("AssetServiceImpl", () => {
  let repo: ReturnType<typeof createMockAssetRepo>;
  let qdrant: ReturnType<typeof createMockQdrantStore>;
  let service: InstanceType<typeof AssetServiceImpl>;

  beforeEach(() => {
    repo = createMockAssetRepo();
    qdrant = createMockQdrantStore();
    service = new AssetServiceImpl(repo, qdrant, "/tmp/assets");
    vi.clearAllMocks();
  });

  describe("ingest", () => {
    it("stages file to volume, upserts chunks, saves asset, deletes original", async () => {
      const saved = makeAsset();
      repo.save.mockResolvedValue(saved);

      const result = await service.ingest("user-1", "conv-1", makeFile());

      const { writeFile, unlink, mkdir } = await import("node:fs/promises");
      expect(mkdir).toHaveBeenCalledWith("/tmp/assets/user-1/conv-1", { recursive: true });
      expect(writeFile).toHaveBeenCalled();
      expect(qdrant.upsertChunks).toHaveBeenCalledWith("mock-uuid-123", "conv-1", [
        { index: 0, text: "chunk one" },
        { index: 1, text: "chunk two" },
      ]);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          conversationId: "conv-1",
          filename: "doc.pdf",
          mime: "application/pdf",
          text: "extracted text content",
        }),
      );
      expect(unlink).toHaveBeenCalled();
      expect(result.id).toBe("asset-1");
    });

    it("rejects unsupported mime types", async () => {
      await expect(
        service.ingest("user-1", "conv-1", makeFile("image.png", "image/png")),
      ).rejects.toThrow("Unsupported MIME type");
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("cleans up staged file when extraction fails", async () => {
      const { extractText } = await import("@/lib/ai/text-extractor");
      vi.mocked(extractText).mockRejectedValueOnce(new Error("parse error"));

      await expect(
        service.ingest("user-1", "conv-1", makeFile()),
      ).rejects.toThrow("Failed to extract text");

      const { unlink } = await import("node:fs/promises");
      expect(unlink).toHaveBeenCalled();
    });

    it("cleans up staged file when chunking fails", async () => {
      const { chunkDocument } = await import("@/lib/chunking/chunker");
      vi.mocked(chunkDocument).mockRejectedValueOnce(new Error("chunk error"));

      await expect(
        service.ingest("user-1", "conv-1", makeFile()),
      ).rejects.toThrow("Failed to chunk text");

      const { unlink } = await import("node:fs/promises");
      expect(unlink).toHaveBeenCalled();
    });

    it("cleans up staged file when qdrant upsert fails", async () => {
      qdrant.upsertChunks.mockRejectedValueOnce(new Error("qdrant down"));

      await expect(
        service.ingest("user-1", "conv-1", makeFile()),
      ).rejects.toThrow("qdrant down");

      const { unlink } = await import("node:fs/promises");
      expect(unlink).toHaveBeenCalled();
    });

    it("works without qdrantStore (undefined)", async () => {
      const noQdrantService = new AssetServiceImpl(repo, undefined, "/tmp/assets");
      const saved = makeAsset();
      repo.save.mockResolvedValue(saved);

      const result = await noQdrantService.ingest("user-1", "conv-1", makeFile());
      expect(result.id).toBe("asset-1");
    });

    it("uses .md extension for markdown files", async () => {
      const saved = makeAsset({ mime: "text/markdown", filename: "readme.md" });
      repo.save.mockResolvedValue(saved);

      await service.ingest("user-1", "conv-1", makeFile("readme.md", "text/markdown"));

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ mime: "text/markdown" }),
      );
    });

    it("uses .txt extension for plain text files", async () => {
      const saved = makeAsset({ mime: "text/plain", filename: "notes.txt" });
      repo.save.mockResolvedValue(saved);

      await service.ingest("user-1", "conv-1", makeFile("notes.txt", "text/plain"));

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ mime: "text/plain" }),
      );
    });
  });

  describe("remove", () => {
    it("deletes file from volume and DB row", async () => {
      const asset = makeAsset({ path: "user-1/conv-1/asset-1.pdf" });
      repo.findById.mockResolvedValue(asset);
      repo.delete.mockResolvedValue(undefined);

      await service.remove("asset-1", "user-1");

      expect(repo.findById).toHaveBeenCalledWith("asset-1", "user-1");
      const { unlink } = await import("node:fs/promises");
      expect(unlink).toHaveBeenCalledWith("/tmp/assets/user-1/conv-1/asset-1.pdf");
      expect(repo.delete).toHaveBeenCalledWith("asset-1", "user-1");
    });

    it("throws NotFoundError for missing asset", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.remove("missing", "user-1")).rejects.toThrow(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it("proceeds with DB delete even if file unlink fails", async () => {
      const { unlink } = await import("node:fs/promises");
      vi.mocked(unlink).mockRejectedValueOnce(new Error("ENOENT"));
      const asset = makeAsset({ path: "user-1/conv-1/asset-1.pdf" });
      repo.findById.mockResolvedValue(asset);
      repo.delete.mockResolvedValue(undefined);

      await service.remove("asset-1", "user-1");
      expect(repo.delete).toHaveBeenCalledWith("asset-1", "user-1");
    });

    it("skips file deletion when asset has no path", async () => {
      const asset = makeAsset({ path: "" });
      repo.findById.mockResolvedValue(asset);
      repo.delete.mockResolvedValue(undefined);

      await service.remove("asset-1", "user-1");

      const { unlink } = await import("node:fs/promises");
      expect(unlink).not.toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith("asset-1", "user-1");
    });

    it("deletes from Qdrant before DB delete", async () => {
      const asset = makeAsset();
      repo.findById.mockResolvedValue(asset);
      repo.delete.mockResolvedValue(undefined);

      await service.remove("asset-1", "user-1");

      expect(qdrant.deleteByAssetId).toHaveBeenCalledWith("asset-1");
      expect(repo.delete).toHaveBeenCalledWith("asset-1", "user-1");
    });

    it("proceeds with DB delete even if Qdrant delete fails", async () => {
      const asset = makeAsset();
      repo.findById.mockResolvedValue(asset);
      repo.delete.mockResolvedValue(undefined);
      qdrant.deleteByAssetId.mockRejectedValueOnce(new Error("qdrant down"));

      await service.remove("asset-1", "user-1");

      expect(repo.delete).toHaveBeenCalledWith("asset-1", "user-1");
    });

    it("skips Qdrant cleanup when qdrantStore is undefined", async () => {
      const noQdrantService = new AssetServiceImpl(repo, undefined, "/tmp/assets");
      const asset = makeAsset();
      repo.findById.mockResolvedValue(asset);
      repo.delete.mockResolvedValue(undefined);

      await noQdrantService.remove("asset-1", "user-1");

      expect(repo.delete).toHaveBeenCalledWith("asset-1", "user-1");
    });
  });
});
