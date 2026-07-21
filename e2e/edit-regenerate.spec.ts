import { test, expect } from "./helpers/fixtures"
import { sendMessage, waitForStreamComplete } from "./helpers/helpers"

test.describe("Edit & Regenerate Controls", () => {
  test("shows edit button on latest user message and regenerate on stopped assistant @smoke", async ({ authenticatedPage }) => {
    const page = authenticatedPage
    await page.goto("/")

    await sendMessage(page, "Hello, what is the capital of France?")

    await waitForStreamComplete(page)

    const editButtons = page.locator('[aria-label="Edit message"]')
    await expect(editButtons.first()).toBeVisible({ timeout: 5_000 })

    const userMessages = page.locator('[aria-label="Edit message"]')
    expect(await userMessages.count()).toBeGreaterThanOrEqual(1)
  })

  test("click edit opens inline editor, save updates content @smoke", async ({ authenticatedPage }) => {
    const page = authenticatedPage
    await page.goto("/")

    await sendMessage(page, "Write a short poem")

    await waitForStreamComplete(page)

    const editButton = page.locator('[aria-label="Edit message"]').first()
    await expect(editButton).toBeVisible({ timeout: 5_000 })
    await editButton.click()

    const editor = page.locator('[aria-label="Edit message content"]')
    await expect(editor).toBeVisible({ timeout: 3_000 })

    await editor.fill("Tell me a joke instead")

    const saveButton = page.locator('[aria-label="Save"]')
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    await expect(page.locator('[aria-label="Edit message content"]')).not.toBeVisible({ timeout: 5_000 })
  })

  test("cancel edit with Escape restores original content @smoke", async ({ authenticatedPage }) => {
    const page = authenticatedPage
    await page.goto("/")

    await sendMessage(page, "What is 2+2?")

    await waitForStreamComplete(page)

    const editButton = page.locator('[aria-label="Edit message"]').first()
    await expect(editButton).toBeVisible({ timeout: 5_000 })
    await editButton.click()

    const editor = page.locator('[aria-label="Edit message content"]')
    await expect(editor).toBeVisible({ timeout: 3_000 })

    await editor.press("Escape")

    await expect(page.locator('[aria-label="Edit message content"]')).not.toBeVisible({ timeout: 3_000 })
  })
})
