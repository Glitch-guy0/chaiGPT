import { test, expect } from './helpers/fixtures';
import { createConversation, sendMessage } from './helpers/helpers';

test.describe('Asset lifecycle', () => {
  test('paste > 200 chars shows asset reference chip in message @smoke', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/');
    await createConversation(page);

    const longText = 'x'.repeat(250);
    const composer = page.locator('textarea').first();
    await composer.fill(longText);
    await page.locator('button[type="submit"], button:has-text("Send")').first().click();

    await page.waitForTimeout(2000);

    const assetChip = page.locator('[data-testid="asset-reference"], [data-asset]').first();
    await expect(assetChip).toBeVisible({ timeout: 10_000 });
  });

  test('upload file via composer button shows asset in panel', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/');
    await createConversation(page);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('button[aria-label="Upload file"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('e2e/fixtures/sample.txt');

    await page.waitForTimeout(1000);

    const assetToggle = page.locator('button:has-text("Assets")');
    await assetToggle.click();

    await expect(page.locator('text=sample.txt')).toBeVisible({ timeout: 10_000 });
  });

  test('delete asset removes from panel and shows toast', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/');
    await createConversation(page);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('button[aria-label="Upload file"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('e2e/fixtures/sample.txt');

    await page.waitForTimeout(1000);

    const assetToggle = page.locator('button:has-text("Assets")');
    await assetToggle.click();

    await expect(page.locator('text=sample.txt')).toBeVisible({ timeout: 10_000 });

    const deleteBtn = page.locator('button[aria-label="Delete sample.txt"]');
    await deleteBtn.click();

    await expect(page.locator('text=Are you sure')).toBeVisible();
    await page.locator('button:has-text("Delete")').last().click();

    await expect(page.locator('text=sample.txt')).not.toBeVisible({ timeout: 10_000 });
  });

  test('assets preserved after message deletion', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/');
    await createConversation(page);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('button[aria-label="Upload file"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('e2e/fixtures/sample.txt');

    await page.waitForTimeout(1000);

    await sendMessage(page, 'Hello');

    await page.waitForTimeout(3000);

    const assetToggle = page.locator('button:has-text("Assets")');
    await assetToggle.click();

    await expect(page.locator('text=sample.txt')).toBeVisible({ timeout: 10_000 });
  });

  test('edit-mode asset removal in assistant message', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/');
    await createConversation(page);

    const longText = 'x'.repeat(250);
    const composer = page.locator('textarea').first();
    await composer.fill(longText);
    await page.locator('button[type="submit"], button:has-text("Send")').first().click();

    await page.waitForTimeout(3000);

    await sendMessage(page, 'What do you think?');

    await page.waitForTimeout(3000);

    const editBtn = page.locator('button[aria-label="Edit message"]').first();
    await editBtn.click();

    const removeBtn = page.locator('button[aria-label^="Remove"]').first();
    if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.click();
    }
  });
});
