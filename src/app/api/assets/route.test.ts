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

vi.mock("@/lib/db/repositories/conversation.repository", () => ({
  ConversationRepositoryImpl: vi.fn(),
}));

vi.mock("@/services/asset.service.impl", () => ({
  AssetServiceImpl: vi.fn(),
}));

const { auth } = await import("@/lib/auth/session");
const { getDatabase } = await import("@/lib/db");
const { AssetRepositoryImpl } = await import("@/lib/db/repositories/asset.repository");
const { ConversationRepositoryImpl } = await import("@/lib/db/repositories/conversation.repository");
const { AssetServiceImpl } = await import("@/services/asset.service.impl");

function mockAuth(userId: string | null = "user-1") {
  vi.mocked(auth).mockResolvedValue({ userId: userId as string });
}

function mockDb() {
  const mockDs = {};
  vi.mocked(getDatabase).mockResolvedValue(mockDs as never);
  return mockDs;
}

function mockAssetRepo(overrides: Record<string, unknown> = {}) {
  const repo = {
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    findByConversation: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
  vi.mocked(AssetRepositoryImpl).mockImplementation(function () {
    return repo as never;
  });
  return repo;
}

function mockConvRepo(findByIdResult: unknown = { id: "conv-1" }) {
  const repo = { findById: vi.fn().mockResolvedValue(findByIdResult) };
  vi.mocked(ConversationRepositoryImpl).mockImplementation(function () {
    return repo as never;
  });
  return repo;
}

function mockAssetService(overrides: Record<string, unknown> = {}) {
  const svc = {
    ingest: vi.fn().mockResolvedValue({
      id: "asset-1",
      userId: "user-1",
      conversationId: "conv-1",
      filename: "doc.pdf",
      mime: "application/pdf",
      path: "user-1/conv-1/asset-1.pdf",
    }),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  vi.mocked(AssetServiceImpl).mockImplementation(function () {
    return svc as never;
  });
  return svc;
}

describe("POST /api/assets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 when auth throws", async () => {
    vi.mocked(auth).mockRejectedValue(new Error("Unauthorized"));
    const { POST } = await import("./route");

    const req = new Request("http://localhost/api/assets", { method: "POST" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
  });

  it("returns 400 for missing file", async () => {
    mockAuth();
    mockDb();
    const { POST } = await import("./route");

    const fd = new FormData();
    fd.set("conversationId", "550e8400-e29b-41d4-a716-446655440000");
    const req = new Request("http://localhost/api/assets", { method: "POST", body: fd });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/file/i);
  });

  it("returns 400 for missing conversationId", async () => {
    mockAuth();
    mockDb();
    const { POST } = await import("./route");

    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
    const fd = new FormData();
    fd.set("file", file);
    const req = new Request("http://localhost/api/assets", { method: "POST", body: fd });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/conversationId/i);
  });

  it("returns 400 for invalid conversationId", async () => {
    mockAuth();
    mockDb();
    const { POST } = await import("./route");

    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
    const fd = new FormData();
    fd.set("file", file);
    fd.set("conversationId", "not-a-uuid");
    const req = new Request("http://localhost/api/assets", { method: "POST", body: fd });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent conversation", async () => {
    mockAuth();
    mockDb();
    mockConvRepo(null);
    const { POST } = await import("./route");

    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
    const fd = new FormData();
    fd.set("file", file);
    fd.set("conversationId", "550e8400-e29b-41d4-a716-446655440000");
    const req = new Request("http://localhost/api/assets", { method: "POST", body: fd });
    const res = await POST(req);

    expect(res.status).toBe(404);
  });

  it("returns 201 with valid upload", async () => {
    mockAuth();
    mockDb();
    mockConvRepo({ id: "conv-1" });
    mockAssetRepo();
    mockAssetService();

    const { POST } = await import("./route");
    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
    const fd = new FormData();
    fd.set("file", file);
    fd.set("conversationId", "550e8400-e29b-41d4-a716-446655440000");
    const req = new Request("http://localhost/api/assets", { method: "POST", body: fd });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe("asset-1");
  });
});

describe("GET /api/assets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns asset list scoped to user", async () => {
    mockAuth();
    mockDb();
    const assets = [{ id: "a1", filename: "doc.pdf" }];
    mockAssetRepo({ findByConversation: vi.fn().mockResolvedValue(assets) });

    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/assets?conversationId=550e8400-e29b-41d4-a716-446655440000",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(assets);
  });

  it("returns 400 for missing conversationId", async () => {
    mockAuth();
    mockDb();

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/assets");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });
});
