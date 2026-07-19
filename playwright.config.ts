import { defineConfig, devices } from "@playwright/test"

const CI = !!process.env.CI

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: 1,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "html",
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: CI ? "on-first-retry" : "off",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/chaigpt_test",
    },
  },

  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
})
