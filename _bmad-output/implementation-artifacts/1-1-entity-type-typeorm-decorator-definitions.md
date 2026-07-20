# Story 1.1: Entity Type & TypeORM Decorator Definitions

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Maintainer,
I want the v2 entity class definitions with their field shapes and decorators,
so that every later epic programs against a fixed data model.

## Acceptance Criteria

1. `Conversation` entity class is declared with TypeORM decorators defining fields: `id` (uuid, PK), `userId` (string), `rootConversationId` (string, optional/nullable), `lastMessageId` (string, optional/nullable), `title` (string), `model` (string, optional/nullable), `createdAt` (Date), `updatedAt` (Date). [FR-4]
2. `Message` entity class is declared with TypeORM decorators defining fields: `id` (uuid, PK), `conversationId` (uuid), `userId` (string), `parentId` (uuid, optional/nullable), `role` (`"user" | "assistant" | "system"`), `content` (text), `model` (string, optional/nullable), `status` (`MessageStatus` union), `createdAt` (Date). [FR-5]
3. `Asset` entity class is declared with TypeORM decorators defining fields: `id` (uuid, PK), `userId` (string), `conversationId` (uuid), `filename` (string), `mime` (string), `path` (string), `createdAt` (Date). [FR-12]
4. A `MessageStatus` string union type is defined as `"processing" | "complete" | "stopped"` and used as the type of `Message.status`. [FR-5]
5. Entity classes contain ONLY field declarations and TypeORM decorators (no service/business logic, no repository methods) — this epic defines contracts only; behavior is implemented in Epic 3. [Epic 1 scope rule]
6. Entity files are placed at `src/lib/db/entities/conversation.entity.ts`, `src/lib/db/entities/message.entity.ts`, `src/lib/db/entities/asset.entity.ts`, matching the authoritative file tree. [01-package.md]

## Tasks / Subtasks

