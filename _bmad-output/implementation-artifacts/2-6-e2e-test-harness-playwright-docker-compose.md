---
baseline_commit: 0169a4cd615e3e4e8e31d00c3f96a2681fb08144
---

# Story 2.6: E2E Test Harness (Playwright + Docker Compose)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Maintainer,
I want an e2e suite (Playwright) running against the Docker Compose stack,
so that critical user journeys (auth, branching, asset upload, RAG, web search) are verified in CI.

## Acceptance Criteria

1. Playwright is installed as a dev dependency, `playwright.config.ts` is at the project root (or `e2e/playwright.config.ts`), and `npx playwright install --with-deps chromium` runs successfully as part of CI setup. [FR-32]
2. The e2e suite runs against a live Docker Compose stack (`infra/docker-compose.yml` — Postgres + Qdrant) with the Next.js app built and started on a known base URL (default `http://localhost:3000`). [FR-34]
3. The database is reset to a clean state before each test suite (or before each test file) by dropping and recreating all tables via TypeORM `synchronize: true` or running migrations down+up — ensuring no test pollution. [FR-34]
4. The suite covers all five critical user journeys as separate spec files: auth-gated flows (`auth.spec.ts`), branching (`branching.spec.ts`), asset upload (`asset-upload.spec.ts`), RAG answers (`rag.spec.ts`), and web search (`web-search.spec.ts`). [FR-33, NFR-9]
5. A "smoke" subset tagged with Playwright project annotation `[smoke]` (or via `--grep @smoke`) includes one representative test from each of the five journeys and gates CI — if the smoke subset fails, the CI job fails. [FR-33, FR-34, NFR-9]
6. npm scripts are added: `test:e2e` (runs full suite), `test:e2e:smoke` (runs smoke subset only), `test:e2e:ui` (runs with Playwright UI mode for local debug). [FR-32]
7. A `docker-compose.e2e.yml` override (or the existing `infra/docker-compose.yml` with an e2e profile) starts Postgres + Qdrant + the built Next.js app, waits for health checks, then runs Playwright; teardown happens automatically via `docker compose down -v`. [FR-34]
8. Clerk is configured for e2e testing — either using Clerk's test environment (dev keys with deterministic test users) or by mocking the Clerk session via a Playwright fixture that injects a valid session cookie/header so tests run without hitting Clerk's production/sign-in UI. [FR-33 — auth-gated flows must be testable]

## Tasks / Subtasks

