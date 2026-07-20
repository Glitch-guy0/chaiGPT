# Story 2.2: Postgres DataSource & Reversible Migrations

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Maintainer,
I want a Postgres DataSource and reversible TypeORM migrations,
so that schema evolves safely on an externalized store.

## Acceptance Criteria

1. A new Postgres `DataSource` replaces the existing SQLite `DataSource` at `src/lib/db/index.ts`, configured with host/port/db/user/password from environment variables. [NFR-2, NFR-6]
2. TypeORM CLI is configured to run migrations against Postgres via `ts-node` (or `tsx`), with entity paths, migration paths, and migration runner all pointing at the correct compiled locations. [NFR-6]
3. An initial reversible migration is created at `src/lib/db/migrations/<timestamp>-InitialSchema.ts` that creates all three v2 tables (`conversations`, `messages`, `assets`) with the exact columns, types, and constraints derived from the E1 entity definitions — and includes a working `down()` method. [AC from epics: "reversible (down migration exists)"]
4. The legacy SQLite database file (`chaiGPT.db`) is deleted and any references to SQLite are removed (including `better-sqlite3` / `sqlite3` from `package.json` dependencies and `next.config.ts` `serverExternalPackages`). [NFR-6: "SQLite is retired and existing local SQLite data is cleared for a fresh start"]
5. `npm run migration:run` applies the migration against Postgres and `npm run migration:revert` rolls it back successfully. [NFR-6]
6. Environment variables are documented in a `.env.example` file so the developer knows what to set. [FR-21]

## Tasks / Subtasks

