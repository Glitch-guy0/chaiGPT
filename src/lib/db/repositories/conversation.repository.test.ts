import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DataSource } from "typeorm";
import { createTestDataSource, seedTestData } from "../../../../tests/fixtures/test-datasource";
import { ConversationRepositoryImpl } from "./conversation.repository";

describe("ConversationRepository (interface contract)", () => {
  let ds: DataSource;

  beforeEach(async () => {
    ds = await createTestDataSource();
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it("should save and retrieve a conversation by id and userId", async () => {
    const { conv1 } = await seedTestData(ds);
    const repo = ds.getRepository("Conversation");

    const found = await repo.findOne({
      where: { id: conv1.id, userId: "user-1" },
    });
    expect(found).toBeDefined();
    expect(found!.title).toBe("Test Conversation 1");
    expect(found!.userId).toBe("user-1");
  });

  it("should return null for non-existent conversation", async () => {
    const repo = ds.getRepository("Conversation");
    const found = await repo.findOne({
      where: { id: "non-existent", userId: "user-1" },
    });
    expect(found).toBeNull();
  });

  it("should scope queries by userId (isolation)", async () => {
    await seedTestData(ds);
    const repo = ds.getRepository("Conversation");

    const user1Convs = await repo.find({ where: { userId: "user-1" } });
    const user2Convs = await repo.find({ where: { userId: "user-2" } });

    expect(user1Convs.length).toBe(2);
    expect(user2Convs.length).toBe(0);
  });
});

describe("ConversationRepositoryImpl", () => {
  let ds: DataSource;
  let repo: ConversationRepositoryImpl;

  beforeEach(async () => {
    ds = await createTestDataSource();
    repo = new ConversationRepositoryImpl(ds);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it("should findById with userId scoping", async () => {
    const { conv1 } = await seedTestData(ds);
    const found = await repo.findById(conv1.id, "user-1");
    expect(found).toBeDefined();
    expect(found!.title).toBe("Test Conversation 1");

    const notFound = await repo.findById(conv1.id, "user-2");
    expect(notFound).toBeNull();
  });

  it("should findAll for a given user", async () => {
    await seedTestData(ds);
    const user1 = await repo.findAll("user-1");
    expect(user1.length).toBe(2);

    const user2 = await repo.findAll("user-2");
    expect(user2.length).toBe(0);
  });

  it("should save a new conversation", async () => {
    const saved = await repo.save({ userId: "user-1", title: "New", model: "gpt-4" });
    expect(saved.id).toBeDefined();
    expect(saved.title).toBe("New");
  });

  it("should branch a conversation", async () => {
    const { conv1 } = await seedTestData(ds);
    const msgRepo = ds.getRepository("Message");
    const seeded = await msgRepo.save({
      conversationId: conv1.id,
      userId: "user-1",
      role: "assistant",
      content: "Hi there",
      status: "complete",
    });
    const branch = await repo.branch(conv1.id, seeded.id, "user-1");
    expect(branch.id).not.toBe(conv1.id);
    expect(branch.title).toContain("(branch)");
    expect(branch.rootConversationId).toBe(conv1.id);
    expect(branch.userId).toBe("user-1");
    expect(branch.lastMessageId).toBeDefined();
    expect(branch.lastMessageId).not.toBe(seeded.id);
  });

  it("should throw on branch for non-existent conversation", async () => {
    await expect(repo.branch("bad-id", "", "user-1")).rejects.toThrow("Conversation not found");
  });

  it("should throw on branch with wrong userId", async () => {
    const { conv1 } = await seedTestData(ds);
    await expect(repo.branch(conv1.id, "", "user-2")).rejects.toThrow("Conversation not found");
  });
});

describe("ConversationRepositoryImpl branch (message copying)", () => {
  let ds: DataSource;
  let repo: ConversationRepositoryImpl;

  async function seedConversationWithMessages(opts: {
    conversationId: string;
    rootConversationId?: string;
    messages: Array<{
      id: string;
      parentId?: string;
      role: "user" | "assistant" | "system";
      content: string;
    }>;
  }) {
    const convRepo = ds.getRepository("Conversation");
    const msgRepo = ds.getRepository("Message");
    await convRepo.save({
      id: opts.conversationId,
      userId: "user-1",
      title: "Source",
      model: "gpt-4o-mini",
      rootConversationId: opts.rootConversationId,
    });
    for (const m of opts.messages) {
      await msgRepo.save({
        id: m.id,
        conversationId: opts.conversationId,
        userId: "user-1",
        parentId: m.parentId,
        role: m.role,
        content: m.content,
        status: "complete",
      });
    }
  }

  beforeEach(async () => {
    ds = await createTestDataSource();
    repo = new ConversationRepositoryImpl(ds);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it("creates branch with rootConversationId = source id when source is root", async () => {
    await seedConversationWithMessages({
      conversationId: "conv-root",
      messages: [{ id: "m1", role: "user", content: "hi" }],
    });

    const branch = await repo.branch("conv-root", "m1", "user-1");

    expect(branch.rootConversationId).toBe("conv-root");
    expect(branch.userId).toBe("user-1");
    expect(branch.title).toBe("Source (branch)");
  });

  it("creates branch with rootConversationId = source's root when source is already a branch", async () => {
    await seedConversationWithMessages({
      conversationId: "conv-branch",
      rootConversationId: "conv-root",
      messages: [{ id: "m1", role: "user", content: "hi" }],
    });

    const branch = await repo.branch("conv-branch", "m1", "user-1");

    expect(branch.rootConversationId).toBe("conv-root");
  });

  it("copies correct number of messages into branch (fresh UUIDs, not source ids)", async () => {
    await seedConversationWithMessages({
      conversationId: "conv-1",
      messages: [
        { id: "m1", role: "user", content: "q1" },
        { id: "m2", parentId: "m1", role: "assistant", content: "a1" },
        { id: "m3", parentId: "m2", role: "user", content: "q2" },
        { id: "m4", parentId: "m3", role: "assistant", content: "a2" },
      ],
    });

    const branch = await repo.branch("conv-1", "m4", "user-1");
    const msgRepo = ds.getRepository("Message");
    const copied = await msgRepo.find({
      where: { conversationId: branch.id },
      order: { createdAt: "ASC", id: "ASC" },
    });

    expect(copied).toHaveLength(4);
    expect(copied.every((m) => m.conversationId === branch.id)).toBe(true);
    expect(copied.every((m) => m.id !== "m1" && m.id !== "m2" && m.id !== "m3" && m.id !== "m4")).toBe(true);
    expect(copied.every((m) => m.content)).toBeTruthy();
  });

  it("does not corrupt the source conversation (critical regression test)", async () => {
    await seedConversationWithMessages({
      conversationId: "conv-1",
      messages: [
        { id: "m1", role: "user", content: "q1" },
        { id: "m2", parentId: "m1", role: "assistant", content: "a1" },
        { id: "m3", parentId: "m2", role: "user", content: "q2" },
        { id: "m4", parentId: "m3", role: "assistant", content: "a2" },
      ],
    });

    await repo.branch("conv-1", "m4", "user-1");

    const msgRepo = ds.getRepository("Message");
    const sourceMessages = await msgRepo.find({
      where: { conversationId: "conv-1" },
      order: { createdAt: "ASC", id: "ASC" },
    });

    expect(sourceMessages).toHaveLength(4);
    expect(sourceMessages.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(sourceMessages.every((m) => m.conversationId === "conv-1")).toBe(true);
    expect(sourceMessages[0].content).toBe("q1");
    expect(sourceMessages[1].content).toBe("a1");
  });

  it("does not copy messages after branch point", async () => {
    await seedConversationWithMessages({
      conversationId: "conv-1",
      messages: [
        { id: "m1", role: "user", content: "q1" },
        { id: "m2", parentId: "m1", role: "assistant", content: "a1" },
        { id: "m3", parentId: "m2", role: "user", content: "q2" },
        { id: "m4", parentId: "m3", role: "assistant", content: "a2" },
      ],
    });

    const branch = await repo.branch("conv-1", "m2", "user-1");
    const msgRepo = ds.getRepository("Message");
    const copied = await msgRepo.find({
      where: { conversationId: branch.id },
      order: { createdAt: "ASC", id: "ASC" },
    });

    expect(copied).toHaveLength(2);
  });

  it("sets lastMessageId to a new UUID (branch-point copy)", async () => {
    await seedConversationWithMessages({
      conversationId: "conv-1",
      messages: [
        { id: "m1", role: "user", content: "q1" },
        { id: "m2", parentId: "m1", role: "assistant", content: "a1" },
      ],
    });

    const branch = await repo.branch("conv-1", "m2", "user-1");

    expect(branch.lastMessageId).toBeDefined();
    expect(branch.lastMessageId).not.toBe("m2");
    const msgRepo = ds.getRepository("Message");
    const lastMsg = await msgRepo.findOne({ where: { id: branch.lastMessageId! } });
    expect(lastMsg).toBeDefined();
    expect(lastMsg!.conversationId).toBe(branch.id);
    expect(lastMsg!.role).toBe("assistant");
  });

  it("remaps parentId chain correctly in branch copies", async () => {
    await seedConversationWithMessages({
      conversationId: "conv-1",
      messages: [
        { id: "m1", role: "user", content: "q1" },
        { id: "m2", parentId: "m1", role: "assistant", content: "a1" },
      ],
    });

    const branch = await repo.branch("conv-1", "m2", "user-1");
    const msgRepo = ds.getRepository("Message");
    const copied = await msgRepo.find({
      where: { conversationId: branch.id },
      order: { createdAt: "ASC" },
    });

    expect(copied).toHaveLength(2);
    expect(copied[0].parentId == null).toBe(true);
    expect(copied[1].parentId).toBe(copied[0].id);
  });

  it("throws when messageId is not in the conversation", async () => {
    await seedConversationWithMessages({
      conversationId: "conv-1",
      messages: [{ id: "m1", role: "user", content: "q1" }],
    });

    await expect(repo.branch("conv-1", "missing-msg", "user-1")).rejects.toThrow(
      "Message not found in conversation"
    );
  });
});
