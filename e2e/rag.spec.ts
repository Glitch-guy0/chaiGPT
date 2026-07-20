import { test, expect } from './helpers/fixtures';
import { createConversation, uploadAsset, sendMessage, waitForStreamComplete } from './helpers/helpers';

test.describe('RAG answers', () => {
  test('RAG answer references uploaded doc @smoke', async ({ authenticatedPage }) => {
    test.skip(!process.env.OPENAI_API_KEY, 'OPENAI_API_KEY not set — skipping RAG test');

    const page = authenticatedPage;
    await page.goto('/');
    await createConversation(page);
    await uploadAsset(page, 'e2e/fixtures/sample.txt');
    await sendMessage(page, 'What is the capital of France?');
    await waitForStreamComplete(page);
    const response = page.locator('[data-role="assistant"]').last();
    await expect(response).toBeVisible();
    await expect(response).toContainText(/Paris|capital/i, { timeout: 15_000 });
  });
});
