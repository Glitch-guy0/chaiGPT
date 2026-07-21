import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DataSource } from "typeorm";
import { createTestDataSource, seedTestData } from "../../../../tests/fixtures/test-datasource";
import { MessageRepositoryImpl } from "./message.repository";

describe("MessageRepository (interface contract)", () => {
  let ds: DataSource;

  beforeEach(async () => {
    ds = await createTestDataSource();
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it("should save and find messages by conversationId", async () => {
    const { conv1 } = await seedTestData(ds);
    const repo = ds.getRepository("Message");

    const messages = await repo.find({
      where: { conversationId: conv1.id },
      order: { createdAt: "ASC" },
    });

    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
  });

  it("should update message status", async () => {
    const { conv1 } = await seedTestData(ds);
    const repo = ds.getRepository("Message");

    const msg = await repo.findOne({
      where: { conversationId: conv1.id, role: "user" },
    });
    expect(msg!.status).toBe("complete");

    await repo.update(msg!.id, { status: "stopped" });
    const updated = await repo.findOne({ where: { id: msg!.id } });
    expect(updated!.status).toBe("stopped");
  });

  it("should scope messages by userId", async () => {
    await seedTestData(ds);
    const repo = ds.getRepository("Message");

    const user1Msgs = await repo.find({ where: { userId: "user-1" } });
    const user2Msgs = await repo.find({ where: { userId: "user-2" } });

    expect(user1Msgs.length).toBe(2);
    expect(user2Msgs.length).toBe(0);
  });
});

describe("MessageRepositoryImpl", () => {
  let ds: DataSource;
  let repo: MessageRepositoryImpl;

  beforeEach(async () => {
    ds = await createTestDataSource();
    repo = new MessageRepositoryImpl(ds);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it("should findById with userId scoping", async () => {
    const { conv1 } = await seedTestData(ds);
    const msgs = await repo.findByConversation(conv1.id, "user-1");
    const msg = await repo.findById(msgs[0].id, "user-1");
    expect(msg).toBeDefined();
    expect(msg!.content).toBe("Hello");

    const notFound = await repo.findById(msgs[0].id, "user-2");
    expect(notFound).toBeNull();
  });

  it("should findAll with userId scoping", async () => {
    await seedTestData(ds);
    const user1 = await repo.findAll("user-1");
    expect(user1.length).toBe(2);

    const user2 = await repo.findAll("user-2");
    expect(user2.length).toBe(0);
  });

  it("should findByConversation with userId scoping", async () => {
    const { conv1 } = await seedTestData(ds);
    const msgs = await repo.findByConversation(conv1.id, "user-1");
    expect(msgs.length).toBe(2);

    const notFound = await repo.findByConversation(conv1.id, "user-2");
    expect(notFound.length).toBe(0);
  });

  it("should save a new message", async () => {
    const { conv1 } = await seedTestData(ds);
    const msg = await repo.save({
      conversationId: conv1.id,
      userId: "user-1",
      role: "user",
      content: "test",
      status: "processing",
    });
    expect(msg.id).toBeDefined();
    expect(msg.status).toBe("processing");
  });

  it("should updateStatus", async () => {
    const { conv1 } = await seedTestData(ds);
    const msgs = await repo.findByConversation(conv1.id, "user-1");
    await repo.updateStatus(msgs[0].id, "stopped", "user-1");

    const updated = await repo.findById(msgs[0].id, "user-1");
    expect(updated!.status).toBe("stopped");
  });

  it("should throw on updateStatus for wrong userId", async () => {
    const { conv1 } = await seedTestData(ds);
    const msgs = await repo.findByConversation(conv1.id, "user-1");
    await expect(repo.updateStatus(msgs[0].id, "stopped", "user-2")).rejects.toThrow("Message not found");
  });

  it("should find latest sibling by parentId (any role), scoped by userId", async () => {
    const { conv1 } = await seedTestData(ds);
    const repo2 = ds.getRepository("Message");
    const parent = await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "user", content: "parent", status: "complete" });
    const base = new Date("2025-01-01T00:00:00Z");
    await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "user", content: "u1", status: "complete", parentId: parent.id, createdAt: new Date(base.getTime() + 1000) });
    await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "user", content: "u2", status: "complete", parentId: parent.id, createdAt: new Date(base.getTime() + 2000) });

    const latest = await repo.findLatestSibling(parent.id, conv1.id, "user-1");
    expect(latest).not.toBeNull();
    expect(latest!.content).toBe("u2");

    const none = await repo.findLatestSibling(parent.id, conv1.id, "user-2");
    expect(none).toBeNull();
  });

  it("should find siblings by parentId ordered ASC, scoped by userId", async () => {
    const { conv1 } = await seedTestData(ds);
    const repo2 = ds.getRepository("Message");
    const parent = await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "user", content: "parent", status: "complete" });
    const base = new Date("2025-01-01T00:00:00Z");
    await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "user", content: "u1", status: "complete", parentId: parent.id, createdAt: new Date(base.getTime() + 1000) });
    await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "user", content: "u2", status: "complete", parentId: parent.id, createdAt: new Date(base.getTime() + 2000) });
    await repo2.save({ conversationId: conv1.id, userId: "user-2", role: "user", content: "other", status: "complete", parentId: parent.id, createdAt: new Date(base.getTime() + 3000) });

    const siblings = await repo.findSiblingsByParentId(parent.id, conv1.id, "user-1");
    expect(siblings.length).toBe(2);
    expect(siblings[0].content).toBe("u1");
    expect(siblings[1].content).toBe("u2");
  });

  it("should find by parentId across conversations (branched-away detection)", async () => {
    const { conv1 } = await seedTestData(ds);
    const convRepo = ds.getRepository("Conversation");
    const conv2 = await convRepo.save({ userId: "user-1", title: "branch" });
    const repo2 = ds.getRepository("Message");
    const parent = await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "user", content: "parent", status: "complete" });

    await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "user", content: "u1", status: "complete", parentId: parent.id });
    await repo2.save({ conversationId: conv2.id, userId: "user-1", role: "user", content: "forked", status: "complete", parentId: parent.id });

    const children = await repo.findByParentId(parent.id, "user-1");
    expect(children.length).toBe(2);
    const foreign = children.find((c) => c.conversationId !== conv1.id);
    expect(foreign).toBeDefined();
    expect(foreign!.content).toBe("forked");
  });

  it("should walk parentId chain root-first and exclude sibling branches", async () => {
    const { conv1 } = await seedTestData(ds);
    const repo2 = ds.getRepository("Message");
    const base = new Date("2025-01-01T00:00:00Z");

    const root = await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "user", content: "root", status: "complete", createdAt: new Date(base.getTime()) });
    const a = await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "assistant", content: "A", status: "complete", parentId: root.id, createdAt: new Date(base.getTime() + 1000) });
    const b = await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "assistant", content: "B", status: "stopped", parentId: a.id, createdAt: new Date(base.getTime() + 2000) });
    await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "assistant", content: "sibling", status: "complete", parentId: a.id, createdAt: new Date(base.getTime() + 3000) });

    const chain = await repo.findMessageChain(conv1.id, b.id, "user-1");
    expect(chain.map((m) => m.content)).toEqual(["root", "A", "B"]);
    expect(chain.length).toBe(3);
  });

  it("should return only the root message when parentId is null", async () => {
    const { conv1 } = await seedTestData(ds);
    const repo2 = ds.getRepository("Message");
    const flat = await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "assistant", content: "flat", status: "stopped" });

    const chain = await repo.findMessageChain(conv1.id, flat.id, "user-1");
    expect(chain.length).toBe(1);
    expect(chain[0].content).toBe("flat");
  });

  it("should terminate gracefully at an orphaned parent", async () => {
    const { conv1 } = await seedTestData(ds);
    const repo2 = ds.getRepository("Message");
    const base = new Date("2025-01-01T00:00:00Z");

    const root = await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "user", content: "root", status: "complete", createdAt: new Date(base.getTime()) });
    const orphaned = await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "assistant", content: "orphan", status: "complete", parentId: root.id, createdAt: new Date(base.getTime() + 1000) });
    const tail = await repo2.save({ conversationId: conv1.id, userId: "user-1", role: "assistant", content: "tail", status: "stopped", parentId: "does-not-exist", createdAt: new Date(base.getTime() + 2000) });

    await repo2.update(orphaned.id, { parentId: "does-not-exist" });

    const chain = await repo.findMessageChain(conv1.id, tail.id, "user-1");
    expect(chain.map((m) => m.content)).toEqual(["tail"]);
  });

  describe("removeAssetId", () => {
    it("should remove the specified assetId from the message", async () => {
      const { conv1 } = await seedTestData(ds);
      const repo2 = ds.getRepository("Message");
      const msg = await repo2.save({
        conversationId: conv1.id,
        userId: "user-1",
        role: "assistant",
        content: "response",
        status: "complete",
        assetIds: ["asset-1", "asset-2", "asset-3"],
      });

      await repo.removeAssetId(msg.id, "asset-2", "user-1");

      const updated = await repo.findById(msg.id, "user-1");
      expect(updated!.assetIds).toEqual(["asset-1", "asset-3"]);
    });

    it("should preserve original array when assetId is not found", async () => {
      const { conv1 } = await seedTestData(ds);
      const repo2 = ds.getRepository("Message");
      const msg = await repo2.save({
        conversationId: conv1.id,
        userId: "user-1",
        role: "assistant",
        content: "response",
        status: "complete",
        assetIds: ["asset-1", "asset-2"],
      });

      await repo.removeAssetId(msg.id, "asset-999", "user-1");

      const updated = await repo.findById(msg.id, "user-1");
      expect(updated!.assetIds).toEqual(["asset-1", "asset-2"]);
    });

    it("should enforce userId scoping", async () => {
      const { conv1 } = await seedTestData(ds);
      const repo2 = ds.getRepository("Message");
      const msg = await repo2.save({
        conversationId: conv1.id,
        userId: "user-1",
        role: "assistant",
        content: "response",
        status: "complete",
        assetIds: ["asset-1"],
      });

      await expect(
        repo.removeAssetId(msg.id, "asset-1", "wrong-user"),
      ).rejects.toThrow("Message not found");
    });

    it("should handle message with no assetIds gracefully", async () => {
      const { conv1 } = await seedTestData(ds);
      const repo2 = ds.getRepository("Message");
      const msg = await repo2.save({
        conversationId: conv1.id,
        userId: "user-1",
        role: "assistant",
        content: "response",
        status: "complete",
      });

      await repo.removeAssetId(msg.id, "asset-1", "user-1");

      const updated = await repo.findById(msg.id, "user-1");
      expect(updated!.assetIds).toEqual([]);
    });
  });
});