- [ ] Task 1: Create `src/lib/db/entities/conversation.entity.ts` (AC: #1, #5, #6)
  - [ ] Declare `@Entity()` class `Conversation` with `@PrimaryGeneratedColumn("uuid") id: string`
  - [ ] Add `@Column() userId: string`
  - [ ] Add `@Column({ nullable: true }) rootConversationId?: string`
  - [ ] Add `@Column({ nullable: true }) lastMessageId?: string`
  - [ ] Add `@Column() title: string`
  - [ ] Add `@Column({ nullable: true }) model?: string`
  - [ ] Add `@CreateDateColumn() createdAt: Date`
  - [ ] Add `@UpdateDateColumn() updatedAt: Date`
  - [ ] No methods, no repository/service logic in this file
- [ ] Task 2: Create `src/lib/db/entities/message.entity.ts` (AC: #2, #4, #5, #6)
  - [ ] Declare `@Entity()` class `Message` with `@PrimaryGeneratedColumn("uuid") id: string`
  - [ ] Add `@Column() conversationId: string`
  - [ ] Add `@Column() userId: string`
  - [ ] Add `@Column({ nullable: true }) parentId?: string`
  - [ ] Add `@Column({ type: "varchar" }) role: "user" | "assistant" | "system"`
  - [ ] Add `@Column({ type: "text" }) content: string`
  - [ ] Add `@Column({ nullable: true }) model?: string`
  - [ ] Add `@Column({ type: "varchar" }) status: MessageStatus`
  - [ ] Add `@CreateDateColumn() createdAt: Date`
  - [ ] No methods, no repository/service logic in this file
- [ ] Task 3: Create `src/lib/db/entities/asset.entity.ts` (AC: #3, #5, #6)
  - [ ] Declare `@Entity()` class `Asset` with `@PrimaryGeneratedColumn("uuid") id: string`
  - [ ] Add `@Column() userId: string`
  - [ ] Add `@Column() conversationId: string`
  - [ ] Add `@Column() filename: string`
  - [ ] Add `@Column() mime: string`
  - [ ] Add `@Column() path: string`
  - [ ] Add `@CreateDateColumn() createdAt: Date`
  - [ ] No methods, no repository/service logic in this file
- [ ] Task 4: Define the `MessageStatus` union type (AC: #4)
  - [ ] Define `export type MessageStatus = "processing" | "complete" | "stopped";` colocated in `message.entity.ts` (or a shared location if a `types/` convention emerges later — colocate for now since no other consumer exists yet in Epic 1)
  - [ ] Reference `MessageStatus` as the type for `Message.status`
- [ ] Task 5: Verify directory structure matches architecture (AC: #6)
  - [ ] Confirm/create `src/lib/db/entities/` directory (do not create `repositories/`, `migrations/`, or `data-source.ts` — those belong to later stories: 3.1 for repositories, 2.2 for DataSource/migrations)
  - [ ] Do not wire entities into a DataSource or migration in this story — that is Story 2.2/3.1 scope

## Dev Notes

**Scope discipline (critical):** This is Epic 1 — Types & Contracts. "No behavior is implemented here — only the shapes and signatures that downstream logic conforms to" [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Types & Contracts]. Do NOT implement repository classes, services, or a TypeORM DataSource in this story — those are Story 1.2 (repository/service interfaces), Story 2.2 (Postgres DataSource + migrations), and Story 3.1 (concrete repositories) respectively. This story delivers ONLY the three entity classes + the status union type.

**Exact field shapes** (authoritative — do not add or omit fields):
- `Conversation`: `id`, `userId`, `rootConversationId?`, `lastMessageId?`, `title`, `model?`, `createdAt`, `updatedAt` [Source: _bmad-output/planning-artifacts/07-entity.md#Entity as Class (domain model)] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1]
- `Message`: `id`, `conversationId`, `userId`, `parentId?`, `role`, `content`, `model?`, `status`, `createdAt` [Source: _bmad-output/planning-artifacts/07-entity.md] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1]
- `Asset`: `id`, `userId`, `conversationId`, `filename`, `mime`, `path`, `createdAt` [Source: _bmad-output/planning-artifacts/07-entity.md] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1]
- `role` is `"user" | "assistant" | "system"` (the `Role` type/enum) [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — `Role` enumeration]
- `status` is `"processing" | "complete" | "stopped"` (the `MessageStatus` union) [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] [Source: _bmad-output/planning-artifacts/02-class.md — `MessageStatus` enumeration]

**TypeORM decorator pattern** (Postgres target, per architecture): entities are declared with standard TypeORM decorators — `@Entity()`, `@PrimaryGeneratedColumn("uuid")` for `id` fields (all entity PKs are `uuid` per the ER diagram, except no natural-key entities appear here), `@Column()` for plain fields, `@Column({ nullable: true })` for optional (`?`) fields, `@CreateDateColumn()` for `createdAt`, and `@UpdateDateColumn()` for `updatedAt` (only `Conversation` has `updatedAt`; `Message` and `Asset` only have `createdAt`) [Source: _bmad-output/planning-artifacts/07-entity.md#erDiagram — field types `uuid`, `string`, `text`, `datetime`]. `Message.content` is `text` type (not varchar) per the ER diagram [Source: _bmad-output/planning-artifacts/07-entity.md].

**Architecture / layering rule:** `src/lib/db` (entities + repositories + migrations) "Depends on: nothing (pure persistence)" [Source: _bmad-output/planning-artifacts/01-package.md#2.3 Data (TypeORM)]. Entities must not import from `services/`, `app/`, or any integration module. Dependency direction across the whole system is `app → services → {repositories | ai | vector | websearch | cache}` [Source: _bmad-output/planning-artifacts/05-architecture.md] [Source: _bmad-output/planning-artifacts/01-package.md#3. Dependency Rule] — entities sit below repositories and have zero outward dependencies.

**No port/adapter abstraction:** Direct coupling to TypeORM decorators on the entity classes is the approved, intentional design — "Next.js and TypeORM are used directly throughout — there is no port/adapter abstraction layer to decouple them" [Source: _bmad-output/planning-artifacts/01-package.md#3. Dependency Rule].

**Persistence target:** Postgres (not SQLite) — this is the v2 model; the legacy SQLite `Conversation`/`Message` entities are NOT reused ("Migrate TypeORM from SQLite to Postgres; fresh start, clean existing SQLite data" — but note DataSource/migration wiring is Story 2.2, out of scope here) [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory — Additional Requirements] [Source: _bmad-output/planning-artifacts/epics.md#Epic 2 — Existing repo note].

**Related FRs satisfied by this story's shapes (contracts only, not enforcement):** FR-4 (`Conversation` gains `userId`, `rootConversationId`, `lastMessageId`, `model`), FR-5 (`Message` gains `userId`, `parentId`, `status` enum), FR-12 (`Asset` fields `userId`, `conversationId`, `filename`, `mime`, `path`) [Source: _bmad-output/planning-artifacts/04-requirements.md — inline in epics.md Requirements Inventory: FR-4, FR-5, FR-12]. Actual `userId`-scoping enforcement on queries happens in repositories (Story 1.2 interfaces, Story 3.1 implementation), not in this story.

**No testing requirement for this story:** Epic 1 defines shapes/contracts only; no business logic exists yet to unit test. The testing foundation (Vitest, coverage gate) is Story 2.5. Do not add test files for these entity classes in this story unless verifying the file compiles/imports correctly.

### Project Structure Notes

- Files to create, exactly matching the authoritative file tree: `src/lib/db/entities/conversation.entity.ts`, `src/lib/db/entities/message.entity.ts`, `src/lib/db/entities/asset.entity.ts` [Source: _bmad-output/planning-artifacts/01-package.md#1. File Tree (authoritative)].
- Do NOT create `src/lib/db/repositories/`, `src/lib/db/migrations/`, or `src/lib/db/data-source.ts` in this story — those belong to Stories 1.2, 2.2, and 3.1.
- **Conflict flag:** `_bmad-output/project-context.md` describes a Next.js 16 / React 19 / Tailwind / shadcn-ui / TanStack Query **frontend-only** stack and does not mention TypeORM, Postgres, or a `src/lib/db` layer at all. This story (and Epic 1 generally) is backend persistence-contract work per `01-package.md` and `05-architecture.md`, which are the authoritative sources for backend structure — `project-context.md` is silent on backend/TypeORM concerns rather than contradicting them, but it should be treated as incomplete for backend work, not authoritative. Follow `01-package.md`/`05-architecture.md`/`07-entity.md` for all entity/persistence decisions in this story.
- No UI, route handler, or service code is touched by this story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] — Story text, AC (Given/When/Then), FR-4/FR-5/FR-12 tags
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Types & Contracts] — Epic scope: contracts only, no logic
- [Source: _bmad-output/planning-artifacts/07-entity.md] — ER diagram field types, domain class diagram field shapes
- [Source: _bmad-output/planning-artifacts/02-class.md#B) Entities & Types] — `Role`, `MessageStatus` enumerations, entity field shapes cross-check
- [Source: _bmad-output/planning-artifacts/01-package.md#1. File Tree (authoritative)] — exact entity file paths
- [Source: _bmad-output/planning-artifacts/01-package.md#2.3 Data (TypeORM) — src/lib/db] — "Depends on: nothing (pure persistence)"
- [Source: _bmad-output/planning-artifacts/01-package.md#3. Dependency Rule] — no port/adapter abstraction, dependency direction
- [Source: _bmad-output/planning-artifacts/05-architecture.md] — layered architecture diagram, TypeORM entities in `src/lib/db`
- [Source: _bmad-output/planning-artifacts/04-requirements.md] (referenced inline via epics.md Requirements Inventory) — FR-4, FR-5, FR-12 text
- [Source: _bmad-output/project-context.md] — frontend stack facts; flagged as non-authoritative/incomplete for this backend story

## Dev Agent Record

### Agent Model Used

TBD (populated by dev agent)

### Debug Log References

### Completion Notes List

### File List
