import { test, expect } from './helpers/fixtures';

test.describe('Auth-gated flows', () => {
  test('unauthenticated user is redirected to sign-in', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/sign-in|sign-up|clerk/, { timeout: 15_000 });
    expect(page.url()).toMatch(/sign-in|sign-up|clerk/);
  });

  test('authenticated user sees chat UI with sidebar @smoke', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await expect(authenticatedPage.locator('main, [data-chat], [data-sidebar]').first()).toBeVisible();
  });
});
