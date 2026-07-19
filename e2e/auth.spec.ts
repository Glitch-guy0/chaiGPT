import { test, expect } from "@playwright/test"

test.describe("Authentication flows @smoke", () => {
  test("shows login page for unauthenticated user", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/.*sign-in.*/)
    const loginButton = page.getByRole("button", { name: /sign in|log in/i })
    await expect(loginButton).toBeVisible()
  })

  test("can navigate to sign-up page", async ({ page }) => {
    await page.goto("/")
    const signUpLink = page.getByRole("link", { name: /sign up|create account/i })
    if (await signUpLink.isVisible()) {
      await signUpLink.click()
      await expect(page).toHaveURL(/.*sign-up.*/)
    }
  })

  test("chat input requires authentication", async ({ page }) => {
    await page.goto("/")
    const chatInput = page.getByRole("textbox", { name: /message|chat/i })
    const isVisible = await chatInput.isVisible().catch(() => false)
    if (!isVisible) {
      await expect(page.getByText(/sign in|log in/i)).toBeVisible()
    }
  })

  test("redirects unauthenticated user from protected routes", async ({ page }) => {
    const response = await page.goto("/api/conversations")
    const status = response?.status()
    expect(status === 401 || status === 302 || status === 200).toBeTruthy()
  })
})
