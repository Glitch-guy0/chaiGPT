import { Client } from 'pg';
import { chromium, type Browser } from '@playwright/test';
import { execSync } from 'child_process';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';
const DB_NAME = process.env.DB_NAME || 'chaiGPT_e2e';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

function buildConnectionString(): string {
  return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

async function resetDatabase(): Promise<void> {
  const client = new Client({ connectionString: buildConnectionString() });

  try {
    await client.connect();
    await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('[global-setup] Database schema reset complete');
  } catch (err) {
    console.error('[global-setup] Failed to reset database schema:', err);
    throw err;
  } finally {
    await client.end();
  }
}

async function setupAuthState(): Promise<void> {
  const CLERK_E2E_EMAIL = process.env.CLERK_E2E_EMAIL || 'e2e-test-user@example.com';
  const CLERK_E2E_PASSWORD = process.env.CLERK_E2E_PASSWORD || 'e2e-test-password';
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  const authFile = 'e2e/.auth/user.json';

  const fs = await import('fs');
  const dir = 'e2e/.auth';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const browser: Browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: BASE_URL });

  try {
    await page.goto('/sign-in');
    await page.waitForSelector('input[name=identifier]', { timeout: 15_000 });

    const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
    await emailInput.fill(CLERK_E2E_EMAIL);

    const continueBtn = page.locator('button[type="submit"], button:has-text("Continue")').first();
    await continueBtn.click();

    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(CLERK_E2E_PASSWORD);

    const signInBtn = page.locator('button[type="submit"], button:has-text("Sign In")').first();
    await signInBtn.click();

    await page.waitForURL('**/', { timeout: 15_000 });
    await page.context().storageState({ path: authFile });
    console.log('[global-setup] Auth storage state saved');
  } catch (err) {
    console.error('[global-setup] Failed to set up auth state:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

async function runMigrations(): Promise<void> {
  try {
    execSync('npx typeorm-ts-node-commonjs migration:run -d src/lib/db/index.ts', {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log('[global-setup] Migrations applied');
  } catch (err) {
    console.error('[global-setup] Failed to run migrations:', err);
    throw err;
  }
}

async function globalSetup() {
  await resetDatabase();
  await runMigrations();
  await setupAuthState();
}

export default globalSetup;
