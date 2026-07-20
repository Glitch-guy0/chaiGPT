import type { Page } from '@playwright/test';

export async function sendMessage(page: Page, content: string): Promise<void> {
  const composer = page.locator('textarea, [contenteditable="true"], [role="textbox"]').first();
  await composer.fill(content);
  await page.locator('button[type="submit"], button:has-text("Send")').first().click();
}

export async function waitForStreamComplete(page: Page): Promise<void> {
  // Wait for the streaming indicator to disappear
  await page.locator('[data-streaming]').waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {
    // Streaming may have completed before we started waiting
  });
}

export async function getLastAssistantMessage(page: Page): Promise<string> {
  return page.locator('[data-role="assistant"]').last().innerText();
}

export async function createConversation(page: Page): Promise<void> {
  const newChatBtn = page.locator('button:has-text("New Chat"), a:has-text("New Conversation"), button:has-text("New")').first();
  if (await newChatBtn.isVisible()) {
    await newChatBtn.click();
  }
}

export async function uploadAsset(page: Page, filePath: string): Promise<void> {
  const fileChooserPromise = page.waitForEvent('filechooser');
  const uploadTrigger = page.locator('button:has-text("Upload"), input[type="file"]').first();
  await uploadTrigger.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
}

export async function branchFromMessage(page: Page, messageIndex?: number): Promise<void> {
  const msgIdx = messageIndex ?? 0;
  const branchBtn = page.locator('[data-role="assistant"] [data-branch], [data-role="assistant"] button:has-text("Branch")').nth(msgIdx);
  await branchBtn.click();
}
