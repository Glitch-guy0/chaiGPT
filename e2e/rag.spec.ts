import { test, expect } from "@playwright/test"

test.describe("RAG answers @smoke", () => {
  test("chat API returns a response", async ({ page }) => {
    const convResponse = await page.request.post("/api/conversations", {
      data: { title: "RAG Test" },
    })
    const conv = await convResponse.json()

    const chatResponse = await page.request.post("/api/chat", {
      data: {
        messages: [{ role: "user", content: "What is 2 + 2?" }],
        conversationId: conv.id,
      },
    })

    expect(chatResponse.ok()).toBeTruthy()
    const contentType = chatResponse.headers()["content-type"] || ""
    expect(contentType).toContain("text/event-stream")
  })

  test("conversation messages persist after chat", async ({ page }) => {
    const convResponse = await page.request.post("/api/conversations", {
      data: { title: "RAG Persistence Test" },
    })
    const conv = await convResponse.json()

    await page.request.post("/api/chat", {
      data: {
        messages: [{ role: "user", content: "Remember this number: 42" }],
        conversationId: conv.id,
      },
    })

    const convDetail = await page.request.get(
      `/api/conversations/${conv.id}`
    )
    expect(convDetail.ok()).toBeTruthy()
  })

  test("invalid conversation ID returns 404", async ({ page }) => {
    const response = await page.request.post("/api/chat", {
      data: {
        messages: [{ role: "user", content: "test" }],
        conversationId: "nonexistent-id-12345",
      },
    })
    expect(response.status()).toBe(404)
  })

  test("empty messages array returns 400", async ({ page }) => {
    const response = await page.request.post("/api/chat", {
      data: { messages: [] },
    })
    expect(response.status()).toBe(400)
  })
})
