import { test, expect } from "@playwright/test"

test.describe("Branch creation @smoke", () => {
  test("can create a new conversation", async ({ page }) => {
    const response = await page.request.post("/api/conversations", {
      data: { title: "E2E Branch Test" },
    })
    expect(response.ok()).toBeTruthy()
    const conversation = await response.json()
    expect(conversation).toHaveProperty("id")
    expect(conversation.title).toBe("E2E Branch Test")
  })

  test("conversations list is accessible", async ({ page }) => {
    const response = await page.request.get("/api/conversations")
    expect(response.ok()).toBeTruthy()
    const conversations = await response.json()
    expect(Array.isArray(conversations)).toBeTruthy()
  })

  test("sidebar shows conversation list", async ({ page }) => {
    await page.request.post("/api/conversations", {
      data: { title: "Sidebar Test Conv" },
    })
    await page.goto("/")
    const sidebar = page.locator("aside, [class*=sidebar], nav")
    await expect(sidebar.first()).toBeVisible()
  })

  test("can send message and get response in new branch", async ({ page }) => {
    const convResponse = await page.request.post("/api/conversations", {
      data: { title: "Branch Message Test" },
    })
    const conv = await convResponse.json()

    const chatResponse = await page.request.post("/api/chat", {
      data: {
        messages: [{ role: "user", content: "Say hello in one word" }],
        conversationId: conv.id,
      },
    })
    expect(chatResponse.ok()).toBeTruthy()
  })
})
