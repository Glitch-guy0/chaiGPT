import { execSync } from "child_process"
import { chromium } from "@playwright/test"

async function globalSetup() {
  execSync(
    "docker compose -f infra/docker-compose.yml up -d postgres qdrant",
    { stdio: "inherit", cwd: process.cwd() }
  )

  execSync("npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts", {
    stdio: "inherit",
    cwd: process.cwd(),
    timeout: 30_000,
  })

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  let ready = false
  for (let i = 0; i < 30; i++) {
    try {
      await page.goto("http://localhost:3000", { timeout: 3_000 })
      ready = true
      break
    } catch {
      await new Promise((r) => setTimeout(r, 2_000))
    }
  }

  await browser.close()

  if (!ready) {
    throw new Error("Dev server did not start within 60s")
  }
}

export default globalSetup
