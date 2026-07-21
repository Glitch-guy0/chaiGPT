import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/lib/db/repositories/asset.repository", () => ({
  AssetRepositoryImpl: vi.fn(),
}));

vi.mock("@/services/asset.service.impl", () => ({
  AssetServiceImpl: vi.fn(),
}));

vi.mock("@/lib/vector/qdrant", () => ({
  getQdrantStore: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  invalidateRagCache: vi.fn().mockResolvedValue(undefined),
}));

const { auth } = await import("@/lib/auth/session");
const { getDatabase } = await import("@/lib/db");
const { AssetRepositoryImpl } = await import("@/lib/db/repositories/asset.repository");
const { AssetServiceImpl } = await import("@/services/asset.service.impl");

function mockAuth(userId: string | null = "user-1") {
  vi.mocked(auth).mockResolvedValue({ userId: userId as string });
}

function mockDb() {
  vi.mocked(getDatabase).mockResolvedValue({} as never);
}

function mockAssetRepo(findByIdResult: { conversationId: string } | null = { conversationId: "conv-1" }) {
  vi.mocked(AssetRepositoryImpl).mockImplementation(function () {
    return {
      findById: vi.fn().mockResolvedValue(findByIdResult),
      delete: vi.fn().mockResolvedValue(undefined),
    } as never;
  });
}

function mockAssetService(overrides: Record<string, unknown> = {}) {
  const svc = {
    ingest: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  vi.mocked(AssetServiceImpl).mockImplementation(function () {
    return svc as never;
  });
  return svc;
}

describe("DELETE /api/assets/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 when auth throws", async () => {
    vi.mocked(auth).mockRejectedValue(new Error("Unauthorized"));

    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/assets/asset-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "asset-1" }) });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
  });

  it("returns 401 when userId is null", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null as unknown as string });

    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/assets/asset-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "asset-1" }) });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 200 and deletes asset", async () => {
    mockAuth();
    mockDb();
    mockAssetRepo({ conversationId: "conv-1" });
    const svc = mockAssetService();

    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/assets/asset-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "asset-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(svc.remove).toHaveBeenCalledWith("asset-1", "user-1");
  });

  it("returns 404 when asset not found", async () => {
    mockAuth();
    mockDb();
    mockAssetRepo(null);

    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/assets/missing", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "missing" }) });

    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth();
    mockDb();
    mockAssetRepo({ conversationId: "conv-1" });
    mockAssetService({ remove: vi.fn().mockRejectedValue(new Error("db down")) });

    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/assets/asset-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "asset-1" }) });

    expect(res.status).toBe(500);
  });
});
