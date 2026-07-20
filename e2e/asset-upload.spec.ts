import { test, expect } from './helpers/fixtures';
import { createConversation, uploadAsset } from './helpers/helpers';

test.describe('Asset upload', () => {
  test('upload PDF asset @smoke', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/');
    await createConversation(page);
    await uploadAsset(page, 'e2e/fixtures/sample.pdf');
    const assetRef = page.locator('[data-asset], [data-file-ref]');
    await expect(assetRef.first()).toBeVisible();
  });

  test('upload TXT file asset', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/');
    await createConversation(page);
    await uploadAsset(page, 'e2e/fixtures/sample.txt');
    const assetRef = page.locator('[data-asset], [data-file-ref]');
    await expect(assetRef.first()).toBeVisible();
  });
});
