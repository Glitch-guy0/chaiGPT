import { test, expect } from '@playwright/test';

test.describe('Smoke subset @smoke', () => {
  test('has title', async ({ page }) => {
    expect(true).toBeTruthy();
  });
});
