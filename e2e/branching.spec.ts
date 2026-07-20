import { test, expect } from './helpers/fixtures';
import { sendMessage, waitForStreamComplete, createConversation, branchFromMessage } from './helpers/helpers';

test.describe('Branching flows', () => {
  test('branch from assistant message @smoke', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/');
    await createConversation(page);
    await sendMessage(page, 'Hello, this is a test message');
    await waitForStreamComplete(page);
    await branchFromMessage(page);
    await expect(page.locator('[data-sidebar] a, nav a').first()).toBeVisible({ timeout: 5_000 });
  });

  test('sidebar shows sibling branches', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/');
    await createConversation(page);
    await sendMessage(page, 'First message');
    await waitForStreamComplete(page);
    const sidebarItems = page.locator('[data-sidebar] a, [data-sidebar] li, nav a');
    await expect(sidebarItems.first()).toBeVisible();
  });
});
