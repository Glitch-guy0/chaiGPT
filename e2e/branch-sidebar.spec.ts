import { test, expect } from './helpers/fixtures';

test.describe('Branch-aware sidebar', () => {
  test('sidebar visible and shows conversations when viewing root @smoke', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/');
    await expect(page.locator('[data-sidebar]')).toBeVisible();

    const res1 = await page.request.post('/api/conversations', {
      data: { title: 'Sidebar Test 1' },
    });
    expect(res1.ok()).toBe(true);
    const conv1 = await res1.json();

    const res2 = await page.request.post('/api/conversations', {
      data: { title: 'Sidebar Test 2' },
    });
    expect(res2.ok()).toBe(true);
    const conv2 = await res2.json();

    await page.goto('/');

    const btn1 = page.locator(`[data-conversation-id="${conv1.id}"]`);
    const btn2 = page.locator(`[data-conversation-id="${conv2.id}"]`);
    await expect(btn1).toBeVisible({ timeout: 10_000 });
    await expect(btn2).toBeVisible({ timeout: 10_000 });
  });

  test('root conversation shows all conversations in sidebar', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/');

    const res1 = await page.request.post('/api/conversations', {
      data: { title: 'Root A' },
    });
    const rootA = await res1.json();

    const res2 = await page.request.post('/api/conversations', {
      data: { title: 'Root B' },
    });
    const rootB = await res2.json();

    await page.goto('/');

    await page.locator(`[data-conversation-id="${rootA.id}"]`).click();

    await expect(
      page.locator(`[data-conversation-id="${rootA.id}"]`)
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator(`[data-conversation-id="${rootB.id}"]`)
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clicking conversation highlights it as active', async ({ authenticatedPage }) => {
    const page = authenticatedPage;
    await page.goto('/');

    const res = await page.request.post('/api/conversations', {
      data: { title: 'Highlight Test' },
    });
    expect(res.ok()).toBe(true);
    const conv = await res.json();

    await page.goto('/');

    const btn = page.locator(`[data-conversation-id="${conv.id}"]`);
    await btn.click();
    await expect(btn).toHaveClass(/secondary/);
  });
});
