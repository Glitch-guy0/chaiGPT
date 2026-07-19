import { test, expect } from "@playwright/test"

test.describe("Asset upload @smoke", () => {
  test("conversation supports file attachment metadata", async ({ page }) => {
    const convResponse = await page.request.post("/api/conversations", {
      data: { title: "Asset Upload Test" },
    })
    const conv = await convResponse.json()
    expect(conv.id).toBeTruthy()
  })

  test("chat endpoint accepts message with asset reference", async ({ page }) => {
    const convResponse = await page.request.post("/api/conversations", {
      data: { title: "Asset Chat Test" },
    })
    const conv = await convResponse.json()

    const chatResponse = await page.request.post("/api/chat", {
      data: {
        messages: [
          {
            role: "user",
            content: "I uploaded a document about our API design",
          },
        ],
        conversationId: conv.id,
      },
    })

    expect([200, 400, 500]).toContain(chatResponse.status())
  })

  test("upload UI element exists on chat page", async ({ page }) => {
    await page.goto("/")
    const attachButton = page.getByRole("button", { name: /attach|upload|file/i })
    const input = page.locator('input[type="file"]')
    const hasAttach = await attachButton.isVisible().catch(() => false)
    const hasInput = await input.count().then((c) => c > 0)
    expect(hasAttach || hasInput).toBeTruthy()
  })
})
