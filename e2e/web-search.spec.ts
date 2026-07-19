import { test, expect } from "@playwright/test"

test.describe("Web search @smoke", () => {
  test("chat handles search-like queries", async ({ page }) => {
    const convResponse = await page.request.post("/api/conversations", {
      data: { title: "Web Search Test" },
    })
    const conv = await convResponse.json()

    const chatResponse = await page.request.post("/api/chat", {
      data: {
        messages: [
          {
            role: "user",
            content: "What is the current date today?",
          },
        ],
        conversationId: conv.id,
      },
    })

    expect(chatResponse.ok()).toBeTruthy()
  })

  test("chat endpoint validates message format", async ({ page }) => {
    const response = await page.request.post("/api/chat", {
      data: { messages: "not-an-array" },
    })
    expect(response.status()).toBe(400)
  })

  test("chat endpoint rejects missing messages", async ({ page }) => {
    const response = await page.request.post("/api/chat", {
      data: {},
    })
    expect(response.status()).toBe(400)
  })
})
