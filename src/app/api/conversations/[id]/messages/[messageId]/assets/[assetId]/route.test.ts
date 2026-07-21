import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDatabase: vi.fn(),
}));

vi.mock("@/lib/db/repositories/message.repository", () => ({
  MessageRepositoryImpl: vi.fn(),
}));

vi.mock("@/lib/db/repositories/conversation.repository", () => ({
  ConversationRepositoryImpl: vi.fn(),
}));

vi.mock("@/lib/db/repositories/asset.repository", () => ({
  AssetRepositoryImpl: vi.fn(),
}));

vi.mock("@/services/message.service", () => ({
  MessageServiceImpl: vi.fn(),
}));

vi.mock("@/services/asset.service.impl", () => ({
  AssetServiceImpl: vi.fn(),
}));

const { auth } = await import("@/lib/auth/session");
const { getDatabase } = await import("@/lib/db");
const { MessageServiceImpl } = await import("@/services/message.service");
const { ConversationRepositoryImpl } = await import("@/lib/db/repositories/conversation.repository");
const { MessageRepositoryImpl } = await import("@/lib/db/repositories/message.repository");

function mockAuth(userId: string | null = "user-1") {
  vi.mocked(auth).mockResolvedValue({ userId: userId as string });
}

function mockDb() {
  vi.mocked(getDatabase).mockResolvedValue({} as never);
}

function mockMessageService(overrides: Record<string, unknown> = {}) {
  const svc = {
    removeAssetFromMessage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  vi.mocked(MessageServiceImpl).mockImplementation(function () {
    return svc as never;
  });
  return svc;
}

function mockConversationRepo(result: unknown = { id: "conv-1" }) {
  const repo = { findById: vi.fn().mockResolvedValue(result) };
  vi.mocked(ConversationRepositoryImpl).mockImplementation(function () {
    return repo as never;
  });
  return repo;
}

function mockMessageRepo(result: unknown = { id: "msg-1" }) {
  const repo = { findByIdInConversation: vi.fn().mockResolvedValue(result) };
  vi.mocked(MessageRepositoryImpl).mockImplementation(function () {
    return repo as never;
  });
  return repo;
}

const CONV_ID = "550e8400-e29b-41d4-a716-446655440000";
const MSG_ID = "660e8400-e29b-41d4-a716-446655440001";
const ASSET_ID = "770e8400-e29b-41d4-a716-446655440002";
const URL = `http://localhost/api/conversations/${CONV_ID}/messages/${MSG_ID}/assets/${ASSET_ID}`;

describe("DELETE /api/conversations/[id]/messages/[messageId]/assets/[assetId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 when auth throws", async () => {
    vi.mocked(auth).mockRejectedValue(new Error("Unauthorized"));

    const { DELETE } = await import("./route");
    const res = await DELETE(new Request(URL, { method: "DELETE" }), {
      params: Promise.resolve({ id: CONV_ID, messageId: MSG_ID, assetId: ASSET_ID }),
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
  });

  it("returns 401 when userId is null", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null as unknown as string });

    const { DELETE } = await import("./route");
    const res = await DELETE(new Request(URL, { method: "DELETE" }), {
      params: Promise.resolve({ id: CONV_ID, messageId: MSG_ID, assetId: ASSET_ID }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid UUID", async () => {
    mockAuth();

    const { DELETE } = await import("./route");
    const res = await DELETE(new Request(URL, { method: "DELETE" }), {
      params: Promise.resolve({ id: "not-a-uuid", messageId: MSG_ID, assetId: ASSET_ID }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid UUID");
  });

  it("returns 404 when conversation not found", async () => {
    mockAuth();
    mockDb();
    mockConversationRepo(null);

    const { DELETE } = await import("./route");
    const res = await DELETE(new Request(URL, { method: "DELETE" }), {
      params: Promise.resolve({ id: CONV_ID, messageId: MSG_ID, assetId: ASSET_ID }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Conversation not found");
  });

  it("returns 404 when message not found", async () => {
    mockAuth();
    mockDb();
    mockConversationRepo({ id: CONV_ID });
    mockMessageRepo(null);

    const { DELETE } = await import("./route");
    const res = await DELETE(new Request(URL, { method: "DELETE" }), {
      params: Promise.resolve({ id: CONV_ID, messageId: MSG_ID, assetId: ASSET_ID }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Message not found");
  });

  it("returns 200 on success", async () => {
    mockAuth();
    mockDb();
    mockConversationRepo({ id: CONV_ID });
    mockMessageRepo({ id: MSG_ID });
    const svc = mockMessageService();

    const { DELETE } = await import("./route");
    const res = await DELETE(new Request(URL, { method: "DELETE" }), {
      params: Promise.resolve({ id: CONV_ID, messageId: MSG_ID, assetId: ASSET_ID }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(svc.removeAssetFromMessage).toHaveBeenCalledWith(MSG_ID, ASSET_ID, "user-1");
  });
});
