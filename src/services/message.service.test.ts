import { describe, it, expect } from "vitest";

describe("MessageService (interface contract)", () => {
  it("should export the MessageService interface type", async () => {
    const mod = await import("./message.service");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });
});
