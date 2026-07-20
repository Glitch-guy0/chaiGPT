# E2E Tests (Playwright)

## Prerequisites

- Docker Desktop (for the infra stack: Postgres + Qdrant)
- Node.js 20+
- `npx playwright install chromium` (run once after `npm ci`)

## Running Tests

```bash
# Run the full e2e suite (requires Docker Compose infra + running app)
npm run test:e2e

# Run smoke subset only (CI gate)
npm run test:e2e:smoke

# Run with Playwright UI mode (local debug)
npm run test:e2e:ui
```

## Docker Compose E2E Stack

```bash
# Start the full stack + run tests + teardown
docker compose -f infra/docker-compose.yml -f infra/docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from app
docker compose -f infra/docker-compose.yml -f infra/docker-compose.e2e.yml down -v
```

## Clerk Test Setup

1. Go to the [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create a test user in the **Users** section
3. Set `CLERK_E2E_EMAIL` and `CLERK_E2E_PASSWORD` in your `.env` file
4. Ensure `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` are set from your dev instance

## Test Fixtures

- `e2e/fixtures/sample.pdf` — small PDF for asset upload and RAG tests
- `e2e/fixtures/sample.txt` — text file for asset upload tests
- `e2e/fixtures/sample.md` — markdown file for asset upload tests

## Notes

- RAG tests require `OPENAI_API_KEY`; skipped if missing
- Web search tests require `JINA_API_KEY`; skipped if missing
- The smoke subset (`@smoke` tagged tests) is the CI gate
- Trace and screenshot artifacts are collected on failure (`playwright-report/`)
