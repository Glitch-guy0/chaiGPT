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
    const branch = await repo.branch(conv1.id, "", "user-1");
    expect(branch.id).not.toBe(conv1.id);
    expect(branch.title).toContain("(branch)");
    expect(branch.rootConversationId).toBe(conv1.id);
    expect(branch.userId).toBe("user-1");
  });

  it("should throw on branch for non-existent conversation", async () => {
    await expect(repo.branch("bad-id", "", "user-1")).rejects.toThrow("Conversation not found");
  });

  it("should throw on branch with wrong userId", async () => {
    const { conv1 } = await seedTestData(ds);
    await expect(repo.branch(conv1.id, "", "user-2")).rejects.toThrow("Conversation not found");
  });
});
