import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DataSource } from "typeorm";
import { createTestDataSource, seedTestData } from "../../../../tests/fixtures/test-datasource";

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
