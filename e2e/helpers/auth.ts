import type { Page } from '@playwright/test';

const CLERK_E2E_EMAIL = process.env.CLERK_E2E_EMAIL || 'e2e-test-user@example.com';
const CLERK_E2E_PASSWORD = process.env.CLERK_E2E_PASSWORD || 'e2e-test-password';

export async function signInAsUser(page: Page): Promise<void> {
  await page.goto('/sign-in');
  await page.waitForSelector('input[name=identifier]', { timeout: 10_000 }).catch(() => {
    // Clerk may use alternative selectors depending on version
  });

  // Attempt to fill Clerk sign-in form — may use different selectors per Clerk version
  const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
  await emailInput.fill(CLERK_E2E_EMAIL);

  const continueBtn = page.locator('button[type="submit"], button:has-text("Continue")').first();
  await continueBtn.click();

  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  await passwordInput.fill(CLERK_E2E_PASSWORD);

  const signInBtn = page.locator('button[type="submit"], button:has-text("Sign In")').first();
  await signInBtn.click();

  await page.waitForURL('**/');
}