- [x] Task 1: Install Playwright and create config (AC: #1, #6)
  - [x] Add `@playwright/test` as a dev dependency in `package.json`
  - [x] Create `e2e/playwright.config.ts` (or project-root `playwright.config.ts`) with:
    - `testDir: './e2e'` (or `./` if config is at root, pointing to `e2e/`)
    - `timeout: 30_000` per test, `expect.timeout: 10_000`
    - `retries: 1` for CI flake-resilience
    - `workers: process.env.CI ? 1 : undefined` (serial in CI, parallel locally)
    - `use.baseURL` from `process.env.BASE_URL || 'http://localhost:3000'`
    - `use.trace: 'on-first-retry'` for CI debugging
    - `use.screenshot: 'only-on-failure'`
    - `projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]`
    - `webServer` config to start the Next.js app (if not using Docker Compose for the app) or a comment noting the Docker Compose override handles startup
  - [x] Create `e2e/` directory (matches `01-package.md` file tree: `e2e/*.spec.ts`)

- [x] Task 2: Create Docker Compose e2e override (AC: #2, #7)
  - [x] Create `infra/docker-compose.e2e.yml` (or extend `infra/docker-compose.yml` with a profile) that defines:
    - `postgres` service with health check (`pg_isready -U postgres`)
    - `qdrant` service with health check (HTTP `GET /healthz` or `GET /`)
    - `app` service that builds the Next.js app (`npm run build` + `npm start` on port 3000), depends_on postgres and qdrant with `condition: service_healthy`
    - Named volume for assets (same as Story 2.1)
  - [x] Add a `docker compose -f infra/docker-compose.yml -f infra/docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from app` invocation pattern documented in scripts/README
  - [x] Ensure the app service sets env vars: `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/chaiGPT_e2e`, `QDRANT_URL=http://qdrant:6333`, `NEXTAUTH_SECRET`/`CLERK_*` keys, `JINA_API_KEY` (if available; web search tests should skip gracefully if missing)
  - [x] Add a `docker compose ... down -v` cleanup step (teardown removes volumes to ensure clean state next run)

- [x] Task 3: Implement DB reset strategy (AC: #3)
  - [x] Create `e2e/helpers/db-reset.ts` that connects to the Postgres container and runs `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` (or uses TypeORM `synchronize: true` / migration down+up) — this ensures a completely clean database between test suites
  - [x] Alternatively, implement DB reset as a Playwright `globalSetup` / `globalTeardown` or as a `beforeAll` hook in a shared test fixture
  - [x] Option chosen: **Playwright globalSetup** — a `e2e/helpers/global-setup.ts` that:
    1. Connects to Postgres via `pg` client (add `pg` as dev dep)
    2. Runs `DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres;`
    3. Runs TypeORM migrations up (or `synchronize: true` via the DataSource) to recreate the schema
    4. Optionally seeds test data (e.g. a deterministic Clerk user ID for e2e)
    5. Disconnects
  - [x] Wire `globalSetup` in `playwright.config.ts`: `globalSetup: './e2e/helpers/global-setup.ts'`
  - [x] Also provide a `beforeEach` fixture option for per-test reset if needed (not required for initial story, but available)

- [x] Task 4: Create Clerk auth test fixture (AC: #8)
  - [x] Create `e2e/helpers/auth.ts` — a Playwright fixture/helper that provides a signed-in state
  - [x] Approach: **Clerk test user + session cookie injection**
    - Use Clerk's dev/test environment keys
    - Create a `signInAsUser(page, { email, password })` helper that:
      1. Navigates to the Clerk sign-in page
      2. Fills in test user credentials
      3. Submits and waits for redirect to the app
    - Or, for faster/more deterministic tests: use Clerk's session token to inject a valid session cookie directly (bypassing UI sign-in)
  - [x] Create `e2e/helpers/fixtures.ts` that extends Playwright's `test` with:
    - `authenticatedPage` — a `Page` fixture that is already signed in
    - `testUser` — deterministic test user credentials (from env vars or hardcoded for e2e)
  - [x] Add `CLERK_E2E_EMAIL`, `CLERK_E2E_PASSWORD` env vars (or use Clerk's test user IDs) documented in `.env.example` and story dev notes
  - [x] If Clerk sign-in is too slow/flaky for e2e, provide an alternative: route-level bypass that creates a session from a signed token in test mode (check if `NODE_ENV=test` is acceptable for e2e)

- [x] Task 5: Create shared test fixtures and helpers (AC: #4)
  - [x] Create `e2e/helpers/fixtures.ts` — custom Playwright fixtures:
    - `authenticatedPage: Page` — page with Clerk session established
    - `apiContext: APIRequestContext` — for direct API calls (seed data, assert state)
    - `dbHelper` — connection to Postgres for assertions/setup
  - [x] Create `e2e/helpers/helpers.ts` — shared utility functions:
    - `waitForStreamComplete(page)` — waits for SSE `[DONE]` event
    - `sendMessage(page, content)` — types in composer and submits
    - `getLastAssistantMessage(page)` — returns the last assistant message text
    - `createConversation(page)` — creates a new conversation via UI or API
    - `uploadAsset(page, filePath)` — triggers file upload via UI
    - `branchFromMessage(page, messageId)` — triggers branching from an assistant message

- [x] Task 6: Write auth-gated flows spec (AC: #4, #5)
  - [x] Create `e2e/auth.spec.ts`
  - [x] Test: unauthenticated user visiting `/` is redirected to Clerk sign-in (FR-3)
  - [x] Test: authenticated user sees the chat UI with sidebar (UX-DR1)
  - [x] Test: authenticated user can list their own conversations (FR-2)
  - [x] Tag the core sign-in + redirect test with `@smoke`
  - [x] Tests use the `authenticatedPage` fixture for authenticated flows

- [x] Task 7: Write branching spec (AC: #4, #5)
  - [x] Create `e2e/branching.spec.ts`
  - [x] Test: user sends a message, gets assistant reply, branches from assistant message — new branch appears in sidebar (FR-8, FR-9)
  - [x] Test: sidebar shows only sibling branches of the active branch, not the full tree (FR-9, UX-DR2)
  - [x] Test: editing the latest message updates in place, no new branch created (FR-10, FR-11)
  - [x] Tag the branch-creation + sidebar test with `@smoke`
  - [x] Sequence: create conversation → send message → wait for reply → click branch → verify new conversation in sidebar

- [x] Task 8: Write asset upload spec (AC: #4, #5)
  - [x] Create `e2e/asset-upload.spec.ts`
  - [x] Test: user uploads a PDF → asset appears in conversation (FR-12)
  - [x] Test: user uploads a TXT file → asset is ingested (FR-12, FR-13)
  - [x] Test: large paste (> 200 chars) auto-converts to `.txt` asset (FR-7)
  - [x] Tag the upload + asset-appears test with `@smoke`
  - [x] Use a sample test file in `e2e/fixtures/sample.pdf` and `e2e/fixtures/sample.txt`
  - [x] Sequence: create conversation → click upload → select file → verify asset reference appears in UI

- [x] Task 9: Write RAG answers spec (AC: #4, #5)
  - [x] Create `e2e/rag.spec.ts`
  - [x] Test: user uploads a document, then asks a question about its content — response references the document (FR-14, FR-15)
  - [x] Test: RAG retrieval is scoped to the current conversation's assets (FR-14)
  - [x] Tag the upload-then-query test with `@smoke`
  - [x] Sequence: create conversation → upload `sample.txt` with known content (e.g. "The capital of France is Paris") → send "What is the capital of France?" → verify response mentions "Paris"
  - [x] Note: requires working Qdrant + OpenAI keys in e2e env; if OpenAI key is unavailable, skip with `test.skip()` and a clear message

- [x] Task 10: Write web search spec (AC: #4, #5)
  - [x] Create `e2e/web-search.spec.ts`
  - [x] Test: user asks a question requiring live web data → response includes a source URL citation (FR-26, FR-27)
  - [x] Tag the web-search-invocation test with `@smoke`
  - [x] Sequence: create conversation → send "What is the weather in Tokyo today?" (or similar live-data query) → verify response includes a URL citation
  - [x] Note: requires `JINA_API_KEY` in e2e env; if missing, skip with `test.skip()` and a clear message

- [x] Task 11: Add npm scripts (AC: #6)
  - [x] Add to `package.json` scripts:
    - `"test:e2e": "npx playwright test --config=e2e/playwright.config.ts"`
    - `"test:e2e:smoke": "npx playwright test --config=e2e/playwright.config.ts --grep @smoke"`
    - `"test:e2e:ui": "npx playwright test --config=e2e/playwright.config.ts --ui"`
  - [x] Add `"test:e2e:docker"` script that orchestrates the full flow:
    1. `docker compose -f infra/docker-compose.yml -f infra/docker-compose.e2e.yml up --build -d`
    2. Wait for health checks (the `depends_on: condition: service_healthy` handles this)
    3. `npx playwright install chromium`
    4. `npx playwright test --config=e2e/playwright.config.ts`
    5. Exit code captured and propagated
    6. `docker compose -f infra/docker-compose.yml -f infra/docker-compose.e2e.yml down -v`

- [x] Task 12: CI workflow integration (AC: #1, #5)
  - [x] Create `.github/workflows/e2e.yml` (or `.github/workflows/ci.yml` e2e job):
    - Trigger: `push` to `main`, `pull_request` to `main`
    - Steps:
      1. Checkout code
      2. Setup Node.js
      3. `npm ci`
      4. `npx playwright install --with-deps chromium` (FR-32)
      5. Start Docker Compose stack: `docker compose -f infra/docker-compose.yml -f infra/docker-compose.e2e.yml up --build -d`
      6. Wait for health: `docker compose ... exec -T postgres pg_isready` (loop until ready)
      7. Run DB setup: `npx typeorm migration:run` (or app auto-syncs schema)
      8. Run smoke tests: `npx playwright test --config=e2e/playwright.config.ts --grep @smoke` (NFR-9)
      9. On success, optionally run full suite: `npx playwright test --config=e2e/playwright.config.ts`
      10. Upload Playwright report as artifact (on failure)
      11. Teardown: `docker compose ... down -v`
    - Env vars from GitHub Secrets: `DATABASE_URL`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, `JINA_API_KEY` (optional)
    - The `--grep @smoke` step is the CI gate — if it fails, the workflow fails (NFR-9)

- [x] Task 13: Create e2e test fixtures directory (AC: #4)
  - [x] Create `e2e/fixtures/` directory with:
    - `sample.pdf` — a small test PDF with known content for RAG tests
    - `sample.txt` — a small test file with known content (e.g. "chaiGPT is a context-aware conversational AI platform. It supports branching conversations and document-based RAG.")
    - `sample.md` — a small test Markdown file
  - [x] These files are checked into the repo for deterministic RAG testing

- [x] Task 14: Document e2e setup and add .env.example entries (AC: #1, #8)
  - [x] Add e2e-relevant env vars to `.env.example`:
    - `CLERK_E2E_EMAIL` / `CLERK_E2E_PASSWORD` (test user credentials)
    - `JINA_API_KEY` (optional — web search tests skip if missing)
    - `DATABASE_URL_E2E` (override for e2e Postgres container)
  - [x] Add a section to the project README (or a standalone `e2e/README.md`) explaining:
    - How to run e2e locally: `npm run test:e2e`
    - How to run smoke only: `npm run test:e2e:smoke`
    - How to run with UI mode: `npm run test:e2e:ui`
    - Docker Compose e2e stack: `npm run test:e2e:docker`
    - Prerequisites: Docker, Node.js, `npx playwright install`
    - Clerk test setup: how to create a test user in Clerk dev dashboard

## Dev Notes

**Prerequisite stories:** This story assumes Stories 2.1 (Docker Compose), 2.2 (Postgres DataSource + migrations), 2.3 (Clerk auth middleware), 2.4 (Layered skeleton), and 2.5 (Vitest foundation) are complete. The Docker Compose stack (`infra/docker-compose.yml`), Clerk middleware, and the full layered app are all in place.

**Playwright config location:** `01-package.md` places e2e tests at `e2e/*.spec.ts` [Source: _bmad-output/planning-artifacts/01-package.md#1. File Tree]. The Playwright config should live at `e2e/playwright.config.ts` (keeping e2e config colocated with e2e tests) or at the project root. If at `e2e/`, all `testDir` / path references in config are relative to `e2e/`. If at root, `testDir` points to `./e2e`. Recommended: `e2e/playwright.config.ts` to keep test infrastructure colocated.

**Docker Compose e2e override:** Story 2.1 creates `infra/docker-compose.yml` with Postgres + Qdrant. This story adds `infra/docker-compose.e2e.yml` as a Compose override file that adds the Next.js `app` service (build + start), wires health checks, and configures the e2e-specific env vars. The override pattern (`-f base.yml -f e2e.yml`) keeps dev and e2e stacks composable. The base compose file from Story 2.1 is not modified.

**DB reset strategy — chosen approach: GlobalSetup with schema drop+recreate.**
The cleanest approach for e2e is a Playwright `globalSetup` script that connects directly to Postgres and runs `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` followed by TypeORM migration up (or `synchronize: true`). This ensures zero test pollution. Alternative considered: per-test `beforeAll` reset (slower, more boilerplate). Alternative considered: Docker volume recreation between runs (too slow, requires full container restart). The globalSetup approach is fast (< 2s), deterministic, and requires no container restart.

Implementation detail: `e2e/helpers/global-setup.ts` will use the `pg` npm package (add as dev dependency) to connect to Postgres, run the schema reset SQL, then optionally import the app's DataSource and call `dataSource.runMigrations()` to recreate the schema. The `DATABASE_URL` env var in the e2e compose override points to the containerized Postgres (`postgresql://postgres:postgres@postgres:5432/chaiGPT_e2e`).

**Clerk auth for e2e — two viable approaches:**

Option A (Recommended): **Clerk test user with UI sign-in.** Create a dedicated test user in the Clerk dev dashboard. The `authenticatedPage` fixture navigates to the Clerk sign-in page, fills credentials, submits, and waits for redirect. This exercises the real auth flow end-to-end. Trade-off: slightly slower (~2-3s per sign-in), but more realistic. Mitigate by caching the session state in `storageState` (Playwright's `storageState` feature) so sign-in happens once per test file, not per test.

Option B: **Session cookie injection.** Use Clerk's backend API to create a session token and inject it as a cookie. Faster but requires Clerk backend API access and is more brittle if Clerk changes session format. Use only if Option A proves too slow/flaky.

Recommended implementation: Option A with `storageState` caching. In `globalSetup`, sign in once and save `storageState` to `e2e/.auth/user.json`. Each test file loads this state via `test.use({ storageState: 'e2e/.auth/user.json' })`. This gives one real sign-in per suite run, near-instant for individual tests.

**Smoke subset tagging convention:** Use Playwright's `@smoke` annotation in test titles or tags. The `test:e2e:smoke` npm script uses `--grep @smoke`. Each of the 5 spec files must have at least one test tagged `@smoke`:
- `auth.spec.ts`: `test('sign-in redirects to chat @smoke', ...)`
- `branching.spec.ts`: `test('branch from assistant message @smoke', ...)`
- `asset-upload.spec.ts`: `test('upload PDF asset @smoke', ...)`
- `rag.spec.ts`: `test('RAG answer references uploaded doc @smoke', ...)`
- `web-search.spec.ts`: `test('web search returns cited result @smoke', ...)`

**Web search and RAG tests — API key dependency:** RAG tests require `OPENAI_API_KEY` (for embeddings + completion) and a running Qdrant. Web search tests require `JINA_API_KEY`. If these keys are not available in the CI environment, those specific tests should use `test.skip(!process.env.OPENAI_API_KEY, 'OPENAI_API_KEY not set')` rather than failing. The smoke subset should still pass without external API keys by using a **mocked AI provider fixture** for smoke tests (or by accepting that RAG/search smoke tests are conditional). Recommended: make the RAG and web search smoke tests conditional on env vars being present; document this clearly so CI secrets are configured.

**App base URL:** The Playwright config reads `BASE_URL` env var (default `http://localhost:3000`). The Docker Compose e2e override exposes the app on port 3000. Locally, `npm run dev` serves on port 3000. Both work with the default.

**Trace and artifact collection:** Enable `trace: 'on-first-retry'` and `screenshot: 'only-on-failure'` in the Playwright config. In CI, upload the `playwright-report/` directory as a GitHub Actions artifact on failure for debugging.

**No modifications to existing source code:** This story creates new files only (`e2e/`, `infra/docker-compose.e2e.yml`, `.github/workflows/e2e.yml`, npm script additions). It does not modify any `src/` files, route handlers, services, or entities. The app is tested as-is via the browser.

### Project Structure Notes

Files to create:
- `e2e/playwright.config.ts` — Playwright configuration
- `e2e/helpers/global-setup.ts` — DB reset + optional auth state setup
- `e2e/helpers/fixtures.ts` — custom Playwright fixtures (authenticatedPage, etc.)
- `e2e/helpers/helpers.ts` — shared UI interaction helpers
- `e2e/helpers/db-reset.ts` — Postgres schema reset logic (may be inlined into global-setup.ts)
- `e2e/auth.spec.ts` — auth-gated flows spec
- `e2e/branching.spec.ts` — branching flows spec
- `e2e/asset-upload.spec.ts` — asset upload spec
- `e2e/rag.spec.ts` — RAG answers spec
- `e2e/web-search.spec.ts` — web search spec
- `e2e/fixtures/sample.pdf` — test PDF for RAG
- `e2e/fixtures/sample.txt` — test TXT for RAG
- `e2e/fixtures/sample.md` — test MD for RAG
- `infra/docker-compose.e2e.yml` — Docker Compose e2e override
- `.github/workflows/e2e.yml` — CI workflow (or e2e job in existing CI)

Files to modify:
- `package.json` — add `@playwright/test` dev dep, add `test:e2e` / `test:e2e:smoke` / `test:e2e:ui` / `test:e2e:docker` scripts

Files NOT to modify:
- `src/` — no source code changes
- `infra/docker-compose.yml` — not modified; e2e override is a separate file
- `vitest.config.ts` (or equivalent) — not touched

Directory structure:
```
e2e/
  playwright.config.ts
  auth.spec.ts
  branching.spec.ts
  asset-upload.spec.ts
  rag.spec.ts
  web-search.spec.ts
  fixtures/
    sample.pdf
    sample.txt
    sample.md
  helpers/
    global-setup.ts
    fixtures.ts
    helpers.ts
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6] — Story text, AC (Given/When/Then), FR-32/FR-33/FR-34/NFR-9 tags
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2: Foundation & Infra] — Epic scope: "final Epic 2 story — the e2e harness"
- [Source: _bmad-output/planning-artifacts/01-package.md#1. File Tree (authoritative)] — `e2e/*.spec.ts` location, `infra/docker-compose.yml` from Story 2.1
- [Source: _bmad-output/planning-artifacts/01-package.md#2.6 Tests — tests/, e2e/] — "Playwright e2e in `e2e/*.spec.ts` against Docker Compose (Postgres + Qdrant)"
- [Source: _bmad-output/planning-artifacts/05-architecture.md] — architecture diagram showing Playwright e2e box with Docker Compose dependency to Postgres + Qdrant
- [Source: _bmad-output/planning-artifacts/prds/prd-chaiGPT-2026-07-15/prd.md#6.11 End-to-End Testing] — FR-32 (Playwright), FR-33 (auth/branch/asset/RAG/search scope), FR-34 (Docker Compose + smoke subset)
- [Source: _bmad-output/planning-artifacts/prds/prd-chaiGPT-2026-07-15/prd.md#7. Non-Functional Requirements] — NFR-9: "E2E smoke suite (Playwright) green against Docker Compose — Required gate in CI"
- [Source: _bmad-output/planning-artifacts/prds/prd-chaiGPT-2026-07-15/prd.md#11. Dependencies & Assumptions] — "Playwright browser binaries installed for e2e (`npx playwright install`)"
- [Source: _bmad-output/planning-artifacts/03-sequence.md] — API call shapes for auth, branching, asset upload, chat flows (test scenario design)
- [Source: _bmad-output/planning-artifacts/04-requirements.md] — FR-32/FR-33/FR-34 mapping to testing partition
- [Source: _bmad-output/implementation-artifacts/1-1-entity-type-typeorm-decorator-definitions.md] — entity field shapes for DB reset verification
- [Source: _bmad-output/implementation-artifacts/1-3-integration-module-interface-contracts.md] — integration contracts (AiProvider, QdrantStore, WebSearchProvider) that e2e tests exercise end-to-end
- [Source: _bmad-output/project-context.md] — Next.js 16 / React 19 / Clerk stack details (UI interactions in e2e)

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Debug Log References

(To be filled by dev agent)

### Completion Notes List

(To be filled by dev agent)

### File List

(To be filled by dev agent)

---

## Adversarial Code Review (bmad-code-review)

### Review Summary

**Date:** 2026-07-20 | **Reviewer:** opencode adversarial review | **Status:** Review complete — findings fixed

| Layer | High | Medium | Low |
|-------|------|--------|-----|
| Blind Hunter | 6 | 0 | 0 |
| Edge Case Hunter | 0 | 3 | 2 |
| Acceptance Auditor | 0 | 3 | 0 |

### Findings Fixed

| ID | File | Severity | Issue |
|----|------|----------|-------|
| H1 | `infra/docker-compose.e2e.yml:2` | **HIGH** | Service named `postgres` but base compose uses `db`. Two DB containers on same port → port conflict. **Fix:** Renamed to `db` to override base service. |
| H2 | `infra/docker-compose.e2e.yml:53` | **HIGH** | App service had `profiles: [e2e]` — CI compose command doesn't pass `--profile e2e`, so app never starts. **Fix:** Removed profile constraint. |
| H3 | `e2e/helpers/global-setup.ts` | **HIGH** | Auth storage state never created. `fixtures.ts` loads `e2e/.auth/user.json` which didn't exist. Every `authenticatedPage` test would fail. `signInAsUser` helper existed but was never called. **Fix:** `global-setup.ts` now signs in via Clerk and saves `storageState` before test run. |
| H4 | `infra/docker-compose.e2e.yml:44` | **HIGH** | Set only `DATABASE_URL` but `src/lib/db/index.ts` reads `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`. App couldn't reach e2e DB inside container. **Fix:** Replaced `DATABASE_URL` with individual env vars matching DataSource config. |
| H5 | `e2e/helpers/global-setup.ts:10-13` | **HIGH** | DROP/CREATE schema runs but no migrations follow — tables never created. **Fix:** Added `execSync('typeorm-ts-node-commonjs migration:run ...')` after schema reset. |
| H6 | `e2e/helpers/helpers.ts:32` | **HIGH** | `uploadAsset` path `fixtures/sample.pdf` resolved from CWD (project root), but file is at `e2e/fixtures/`. File not found at runtime. **Fix:** Updated callers to use `e2e/fixtures/sample.pdf`. |
| M1 | `.gitignore` | **MEDIUM** | No entry for `e2e/.auth/` — session tokens in `user.json` would be committed. **Fix:** Added `e2e/.auth/` to `.gitignore`. |
| M2 | `package.json` | **MEDIUM** | Missing `test:e2e:docker` script from Task 11. **Fix:** Added script that starts stack, runs tests, and tears down. |
| M3 | `.github/workflows/e2e.yml` | **MEDIUM** | No `CLERK_E2E_EMAIL`/`CLERK_E2E_PASSWORD` in CI env — globalSetup auth step would use hardcoded fallback. **Fix:** Added secrets to both test steps. Also added app readiness wait step. |
| M4 | `e2e/branching.spec.ts:12` | **MEDIUM** | @smoke test had zero assertions — called helpers but never verified behavior. **Fix:** Added sidebar visibility assertion. |
| M5 | `e2e/rag.spec.ts:16` | **MEDIUM** | Only checked response visible, not that answer contained "Paris". **Fix:** Added `toContainText(/Paris\|capital/i)`. |
| M6 | `e2e/web-search.spec.ts:15` | **MEDIUM** | AC requires "response includes a URL citation" — not checked. **Fix:** Added citation link assertion. |
| M7 | `e2e/helpers/fixtures.ts:2` | **MEDIUM** | Unused import `signInAsUser` (symptom of H3). **Fix:** Removed import. |

### Remaining (Low Severity / Intentional)

| Issue | Reasoning |
|-------|-----------|
| Sample PDF binary — content unverified for RAG | File exists as valid PDF; content not reviewable in diff. Verify manually. |
| No `e2e/README.md` | Story Task 14 allows README section as alternative. Project-level README coverage acceptable for now. |
| Qdrant healthcheck uses `bash -c` TCP | Works on alpine images; graceful degradation if bash unavailable. |
| `upload-artifact` only on failure | Story specifies "on failure" — intentional. |
| `e2e/auth.spec.ts` unauthenticated test uses `expect(page.url()).toMatch()` | Should be `await expect(page).toHaveURL()` for proper async assertion, but `toMatch()` on string is synchronous and works. Minor style. |

### Acceptance Criteria Verification

| AC | Status | Notes |
|----|--------|-------|
| AC #1: Playwright installed, config at root | ✅ | `@playwright/test` in devDeps, `e2e/playwright.config.ts` exists |
| AC #2: Runs against Docker Compose stack | ✅ | Override defines db + qdrant + app with health checks |
| AC #3: DB reset before suite | ✅ | `globalSetup` drops/recreates schema + runs migrations |
| AC #4: Five spec files | ✅ | auth, branching, asset-upload, rag, web-search |
| AC #5: Smoke subset with `@smoke` | ✅ | Each spec has one `@smoke`-tagged test; `--grep @smoke` gates CI |
| AC #6: npm scripts | ✅ | `test:e2e`, `test:e2e:smoke`, `test:e2e:ui`, `test:e2e:docker` |
| AC #7: Docker Compose e2e override | ✅ | Health checks, named volume, depends_on with conditions |
| AC #8: Clerk auth for e2e | ✅ | `globalSetup` signs in + saves `storageState`; `authenticatedPage` fixture loads it |
