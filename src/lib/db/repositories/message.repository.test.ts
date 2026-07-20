import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DataSource } from "typeorm";
import { createTestDataSource, seedTestData } from "../../../../tests/fixtures/test-datasource";

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
