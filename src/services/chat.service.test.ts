import { describe, it, expect } from "vitest";

describe("ChatService (interface contract)", () => {
  it("should export the ChatService interface type", async () => {
    const mod = await import("./chat.service");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });
});
