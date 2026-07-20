---
baseline_commit: 0169a4cd615e3e4e8e31d00c3f96a2681fb08144
---

# Story 2.5: Testing Foundation (Vitest + ≥80% Coverage Gate)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Maintainer,
I want a test harness with repository and service fixtures and a coverage gate,
so that NFR-7 (≥80% coverage of services + repositories) is enforced in CI.

## Acceptance Criteria

1. Vitest is installed (`vitest` + `@vitest/coverage-v8` dev dependencies) and a `vitest.config.ts` is created at the project root with coverage reporter configured to measure `src/services/**/*.ts` and `src/lib/db/repositories/**/*.ts` (excluding `*.test.ts` files). [FR-29, NFR-7]
2. Colocated test files follow the `*.test.ts` naming convention next to each service and repository source file (e.g. `src/services/chat.service.test.ts`, `src/lib/db/repositories/conversation.repository.test.ts`). [FR-29]
3. Shared mock fixtures exist in `tests/fixtures/` for every external integration dependency: `MockAiProvider` (implements `AiProvider`), `MockQdrantStore` (implements `QdrantStore`), `MockRedisCache` (implements `RedisCache`), `MockJinaProvider` (implements `WebSearchProvider`), and `MockAuthSession` (implements `Session`). [FR-30, NFR-8]
4. Repository test fixtures provide seedable in-memory data via TypeORM's `DataSource` with `type: "sqlite"` + `database: ":memory:"` — no external Postgres required for unit tests. Each test uses `beforeEach` to create a fresh in-memory database, run entity registration, and seed 2–3 rows per entity. [FR-29]
5. At least one representative test file exists per repository (`conversation.repository.test.ts`, `message.repository.test.ts`, `asset.repository.test.ts`) and per service (`chat.service.test.ts`, `conversation.service.test.ts`, `message.service.test.ts`, `asset.service.test.ts`), even if the service test is a minimal smoke test against the interface until concrete implementations land in Epic 3/4/5. [FR-29]
6. A `coverageThreshold` config in `vitest.config.ts` enforces ≥80% on `branches`, `functions`, `lines`, and `statements` for `src/services` and `src/lib/db/repositories` combined — `vitest run --coverage` exits non-zero when the threshold is breached. [FR-31, NFR-7]
7. npm scripts are added: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`. [FR-29]
8. A CI step (e.g. in a `ci.yml` GitHub Actions workflow or `package.json` script) runs `npm run test:coverage` and fails the build if the coverage gate is breached (exit code non-zero from Vitest's coverage threshold). [FR-31, NFR-7]
9. All unit tests run offline and deterministically — no network calls, no Docker, no external services. External deps (OpenAI/LangChain, Qdrant, Jina, Clerk, Redis) are mocked via the fixtures from AC #3. [FR-30, NFR-8]
10. `tests/` directory is added to the project structure at the root level: `tests/fixtures/` for shared mocks. `tests/unit/` exists as an optional overflow location for complex shared helpers, but primary test files are colocated. [FR-29, 01-package.md §2.6]

## Tasks / Subtasks

- [x] Task 1: Install Vitest and coverage dependencies (AC: #1, #7)
  - [x] Run `npm install -D vitest @vitest/coverage-v8`
  - [x] Verify `vitest` and `@vitest/coverage-v8` appear in `devDependencies` in `package.json`
- [x] Task 2: Create `vitest.config.ts` at project root (AC: #1, #6, #7)
  - [x] Create `vitest.config.ts` with the following configuration:
  ```ts
  import { defineConfig } from "vitest/config";
  import path from "path";

  export default defineConfig({
    test: {
      globals: true,
      environment: "node",
      include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
      exclude: ["node_modules", ".next", "e2e"],
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov", "json-summary"],
        include: ["src/services/**/*.ts", "src/lib/db/repositories/**/*.ts"],
        exclude: [
          "src/services/**/*.test.ts",
          "src/lib/db/repositories/**/*.test.ts",
          "src/services/index.ts",
          "src/lib/db/repositories/index.ts",
        ],
        thresholds: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
      typecheck: {
        enabled: false,
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  });
  ```
  - [x] The `@/` alias matches the existing `tsconfig.json` paths config (`"@/*": ["./src/*"]`)
  - [x] `include` covers colocated `src/**/*.test.ts` and any overflow `tests/**/*.test.ts`
  - [x] `coverage.include` restricts coverage measurement to only `src/services` and `src/lib/db/repositories` (not route handlers, not UI, not integration modules)
  - [x] `coverage.exclude` removes test files and barrel re-exports from measurement
  - [x] `coverageThreshold` enforces ≥80% on all four metrics — Vitest exits non-zero when breached
  - [x] `reporter: ["text", "lcov", "json-summary"]` — `text` for terminal output, `lcov` for CI tooling, `json-summary` for programmatic gate checks
- [x] Task 3: Add npm scripts to `package.json` (AC: #7)
  - [x] Add `"test": "vitest run"` — single run, exits
  - [x] Add `"test:watch": "vitest"` — watch mode for dev
  - [x] Add `"test:coverage": "vitest run --coverage"` — runs with coverage gate
  - [x] Do NOT modify existing scripts (`dev`, `build`, `start`, `lint`)
- [x] Task 4: Create `tests/fixtures/` directory and shared mock fixtures (AC: #3, #9)
  - [x] Create `tests/fixtures/mock-ai-provider.ts` — `MockAiProvider` implementing `AiProvider`:
  ```ts
  import type { AiProvider } from "@/lib/ai/langchain";
  import type { ChatMessage } from "@/types";

  export class MockAiProvider implements AiProvider {
    private completeFn: (messages: ChatMessage[]) => Promise<string>;
    private streamFn: (
      messages: ChatMessage[],
      onChunk: (token: string) => void
    ) => Promise<void>;

    constructor() {
      this.completeFn = async () => "mock completion response";
      this.streamFn = async (_msgs, onChunk) => {
        onChunk("mock ");
        onChunk("token");
      };
    }

    onComplete(fn: (messages: ChatMessage[]) => Promise<string>) {
      this.completeFn = fn;
    }

    onStream(
      fn: (
        messages: ChatMessage[],
        onChunk: (token: string) => void
      ) => Promise<void>
    ) {
      this.streamFn = fn;
    }

    async complete(messages: ChatMessage[]): Promise<string> {
      return this.completeFn(messages);
    }

    async streamChat(
      messages: ChatMessage[],
      onChunk: (token: string) => void
    ): Promise<void> {
      return this.streamFn(messages, onChunk);
    }
  }
  ```
  - [x] Create `tests/fixtures/mock-qdrant-store.ts` — `MockQdrantStore` implementing `QdrantStore`:
  ```ts
  import type { QdrantStore, Hit, Chunk } from "@/lib/vector/qdrant";

  export class MockQdrantStore implements QdrantStore {
    private embedFn: (text: string) => Promise<number[]> = async () =>
      new Array(384).fill(0.1);
    private searchFn: (
      vec: number[],
      convId: string,
      k: number
    ) => Promise<Hit[]> = async () => [];
    private upsertFn: (
      assetId: string,
      chunks: Chunk[]
    ) => Promise<void> = async () => {};

    onEmbed(fn: (text: string) => Promise<number[]>) {
      this.embedFn = fn;
    }
    onSearch(
      fn: (vec: number[], convId: string, k: number) => Promise<Hit[]>
    ) {
      this.searchFn = fn;
    }
    onUpsert(fn: (assetId: string, chunks: Chunk[]) => Promise<void>) {
      this.upsertFn = fn;
    }

    async embed(text: string): Promise<number[]> {
      return this.embedFn(text);
    }
    async search(
      vec: number[],
      convId: string,
      k: number
    ): Promise<Hit[]> {
      return this.searchFn(vec, convId, k);
    }
    async upsertChunks(
      assetId: string,
      chunks: Chunk[]
    ): Promise<void> {
      return this.upsertFn(assetId, chunks);
    }
  }
  ```
  - [x] Create `tests/fixtures/mock-redis-cache.ts` — `MockRedisCache` implementing `RedisCache`:
  ```ts
  import type { RedisCache } from "@/lib/cache/redis";

  export class MockRedisCache implements RedisCache {
    private store = new Map<string, string>();

    async get(key: string): Promise<string | null> {
      return this.store.get(key) ?? null;
    }
    async set(key: string, value: string, _ttl: number): Promise<void> {
      this.store.set(key, value);
    }
    clear() {
      this.store.clear();
    }
  }
  ```
  - [x] Create `tests/fixtures/mock-jina-provider.ts` — `MockJinaProvider` implementing `WebSearchProvider`:
  ```ts
  import type {
    WebSearchProvider,
    WebResult,
  } from "@/lib/websearch/jina";

  export class MockJinaProvider implements WebSearchProvider {
    private searchFn: (query: string) => Promise<WebResult[]> =
      async () => [];

    onSearch(fn: (query: string) => Promise<WebResult[]>) {
      this.searchFn = fn;
    }

    async search(query: string): Promise<WebResult[]> {
      return this.searchFn(query);
    }
  }
  ```
  - [x] Create `tests/fixtures/mock-auth-session.ts` — `createMockSession` returning `() => Promise<AuthSession>`:
  ```ts
  import type { AuthSession } from "@/lib/auth/session";

  export function createMockSession(
    userId: string | null = "test-user-id",
  ): () => Promise<AuthSession> {
    return async () => ({ userId: userId ?? "test-user-id" });
  }
  ```
  - [x] Create `tests/fixtures/index.ts` — barrel re-export:
  ```ts
  export { MockAiProvider } from "./mock-ai-provider";
  export { MockQdrantStore } from "./mock-qdrant-store";
  export { MockRedisCache } from "./mock-redis-cache";
  export { MockJinaProvider } from "./mock-jina-provider";
  export { createMockSession } from "./mock-auth-session";
  ```
- [x] Task 5: Create in-memory TypeORM test helper for repository tests (AC: #4)
  - [x] Create `tests/fixtures/test-datasource.ts` — factory function that returns a seeded in-memory SQLite DataSource:
  ```ts
  import { DataSource } from "typeorm";
  import { Conversation } from "@/lib/db/entities/conversation.entity";
  import { Message } from "@/lib/db/entities/message.entity";
  import { Asset } from "@/lib/db/entities/asset.entity";

  export async function createTestDataSource(): Promise<DataSource> {
    const ds = new DataSource({
      type: "sqlite",
      database: ":memory:",
      entities: [Conversation, Message, Asset],
      synchronize: true,
    });
    await ds.initialize();
    return ds;
  }

  export async function seedTestData(ds: DataSource) {
    const convRepo = ds.getRepository(Conversation);
    const msgRepo = ds.getRepository(Message);
    const assetRepo = ds.getRepository(Asset);

    const conv1 = await convRepo.save({
      userId: "user-1",
      title: "Test Conversation 1",
      model: "gpt-4o-mini",
    });
    const conv2 = await convRepo.save({
      userId: "user-1",
      title: "Test Conversation 2",
    });

    await msgRepo.save({
      conversationId: conv1.id,
      userId: "user-1",
      role: "user",
      content: "Hello",
      status: "complete",
    });
    await msgRepo.save({
      conversationId: conv1.id,
      userId: "user-1",
      role: "assistant",
      content: "Hi there",
      status: "complete",
    });

    await assetRepo.save({
      userId: "user-1",
      conversationId: conv1.id,
      filename: "test.txt",
      mime: "text/plain",
      path: "/tmp/test.txt",
    });

    return { conv1, conv2 };
  }
  ```
  - [x] Uses `sqlite` + `:memory:` — zero external dependencies, instant, disposable
  - [x] `synchronize: true` auto-creates tables from entity metadata (no migrations needed for tests)
  - [x] `seedTestData` inserts 2 conversations, 2 messages, 1 asset — representative data for repository method tests
  - [x] Each test file calls `createTestDataSource()` in `beforeEach` and `ds.destroy()` in `afterEach` for isolation
- [x] Task 6: Create smoke test for `ConversationRepository` (AC: #5)
  - [x] Create `src/lib/db/repositories/conversation.repository.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import { DataSource } from "typeorm";
  import { createTestDataSource, seedTestData } from "../../../../tests/fixtures/test-datasource";

  describe("ConversationRepository (interface contract)", () => {
    let ds: DataSource;

    beforeEach(async () => {
      ds = await createTestDataSource();
    });

    afterEach(async () => {
      await ds.destroy();
    });

    it("should save and retrieve a conversation by id and userId", async () => {
      const { conv1 } = await seedTestData(ds);
      const repo = ds.getRepository("Conversation");

      const found = await repo.findOne({
        where: { id: conv1.id, userId: "user-1" },
      });
      expect(found).toBeDefined();
      expect(found!.title).toBe("Test Conversation 1");
      expect(found!.userId).toBe("user-1");
    });

    it("should return null for non-existent conversation", async () => {
      const repo = ds.getRepository("Conversation");
      const found = await repo.findOne({
        where: { id: "non-existent", userId: "user-1" },
      });
      expect(found).toBeNull();
    });

    it("should scope queries by userId (isolation)", async () => {
      await seedTestData(ds);
      const repo = ds.getRepository("Conversation");

      const user1Convs = await repo.find({ where: { userId: "user-1" } });
      const user2Convs = await repo.find({ where: { userId: "user-2" } });

      expect(user1Convs.length).toBe(2);
      expect(user2Convs.length).toBe(0);
    });
  });
  ```
  - [x] Tests demonstrate userId scoping (FR-2), save/find patterns, isolation between users
  - [x] Placeholder — when concrete `ConversationRepository` implementation lands in Story 3.1, refactor tests to test the concrete class methods instead of raw TypeORM repository
- [x] Task 7: Create smoke test for `MessageRepository` (AC: #5)
  - [x] Create `src/lib/db/repositories/message.repository.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import { DataSource } from "typeorm";
  import { createTestDataSource, seedTestData } from "../../../../tests/fixtures/test-datasource";

  describe("MessageRepository (interface contract)", () => {
    let ds: DataSource;

    beforeEach(async () => {
      ds = await createTestDataSource();
    });

    afterEach(async () => {
      await ds.destroy();
    });

    it("should save and find messages by conversationId", async () => {
      const { conv1 } = await seedTestData(ds);
      const repo = ds.getRepository("Message");

      const messages = await repo.find({
        where: { conversationId: conv1.id },
        order: { createdAt: "ASC" },
      });

      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe("user");
      expect(messages[1].role).toBe("assistant");
    });

    it("should update message status", async () => {
      const { conv1 } = await seedTestData(ds);
      const repo = ds.getRepository("Message");

      const msg = await repo.findOne({
        where: { conversationId: conv1.id, role: "user" },
      });
      expect(msg!.status).toBe("complete");

      await repo.update(msg!.id, { status: "stopped" });
      const updated = await repo.findOne({ where: { id: msg!.id } });
      expect(updated!.status).toBe("stopped");
    });

    it("should scope messages by userId", async () => {
      await seedTestData(ds);
      const repo = ds.getRepository("Message");

      const user1Msgs = await repo.find({ where: { userId: "user-1" } });
      const user2Msgs = await repo.find({ where: { userId: "user-2" } });

      expect(user1Msgs.length).toBe(2);
      expect(user2Msgs.length).toBe(0);
    });
  });
  ```
  - [x] Tests cover `findByConversation`, `save`, `updateStatus`, userId scoping (FR-2, FR-5, FR-6)
  - [x] Placeholder for Story 3.1 concrete `MessageRepository`
- [x] Task 8: Create smoke test for `AssetRepository` (AC: #5)
  - [x] Create `src/lib/db/repositories/asset.repository.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import { DataSource } from "typeorm";
  import { createTestDataSource, seedTestData } from "../../../../tests/fixtures/test-datasource";

  describe("AssetRepository (interface contract)", () => {
    let ds: DataSource;

    beforeEach(async () => {
      ds = await createTestDataSource();
    });

    afterEach(async () => {
      await ds.destroy();
    });

    it("should save and find an asset by id", async () => {
      const { conv1 } = await seedTestData(ds);
      const repo = ds.getRepository("Asset");

      const assets = await repo.find({
        where: { conversationId: conv1.id, userId: "user-1" },
      });

      expect(assets.length).toBe(1);
      expect(assets[0].filename).toBe("test.txt");
      expect(assets[0].mime).toBe("text/plain");
    });

    it("should delete an asset by id", async () => {
      const { conv1 } = await seedTestData(ds);
      const repo = ds.getRepository("Asset");

      const asset = await repo.findOne({
        where: { conversationId: conv1.id, userId: "user-1" },
      });
      await repo.delete(asset!.id);

      const found = await repo.findOne({ where: { id: asset!.id } });
      expect(found).toBeNull();
    });

    it("should scope assets by userId", async () => {
      await seedTestData(ds);
      const repo = ds.getRepository("Asset");

      const user1Assets = await repo.find({ where: { userId: "user-1" } });
      const user2Assets = await repo.find({ where: { userId: "user-2" } });

      expect(user1Assets.length).toBe(1);
      expect(user2Assets.length).toBe(0);
    });
  });
  ```
  - [x] Tests cover `findByConversation`, `save`, `delete`, userId scoping (FR-2, FR-12)
  - [x] Placeholder for Story 3.1 concrete `AssetRepository`
- [x] Task 9: Create smoke tests for services (AC: #5)
  - [x] Create `src/services/conversation.service.test.ts` — minimal test against the interface shape (placeholder until Story 3.2 implements `ConversationService`):
  ```ts
  import { describe, it, expect } from "vitest";

  describe("ConversationService (interface contract)", () => {
    it("should export the ConversationService interface type", async () => {
      // Smoke test: verify the interface file compiles and exports correctly.
      // Concrete implementation tests will land in Story 3.2.
      const mod = await import("./conversation.service");
      expect(mod).toBeDefined();
      expect(typeof mod).toBe("object");
    });
  });
  ```
  - [x] Create `src/services/message.service.test.ts` — same minimal pattern
  - [x] Create `src/services/chat.service.test.ts` — same minimal pattern
  - [x] Create `src/services/asset.service.test.ts` — same minimal pattern
  - [x] These are structural placeholders — they prove the test harness works and the file exists; they will be expanded with real behavior tests as Epic 3/4/5 implementations land
- [x] Task 10: Verify coverage gate works end-to-end (AC: #6, #8)
  - [x] Run `npm run test:coverage` locally
  - [x] Confirm Vitest prints coverage summary for `src/services` and `src/lib/db/repositories`
  - [x] Confirm the threshold check passes (or fails with a clear error message if below 80%)
  - [x] Verify `lcov` report is generated in `coverage/` directory
- [x] Task 11: Create CI workflow step (AC: #8)
  - [x] Create `.github/workflows/ci.yml` (or append to existing CI config) with at minimum:
  ```yaml
  name: CI

  on:
    push:
      branches: [main]
    pull_request:
      branches: [main]

  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: npm
        - run: npm ci
        - run: npm run lint
        - run: npm run test:coverage
        - run: npm run build
  ```
  - [x] `npm run test:coverage` exits non-zero if threshold is breached → CI job fails
  - [x] No Docker, no external services needed — unit tests are fully self-contained
  - [x] E2E tests (`e2e/*.spec.ts`) are a separate job gated by Story 2.6, not this story
- [x] Task 12: Add `tests/` to `.gitignore` coverage artifacts (AC: #10)
  - [x] Add `coverage/` to `.gitignore` (coverage reports are build artifacts, not source)
  - [x] Do NOT ignore `tests/` directory (it contains source fixtures)

## Dev Notes

**Scope discipline:** This is Epic 2 Story 2.5 — the testing infrastructure story. It delivers the Vitest harness, coverage configuration, shared mock fixtures, smoke tests, and CI gate. It does NOT implement concrete repository or service logic — those land in Epic 3 (Story 3.1 for repositories, Stories 3.2–3.7 for services) and Epic 4/5. The smoke tests in Tasks 6–9 are structural placeholders that verify compilation and basic TypeORM persistence; they will be expanded with real business-logic tests as implementations land.

**Why in-memory SQLite for repository tests:** The epics.md AC says "disposable Postgres (or in-memory TypeORM) instance" — in-memory SQLite is the pragmatic choice for unit tests because it requires zero infrastructure (no Docker, no Postgres), runs instantly, and tests the same TypeORM query-builder API. Repository implementations use TypeORM's `Repository<T>` methods (`find`, `findOne`, `save`, `update`, `delete`), which behave identically across SQLite and Postgres for the simple CRUD patterns used here (no Postgres-specific SQL like `JSONB` or `pg_trgm`). The Story 3.1 dev agent should run the same test suite against real Postgres as an integration test (in a separate `*.integration.test.ts` or as part of E2E), but the unit-level smoke tests here validate the repository contract shape without external deps. [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5 — "disposable Postgres (or in-memory TypeORM)"]

**Coverage target rationale (≥80% lines/branches/functions/statements):** NFR-7 is explicit: "Test coverage of services + repositories — >= 80%" [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory — NFR-7]. The `coverageThreshold` in `vitest.config.ts` enforces this on all four metrics for `src/services` and `src/lib/db/repositories` only — not for route handlers, UI, or integration modules. Coverage is measured against source files, excluding test files themselves and barrel re-exports. As Epic 3/4/5 implementations land and new test files are added, coverage will grow; the gate catches regressions.

**Mock pattern — implement the interface, not vitest.mock():** Each mock fixture implements the corresponding TypeScript interface (e.g. `MockAiProvider implements AiProvider`) and exposes setter methods (`onComplete`, `onStream`, `onEmbed`, `onSearch`, `onUpsert`, `onSearch`) so individual tests can configure return values. This is preferred over `vi.mock()` for integration-style tests because: (a) the mock conforms to the same type contract as the real implementation (compile-time safety), (b) tests can configure per-test behavior without module-level mocking globals, and (c) the mock is importable and reusable across test files. For cases where `vi.mock()` is needed (e.g. mocking a module-level singleton or an env var read), it should be used alongside the fixture, not instead of it.

**File placement — colocated tests per FR-29:** FR-29 mandates "colocated with code under test (services + repositories), e.g. `*.test.ts` next to each" [Source: _bmad-output/planning-artifacts/epics.md#FR-29]. Concretely:
- `src/services/chat.service.test.ts` next to `src/services/chat.service.ts`
- `src/services/conversation.service.test.ts` next to `src/services/conversation.service.ts`
- `src/services/message.service.test.ts` next to `src/services/message.service.ts`
- `src/services/asset.service.test.ts` next to `src/services/asset.service.ts`
- `src/lib/db/repositories/conversation.repository.test.ts` next to `conversation.repository.ts`
- `src/lib/db/repositories/message.repository.test.ts` next to `message.repository.ts`
- `src/lib/db/repositories/asset.repository.test.ts` next to `asset.repository.ts`

Shared fixtures live at `tests/fixtures/` (NOT colocated) because they are cross-cutting test infrastructure, not tied to a single source file. [Source: _bmad-output/planning-artifacts/01-package.md#§2.6 Tests — `tests/fixtures/` for shared mocks]

**Why `typecheck.enabled: false`:** The project already has `tsc` via `npm run build` (Next.js's TypeScript check) and the CI workflow runs `npm run build`. Enabling Vitest's typecheck would duplicate that check and slow down the test suite. Type errors in test files will be caught by `tsc` at build time.

**CI gate mechanics:** Vitest's `coverageThreshold` option causes `vitest run --coverage` to exit with code 1 when any threshold is breached. The CI step (`npm run test:coverage`) propagates this exit code, causing the GitHub Actions job to fail. No custom gate script is needed — Vitest handles it natively. The `json-summary` reporter also generates `coverage/coverage-summary.json` which can be consumed by PR comment bots or coverage tracking tools if desired later.

**Adding test files as Epics 3/4/5 land:** Each subsequent story that implements a concrete service or repository should add or expand tests in the colocated `*.test.ts` file. The smoke tests from Tasks 6–9 serve as a starting point — replace the import smoke test with real behavior tests against the concrete class. The coverage gate will track the growing coverage automatically.

**Entity type imports in test fixtures:** The `test-datasource.ts` fixture imports entity classes directly from `@/lib/db/entities/*.entity.ts` (Story 1.1). This creates a dependency from `tests/fixtures/` → `src/lib/db/entities/`, which is acceptable because entities are the lowest layer ("depends on nothing" per `01-package.md` §2.3) and test code is explicitly allowed to depend on source code per the project's test architecture. [Source: _bmad-output/planning-artifacts/01-package.md#§2.3 Data (TypeORM)]

**`@/` alias resolution in Vitest:** The `tsconfig.json` already defines `"@/*": ["./src/*"]` and `"@/tests/*"` would need an alias for `tests/` if referenced via `@/tests/fixtures/...`. The `vitest.config.ts` alias (`@/` → `./src/`) matches the tsconfig. Test files in `tests/fixtures/` that import from `src/` should use relative paths (e.g. `../../src/lib/db/entities/...`) or the `@/` alias (which resolves to `./src/`). The mock fixtures in `tests/fixtures/` use `@/` imports for `src/` types (e.g. `import type { AiProvider } from "@/lib/ai/langchain"`), which works because Vitest resolves the alias from the project root.

### Project Structure Notes

Files to create (matching `01-package.md` §2.6):
- `vitest.config.ts` (project root)
- `tests/fixtures/mock-ai-provider.ts`
- `tests/fixtures/mock-qdrant-store.ts`
- `tests/fixtures/mock-redis-cache.ts`
- `tests/fixtures/mock-jina-provider.ts`
- `tests/fixtures/mock-auth-session.ts`
- `tests/fixtures/test-datasource.ts`
- `tests/fixtures/index.ts`
- `src/lib/db/repositories/conversation.repository.test.ts`
- `src/lib/db/repositories/message.repository.test.ts`
- `src/lib/db/repositories/asset.repository.test.ts`
- `src/services/conversation.service.test.ts`
- `src/services/message.service.test.ts`
- `src/services/chat.service.test.ts`
- `src/services/asset.service.test.ts`
- `.github/workflows/ci.yml` (new or appended)

Files to modify:
- `package.json` — add `vitest`, `@vitest/coverage-v8` devDeps; add `test`, `test:watch`, `test:coverage` scripts
- `.gitignore` — add `coverage/`

Files NOT modified:
- All existing `src/` source files (no changes to entity, repository, service, or integration module files)
- `tsconfig.json` (no changes needed — Vitest reads the existing `@/` alias)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5] — Story text, AC (Given/When/Then), FR-29/FR-30/FR-31/NFR-7/NFR-8 tags
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory — NFR-7] — "Test coverage of services + repositories — >= 80%"
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory — NFR-8] — "Unit tests deterministic & offline (externals mocked: OpenAI, Qdrant, Jina, Clerk) via Vitest"
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory — FR-29] — "Unit tests use Vitest, colocated with code under test"
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory — FR-30] — "External deps mocked in unit tests — OpenAI/LangChain, Qdrant, Jina, Clerk"
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory — FR-31] — "Coverage gate enforces ≥80% coverage of services + repositories; fails below threshold"
- [Source: _bmad-output/planning-artifacts/01-package.md#§2.6 Tests] — `src/**/*.test.ts`, `tests/fixtures/`, `e2e/*.spec.ts`
- [Source: _bmad-output/planning-artifacts/01-package.md#1. File Tree (authoritative)] — test directory structure
- [Source: _bmad-output/planning-artifacts/05-architecture.md] — Vitest unit tests + mocked externals, ≥80% coverage
- [Source: _bmad-output/planning-artifacts/02-class.md] — MockJinaProvider, MockQdrantStore, MockAiProvider referenced in class diagram
- [Source: _bmad-output/planning-artifacts/07-entity.md] — Entity shapes used in seed data
- [Source: _bmad-output/implementation-artifacts/1-1-entity-type-typeorm-decorator-definitions.md] — Entity file paths, decorator patterns
- [Source: _bmad-output/implementation-artifacts/1-2-repository-service-interface-definitions.md] — Repository/service interface shapes
- [Source: _bmad-output/implementation-artifacts/1-3-integration-module-interface-contracts.md] — AiProvider, QdrantStore, RedisCache, WebSearchProvider, Session interfaces
- [Source: _bmad-output/implementation-artifacts/1-4-zod-validation-schemas-shared-app-types.md] — ChatRequest/ChatResponse types

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Adversarial Review

**Reviewer:** opencode agent
**Date:** 2026-07-20
**Scope:** All changes since baseline `0169a4c`

### Layer 1 — Blind Hunter (Bugs & Logic Errors)

**PASS** — No bugs, runtime errors, or logic defects found. All 13 tests pass. Mock fixtures correctly implement their interfaces. TypeORM in-memory SQLite isolation is correct (each test gets a fresh `DataSource` via `beforeEach`/`afterEach`). Coverage config syntax is valid.

### Layer 2 — Edge Case Hunter (Boundaries & Unhandled Paths)

| # | Finding | Severity | Detail |
|---|---------|----------|--------|
| E1 | Coverage gate is a no-op (reports 100% of 0/0) | **HIGH** | All 7 source files under `src/services/` and `src/lib/db/repositories/` export only TypeScript interfaces (erased at compile time). V8 coverage measures ZERO executable statements across both directories. The `coverageThreshold: { lines: 80, ... }` passes vacuously. When Epic 3/4/5 adds runtime code, coverage will drop sharply — the gate will fail CI unless tests are added simultaneously. |
| E2 | CI workflow file is untracked (`.github/workflows/ci.yml`) | **HIGH** | `git status` shows `?? .github/` — the CI workflow is invisible to GitHub Actions. Merges will not trigger the coverage gate. Must be `git add`-ed and committed. |
| E3 | `package-lock.json` not staged | **MEDIUM** | `npm ci` in CI requires lock file matching `package.json`. The lock file has been modified (vitest deps added) but is not staged. CI will fail on `npm ci` or silently use a stale lock. |
| E4 | Service smoke tests cannot fail for empty modules | **MEDIUM** | `expect(typeof mod).toBe("object")` passes for `{}` — the exact runtime shape of an interface-only file. These tests only validate that the file path resolves at import time. Spec acknowledges these are placeholders, but they provide no behavioral coverage and would pass even if a service file was completely broken (as long as it still resolved). |
| E5 | No test imports the repository `.ts` files | **MEDIUM** | Repository test files use `ds.getRepository("Conversation")` (TypeORM string resolution) — they never import the actual `conversation.repository.ts` file. If that file had a syntax error or broken import, the tests would still pass. Only the service files are loaded via `await import()`. |
| E6 | Spec code block for MockAuthSession referenced `Session` type | **LOW** | `Session` type no longer exists (Story 2.3 rewrote `session.ts`). Spec block was stale — **fixed** during review to use `AuthSession`. Implementation was already correct. |

### Layer 3 — Acceptance Auditor

| AC | Status | Notes |
|----|--------|-------|
| AC #1 (Vitest + config with coverage reporter) | ✅ | Config created at root, coverage include/exclude correct |
| AC #2 (Colocated `*.test.ts` files) | ✅ | 7 test files, all named `*.test.ts`, all colocated |
| AC #3 (Shared mocks for 5 integrations) | ✅ | 5 fixture files + barrel index. MockAuthSession adapted for `AuthSession` (not old `Session`) |
| AC #4 (In-memory SQLite, beforeEach/afterEach, seed data) | ✅ | `test-datasource.ts` with `type: "sqlite"`, `:memory:`, `synchronize: true`, 2 conversations + 2 messages + 1 asset |
| AC #5 (1 test per repo × 3, 1 test per service × 4) | ✅ | 7 test files exist |
| AC #6 (coverageThreshold ≥80% branches/functions/lines/statements) | ⚠️ | Config is correct. **Vacuously passing** — 0/0 statements measured (see E1 above). Will enforce when runtime code exists. |
| AC #7 (npm scripts: test, test:watch, test:coverage) | ✅ | All 3 scripts present in `package.json` |
| AC #8 (CI step runs test:coverage, fails on breach) | ⚠️ | `.github/workflows/ci.yml` is correct but **untracked** (see E2). Will not execute in CI until committed. |
| AC #9 (Offline/deterministic — no network, no Docker) | ✅ | SQLite `:memory:`, no network imports in tests, all mocks self-contained |
| AC #10 (tests/ directory structure) | ✅ | `tests/fixtures/` exists with 6 files. `tests/unit/` does not exist per spec ("optional overflow location") |

### Acceptance Summary

- **7/10** ACs fully satisfied
- **AC #6** — coverage threshold is configured correctly but does not measure any real code (expect when runtime code lands)
- **AC #8** — CI workflow syntax is correct but the file is not tracked by git

### Fixes Applied

- **E6 (stale spec):** Updated Task 4 MockAuthSession code block from `Session` → `AuthSession`, matching the actual implementation.

### Mitigation Notes

- **E1 (coverage 0/0):** Expected for this phase. When Epic 3/4/5 adds runtime code, the gate activates. Test writers should add tests in lockstep with implementations.
- **E2/E3 (CI/git):** Resolve by running `git add .github/workflows/ci.yml package-lock.json` before committing.
- **E4/E5 (test isolation):** Service tests cannot be strengthened until service files export runtime values. Repository tests can be improved in Story 3.1 by importing the actual repository classes.
- **E6 (spec staleness):** Fixed during review — Task 4 MockAuthSession code block updated from `Session` → `AuthSession`.

### Recommendations

1. Before closing this story, commit CI workflow + lock file so the gate is active.
2. Document in a dev note that `coverageThreshold` reports 0/0 until Epic 3/4/5 adds runtime code.
3. When Story 3.1 implements repository classes, update repository tests to import the concrete class (not just `ds.getRepository()`).
