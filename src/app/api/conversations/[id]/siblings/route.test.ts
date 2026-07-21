import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDatabase: vi.fn(),
}));

const { auth } = await import("@/lib/auth/session");
const { getDatabase } = await import("@/lib/db");

function mockAuth(userId: string | null = "user-1") {
  vi.mocked(auth).mockResolvedValue({ userId: userId as string });
}

function mockDb(overrides: {
  conversation?: unknown;
  siblings?: unknown[];
} = {}) {
  const findOne = vi.fn().mockResolvedValue(overrides.conversation ?? null);
  const find = vi.fn().mockResolvedValue(overrides.siblings ?? []);
  vi.mocked(getDatabase).mockResolvedValue({
    getRepository: vi.fn().mockReturnValue({ findOne, find }),
  } as never);
  return { findOne, find };
}

const CONV_ID = "550e8400-e29b-41d4-a716-446655440000";
const URL = `http://localhost/api/conversations/${CONV_ID}/siblings`;

describe("GET /api/conversations/[id]/siblings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth(null);

    const { GET } = await import("./route");
    const res = await GET(new Request(URL), {
      params: Promise.resolve({ id: CONV_ID }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when conversation not found", async () => {
    mockAuth();
    mockDb({ conversation: null });

    const { GET } = await import("./route");
    const res = await GET(new Request(URL), {
      params: Promise.resolve({ id: CONV_ID }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Conversation not found");
  });

  it("returns root plus siblings for a root conversation (rootConversationId is null)", async () => {
    mockAuth();
    const root = { id: CONV_ID, userId: "user-1", title: "Root", rootConversationId: null, updatedAt: new Date() };
    const branches = [
      { id: "branch-1", userId: "user-1", title: "Branch 1", rootConversationId: CONV_ID, updatedAt: new Date() },
      { id: "branch-2", userId: "user-1", title: "Branch 2", rootConversationId: CONV_ID, updatedAt: new Date() },
    ];
    mockDb({ conversation: root, siblings: [root, ...branches] });

    const { GET } = await import("./route");
    const res = await GET(new Request(URL), {
      params: Promise.resolve({ id: CONV_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(3);
    const ids = body.map((c: { id: string }) => c.id);
    expect(ids).toContain(CONV_ID);
    expect(ids).toContain("branch-1");
    expect(ids).toContain("branch-2");
  });

  it("returns siblings for a branch conversation (uses rootConversationId as root)", async () => {
    mockAuth();
    const root = { id: CONV_ID, userId: "user-1", title: "Root", rootConversationId: null, updatedAt: new Date() };
    const branch = { id: "branch-1", userId: "user-1", title: "Branch 1", rootConversationId: CONV_ID, updatedAt: new Date() };
    const otherBranches = [
      { id: "branch-2", userId: "user-1", title: "Branch 2", rootConversationId: CONV_ID, updatedAt: new Date() },
    ];
    mockDb({ conversation: branch, siblings: [root, branch, ...otherBranches] });

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/conversations/branch-1/siblings"), {
      params: Promise.resolve({ id: "branch-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(3);
    const ids = body.map((c: { id: string }) => c.id);
    expect(ids).toContain(CONV_ID);
    expect(ids).toContain("branch-1");
    expect(ids).toContain("branch-2");
  });

  it("returns only root when no siblings exist", async () => {
    mockAuth();
    const root = { id: CONV_ID, userId: "user-1", title: "Root", rootConversationId: null, updatedAt: new Date() };
    mockDb({ conversation: root, siblings: [root] });

    const { GET } = await import("./route");
    const res = await GET(new Request(URL), {
      params: Promise.resolve({ id: CONV_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(CONV_ID);
  });
});
