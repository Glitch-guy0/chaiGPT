import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DataSource } from "typeorm";
import { createTestDataSource, seedTestData } from "../../../../tests/fixtures/test-datasource";
import { AssetRepositoryImpl } from "./asset.repository";

describe("AssetRepository (interface contract)", () => {
  let ds: DataSource;

  beforeEach(async () => {
    ds = await createTestDataSource();
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it("should save and find an asset by id", async () => {
    const { conv1 } = await seedTestData(ds);
    const repo = ds.getRepository("Asset");

    const assets = await repo.find({
      where: { conversationId: conv1.id, userId: "user-1" },
    });

    expect(assets.length).toBe(1);
    expect(assets[0].filename).toBe("test.txt");
    expect(assets[0].mime).toBe("text/plain");
  });

  it("should delete an asset by id", async () => {
    const { conv1 } = await seedTestData(ds);
    const repo = ds.getRepository("Asset");

    const asset = await repo.findOne({
      where: { conversationId: conv1.id, userId: "user-1" },
    });
    await repo.delete(asset!.id);

    const found = await repo.findOne({ where: { id: asset!.id } });
    expect(found).toBeNull();
  });

  it("should scope assets by userId", async () => {
    await seedTestData(ds);
    const repo = ds.getRepository("Asset");

    const user1Assets = await repo.find({ where: { userId: "user-1" } });
    const user2Assets = await repo.find({ where: { userId: "user-2" } });

    expect(user1Assets.length).toBe(1);
    expect(user2Assets.length).toBe(0);
  });
});

describe("AssetRepositoryImpl", () => {
  let ds: DataSource;
  let repo: AssetRepositoryImpl;

  beforeEach(async () => {
    ds = await createTestDataSource();
    repo = new AssetRepositoryImpl(ds);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it("should findById with userId scoping", async () => {
    const { conv1 } = await seedTestData(ds);
    const assets = await repo.findByConversation(conv1.id, "user-1");
    const found = await repo.findById(assets[0].id, "user-1");
    expect(found).toBeDefined();
    expect(found!.filename).toBe("test.txt");

    const notFound = await repo.findById(assets[0].id, "user-2");
    expect(notFound).toBeNull();
  });

  it("should findAll with userId scoping", async () => {
    await seedTestData(ds);
    const user1 = await repo.findAll("user-1");
    expect(user1.length).toBe(1);

    const user2 = await repo.findAll("user-2");
    expect(user2.length).toBe(0);
  });

  it("should findByConversation with userId scoping", async () => {
    const { conv1 } = await seedTestData(ds);
    const assets = await repo.findByConversation(conv1.id, "user-1");
    expect(assets.length).toBe(1);

    const notFound = await repo.findByConversation(conv1.id, "user-2");
    expect(notFound.length).toBe(0);
  });

  it("should save a new asset", async () => {
    const { conv1 } = await seedTestData(ds);
    const asset = await repo.save({
      userId: "user-1",
      conversationId: conv1.id,
      filename: "doc.pdf",
      mime: "application/pdf",
      path: "/tmp/doc.pdf",
    });
    expect(asset.id).toBeDefined();
    expect(asset.filename).toBe("doc.pdf");
  });

  it("should delete with userId scoping", async () => {
    const { conv1 } = await seedTestData(ds);
    const assets = await repo.findByConversation(conv1.id, "user-1");
    await repo.delete(assets[0].id, "user-1");

    const found = await repo.findById(assets[0].id, "user-1");
    expect(found).toBeNull();
  });

  it("should throw on delete for wrong userId", async () => {
    const { conv1 } = await seedTestData(ds);
    const assets = await repo.findByConversation(conv1.id, "user-1");
    await expect(repo.delete(assets[0].id, "user-2")).rejects.toThrow("Asset not found");
  });
});