- [x] Task 1: Install pg driver and remove SQLite deps (AC: #1, #4)
  - [x] Run `npm install pg @types/pg`
  - [x] Run `npm uninstall better-sqlite3 @types/better-sqlite3 sqlite3`
  - [x] Remove `"better-sqlite3"` from `next.config.ts` `serverExternalPackages`
  - [x] Delete `chaiGPT.db` if it exists (`rm -f chaiGPT.db`)

- [x] Task 2: Create `.env.example` with Postgres connection vars (AC: #6)
  - [x] Create `.env.example` at project root with:
    ```
    DB_HOST=localhost
    DB_PORT=5432
    DB_NAME=chaigpt
    DB_USER=chaigpt
    DB_PASSWORD=chaigpt
    ```
  - [x] Create/update `.env` with the same values for local dev (confirm `start:dev:infra` from Story 2.1 uses matching defaults)

- [x] Task 3: Rewrite `src/lib/db/index.ts` — Postgres DataSource (AC: #1)
  - [x] Replace `type: "sqlite"` with `type: "postgres"`
  - [x] Read connection params from `process.env`: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - [x] Set `synchronize: false` (migrations own schema, not auto-sync)
  - [x] Set `logging: false`
  - [x] Point `entities` to `["src/lib/db/entities/*.entity.ts"]` (glob path for TypeORM CLI resolution)
  - [x] Point `migrations` to `["src/lib/db/migrations/*.ts"]`
  - [x] Add `cli.migrationsDir: "src/lib/db/migrations"`
  - [x] Export the `AppDataSource` as default and as named export (preserving existing `initializeDatabase` and `getDatabase` helpers)
  - [x] Keep the existing barrel exports from `src/lib/db/entities/index.ts` unchanged

- [x] Task 4: Generate initial migration (AC: #3)
  - [x] Create `src/lib/db/migrations/` directory if it doesn't exist
  - [x] Create `src/lib/db/migrations/<timestamp>-InitialSchema.ts` with:
    - Class name: `InitialSchema`
    - `up(queryRunner)`: creates three tables via raw SQL
    - `down(queryRunner)`: drops all three tables in reverse dependency order
  - [x] See "Migration SQL" section below for the exact SQL

- [x] Task 5: Configure TypeORM CLI (AC: #2)
  - [x] Create `ormconfig.ts` at project root (or configure CLI via `package.json` scripts) pointing TypeORM CLI at the Postgres DataSource
  - [x] Alternatively, use `ts-node` directly with `typeorm-ts-node-commonjs` compiler option — the recommended approach for TS projects
  - [x] Add npm scripts to `package.json`:
    ```json
    "migration:run": "typeorm-ts-node-commonjs migration:run -d src/lib/db/index.ts",
    "migration:revert": "typeorm-ts-node-commonjs migration:revert -d src/lib/db/index.ts",
    "migration:generate": "typeorm-ts-node-commonjs migration:generate src/lib/db/migrations/<name> -d src/lib/db/index.ts"
    ```
  - [x] Ensure `tsconfig.json` has `"module": "commonjs"` override or `ts-node` config for TypeORM CLI compatibility (add `ts-node` section to `tsconfig.json` if needed)

- [ ] Task 6: Verify migration up and down (AC: #5)
  - [ ] Start Postgres: `npm run start:dev:infra` (or `docker compose up -d` from `infra/`)
  - [ ] Run `npm run migration:run` — verify tables are created
  - [ ] Run `npm run migration:revert` — verify tables are dropped
  - [ ] Run `npm run migration:run` again — verify re-apply succeeds (idempotent check)

## Dev Notes

### Current State (what exists today)

The existing `src/lib/db/index.ts` configures a **SQLite** DataSource:

```typescript
// CURRENT — will be REPLACED
import { DataSource } from "typeorm"
import { Conversation } from "./entities/conversation.entity"
import { Message } from "./entities/message.entity"

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: "./chaiGPT.db",
  synchronize: true,   // ← DANGEROUS: auto-syncs schema
  logging: false,
  entities: [Conversation, Message],  // ← Missing Asset!
  migrations: [],
})
```

Key problems this story fixes:
- `synchronize: true` — replaced by migration-driven schema (NFR-6)
- SQLite — replaced by Postgres (NFR-2, brief #4)
- Missing `Asset` entity in the DataSource — all 3 entities will be included
- No migrations directory — created with initial reversible migration
- `better-sqlite3` in `next.config.ts` `serverExternalPackages` — removed

### Postgres Connection Defaults

Story 2.1 (`infra/docker-compose.yml`) defines Postgres with these defaults:

| Variable    | Default   |
|-------------|-----------|
| DB_HOST     | localhost |
| DB_PORT     | 5432      |
| DB_NAME     | chaigpt   |
| DB_USER     | chaigpt   |
| DB_PASSWORD | chaigpt   |

The `.env` values MUST match the Docker Compose Postgres service config. If Story 2.1 used different env var names, align to those.

### Entity Definitions (E1 — source of truth for migration SQL)

**Conversation** (`conversations` table):
| Column              | Type                     | Nullable | Notes                          |
|---------------------|--------------------------|----------|--------------------------------|
| id                  | uuid (PK, auto-gen)      | no       | PrimaryGeneratedColumn('uuid') |
| userId              | varchar                  | no       |                                |
| rootConversationId  | varchar                  | yes      |                                |
| lastMessageId       | varchar                  | yes      |                                |
| title               | varchar                  | no       |                                |
| model               | varchar                  | yes      |                                |
| createdAt           | timestamptz              | no       | CreateDateColumn (default NOW) |
| updatedAt           | timestamptz              | no       | UpdateDateColumn (default NOW) |

**Message** (`messages` table):
| Column         | Type                     | Nullable | Notes                          |
|----------------|--------------------------|----------|--------------------------------|
| id             | uuid (PK, auto-gen)      | no       | PrimaryGeneratedColumn('uuid') |
| conversationId | uuid                     | no       |                                |
| userId         | varchar                  | no       |                                |
| parentId       | uuid                     | yes      |                                |
| role           | varchar                  | no       |                                |
| content        | text                     | no       |                                |
| model          | varchar                  | yes      |                                |
| status         | varchar                  | no       |                                |
| createdAt      | timestamptz              | no       | CreateDateColumn (default NOW) |

**Asset** (`assets` table):
| Column         | Type                     | Nullable | Notes                          |
|----------------|--------------------------|----------|--------------------------------|
| id             | uuid (PK, auto-gen)      | no       | PrimaryGeneratedColumn('uuid') |
| userId         | varchar                  | no       |                                |
| conversationId | uuid                     | no       |                                |
| filename       | varchar                  | no       |                                |
| mime           | varchar                  | no       |                                |
| path           | varchar                  | no       |                                |
| createdAt      | timestamptz              | no       | CreateDateColumn (default NOW) |

### Migration SQL (reference for Task 4)

The `up()` migration must execute this SQL against Postgres:

```sql
CREATE TABLE "conversations" (
  "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
  "userId"           character varying NOT NULL,
  "rootConversationId" character varying,
  "lastMessageId"    character varying,
  "title"            character varying NOT NULL,
  "model"            character varying,
  "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_conversations" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
  "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
  "conversationId" uuid NOT NULL,
  "userId"         character varying NOT NULL,
  "parentId"       uuid,
  "role"           character varying NOT NULL,
  "content"        text NOT NULL,
  "model"          character varying,
  "status"         character varying NOT NULL,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_messages" PRIMARY KEY ("id")
);

CREATE TABLE "assets" (
  "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
  "userId"         character varying NOT NULL,
  "conversationId" uuid NOT NULL,
  "filename"       character varying NOT NULL,
  "mime"           character varying NOT NULL,
  "path"           character varying NOT NULL,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_assets" PRIMARY KEY ("id")
);
```

**IMPORTANT:** Postgres does NOT ship with `uuid_generate_v4()` by default. Two options:

**Option A — Use gen_random_uuid() (recommended, Postgres 13+):**
```sql
DEFAULT gen_random_uuid()
```
This requires no extension. Change `uuid_generate_v4()` → `gen_random_uuid()` in the SQL above. This is the simplest approach and avoids needing `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.

**Option B — Use uuid-ossp extension:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- ... then use uuid_generate_v4()
```

Use Option A unless there's a specific reason for Option B. The entity decorators (`PrimaryGeneratedColumn('uuid')`) work with both — TypeORM's Postgres driver handles the UUID generation at the database level.

The `down()` migration must execute (in dependency order):
```sql
DROP TABLE IF EXISTS "assets";
DROP TABLE IF EXISTS "messages";
DROP TABLE IF EXISTS "conversations";
```

### TypeORM CLI with TypeScript

TypeORM CLI runs outside Next.js and needs `ts-node` to execute `.ts` migration files. Key config:

**tsconfig.json additions** (add a `ts-node` section):
```json
{
  "ts-node": {
    "compilerOptions": {
      "module": "commonjs"
    }
  }
}
```

**Alternative:** Use `typeorm-ts-node-commonjs` binary directly in npm scripts (no tsconfig change needed):
```json
"migration:run": "typeorm-ts-node-commonjs migration:run -d src/lib/db/index.ts"
```

This is the recommended approach — it avoids polluting the main tsconfig with `commonjs` overrides that could affect the Next.js build.

### Files Modified

| File | Action | Notes |
|------|--------|-------|
| `src/lib/db/index.ts` | **REPLACE** | Swap SQLite DataSource for Postgres DataSource |
| `next.config.ts` | **EDIT** | Remove `serverExternalPackages: ["better-sqlite3"]` (line 4) |
| `package.json` | **EDIT** | Add `pg`, `@types/pg`, add migration scripts; remove `better-sqlite3`, `sqlite3`, `@types/better-sqlite3` |
| `src/lib/db/migrations/<ts>-InitialSchema.ts` | **CREATE** | New file — initial reversible migration |
| `.env.example` | **CREATE** | Document DB env vars |
| `.env` | **CREATE** (if absent) | Local dev DB connection vars |
| `chaiGPT.db` | **DELETE** | Legacy SQLite data file |

### Files NOT Modified (must not break)

| File | Reason |
|------|--------|
| `src/lib/db/entities/*.entity.ts` | E1 deliverable — no changes needed |
| `src/lib/db/entities/index.ts` | Barrel export — no changes needed |
| `src/lib/db/repositories/*.repository.ts` | Interface contracts — no changes needed |
| `src/types/**` | Type contracts — no changes needed |

### Project Structure Notes

- Migrations go in `src/lib/db/migrations/` per the architecture doc's `data.migrations` path
- DataSource stays at `src/lib/db/index.ts` — this is the single source of truth for the DB connection
- Entity files remain untouched; they define the schema contract
- TypeORM CLI resolves entity/migration paths via the DataSource config, not `ormconfig.json`

### Testing Notes

- This story's verification is manual: run migration up, check tables exist, run migration down, check tables gone
- Automated test coverage for migrations is deferred to Story 2.5 (Vitest foundation) or Story 2.6 (E2E)
- Do NOT add a unit test for the migration in this story — keep scope focused

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2] — Story requirements and acceptance criteria
- [Source: _bmad-output/planning-artifacts/epics.md#NFR-6] — "DB migrations are reversible (TypeORM) — Required for prod"
- [Source: _bmad-output/planning-artifacts/05-architecture.md#data] — DataSource (Postgres) in architecture diagram
- [Source: src/lib/db/index.ts] — Current SQLite DataSource to be replaced
- [Source: src/lib/db/entities/*.entity.ts] — E1 entity definitions (source of truth for migration columns)
- [Source: next.config.ts:4] — `serverExternalPackages: ["better-sqlite3"]` to be removed
- [Source: package.json] — Current deps include `better-sqlite3`, `sqlite3`, `typeorm ^0.3.21`

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Senior Developer Review (AI)

**Review date:** 2026-07-20
**Reviewer:** opencode (adversarial code review)
**Verdict:** Changes Requested → Approved (fixes applied)

### Findings

| # | Severity | File | Issue | Status |
|---|----------|------|-------|--------|
| 1 | MEDIUM | `src/lib/db/index.ts:3-5` | Unused entity imports — dead code, entities loaded via glob strings | ✅ Fixed (removed) |
| 2 | MEDIUM | `src/lib/db/index.ts:18-20` | Deprecated `cli.migrationsDir` on DataSourceOptions (TypeORM 0.3.x) | ✅ Fixed (removed) |
| 3 | MEDIUM | `next.config.ts:4` | `output: "standalone"` added — belongs to Story 2.1, not 2.2 | ✅ Clarified (Story 2.1 fix, out of scope) |
| 4 | LOW | `.env.example` vs `.env` | `DATABASE_URL` in `.env` but missing from `.env.example` | ✅ Fixed (added) |
| 5 | LOW | `src/lib/db/index.ts` | No SSL/pool config for production Postgres | ⏳ Deferred (tech debt) |
| 6 | LOW | `package.json` | `migration:generate` uses `MigrationName` placeholder | ⏳ Acceptable |

### Action Items

- [x] Remove unused entity imports from `src/lib/db/index.ts`
- [x] Remove deprecated `cli` property from DataSource config
- [x] Add `DATABASE_URL` to `.env.example`
- [ ] Task 6: Run `migration:run` and `migration:revert` against Postgres to verify AC#5
- [ ] Consider adding SSL/pool config for production (tech debt)

### Migration SQL Verification

Column-by-column match against E1 entity definitions:
- **conversations:** 8 columns ✅ (id, userId, rootConversationId, lastMessageId, title, model, createdAt, updatedAt)
- **messages:** 9 columns ✅ (id, conversationId, userId, parentId, role, content, model, status, createdAt)
- **assets:** 7 columns ✅ (id, userId, conversationId, filename, mime, path, createdAt)
- **UUID generation:** `gen_random_uuid()` (Option A — Postgres 13+) ✅
- **Down migration:** Drops in reverse dependency order with `IF EXISTS` ✅
- **Nullable constraints:** Match entity `nullable: true` decorators ✅
- **Type mappings:** `varchar` ↔ `character varying`, `text`, `uuid`, `TIMESTAMP` ✅
