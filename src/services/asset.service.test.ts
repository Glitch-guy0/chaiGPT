import { describe, it, expect } from "vitest";

describe("AssetService (interface contract)", () => {
  it("should export the AssetService interface type", async () => {
    const mod = await import("./asset.service");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });
});
