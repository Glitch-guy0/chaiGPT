import { test, expect } from './helpers/fixtures';
import { createConversation, sendMessage, waitForStreamComplete } from './helpers/helpers';

test.describe('Web search', () => {
  test('web search returns cited result @smoke', async ({ authenticatedPage }) => {
    test.skip(!process.env.JINA_API_KEY, 'JINA_API_KEY not set — skipping web search test');

    const page = authenticatedPage;
    await page.goto('/');
    await createConversation(page);
    await sendMessage(page, 'What is the weather in Tokyo today?');
    await waitForStreamComplete(page);
    const response = page.locator('[data-role="assistant"]').last();
    await expect(response).toBeVisible();
    await expect(response.locator('a[href], [data-citation]')).toBeVisible({ timeout: 15_000 });
  });
});
