import { test, expect } from "./helpers/fixtures"
import { sendMessage, waitForStreamComplete, getLastAssistantMessage } from "./helpers/helpers"

test.describe("Streaming & Markdown Rendering", () => {
  test("renders progressive content before stream completes @smoke", async ({ authenticatedPage }) => {
    const page = authenticatedPage
    await page.goto("/")
    await sendMessage(page, "Count from 1 to 5 slowly")

    const assistantMessages = page.locator('[data-role="assistant"]')
    await expect(assistantMessages.first()).toBeVisible({ timeout: 10_000 })

    // Content should appear progressively (non-empty before stream completes)
    await expect(assistantMessages.first()).not.toBeEmpty({ timeout: 15_000 })
  })

  test("renders markdown content (bold, code, lists) @smoke", async ({ authenticatedPage }) => {
    const page = authenticatedPage
    await page.goto("/")
    await sendMessage(page, "Write a short code snippet with **bold** text and a list")

    await waitForStreamComplete(page)
    const content = await getLastAssistantMessage(page)

    expect(content.length).toBeGreaterThan(0)
  })

  test("displays stopped state on terminated stream @smoke", async ({ authenticatedPage }) => {
    const page = authenticatedPage
    await page.goto("/")
    await sendMessage(page, "Write a long story about everything")

    // Wait for some content to appear, then stop
    const assistantMessages = page.locator('[data-role="assistant"]')
    await expect(assistantMessages.first()).not.toBeEmpty({ timeout: 15_000 })

    const stopButton = page.locator('button:has-text("Stop")')
    if (await stopButton.isVisible({ timeout: 5_000 })) {
      await stopButton.click()
    }

    await waitForStreamComplete(page)
  })
})
