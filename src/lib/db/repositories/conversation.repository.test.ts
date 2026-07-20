import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DataSource } from "typeorm";
import { createTestDataSource, seedTestData } from "../../../../tests/fixtures/test-datasource";

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
