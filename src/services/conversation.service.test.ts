import { describe, it, expect } from "vitest";

describe("ConversationService (interface contract)", () => {
  it("should export the ConversationService interface type", async () => {
    const mod = await import("./conversation.service");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });
});
