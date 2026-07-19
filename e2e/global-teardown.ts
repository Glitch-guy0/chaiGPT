import { execSync } from "child_process"

async function globalTeardown() {
  execSync(
    "docker compose -f infra/docker-compose.yml down -v",
    { stdio: "inherit", cwd: process.cwd() }
  )
}

export default globalTeardown
