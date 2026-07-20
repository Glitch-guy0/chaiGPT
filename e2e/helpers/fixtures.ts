import { test as base, type Page, type APIRequestContext } from '@playwright/test';

type CustomFixtures = {
  authenticatedPage: Page;
  apiContext: APIRequestContext;
};

export const test = base.extend<CustomFixtures>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  apiContext: async ({ request }, use) => {
    await use(request);
  },
});

export { expect } from '@playwright/test';
