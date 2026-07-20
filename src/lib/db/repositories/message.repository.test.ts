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
});
