# Story 3.1: Concrete Entities & TypeORM Repositories

Status: ready-for-dev

## Story

As a Maintainer,
I want the concrete TypeORM entities and repositories implemented against the E1 contracts,
So that conversations, messages, and assets are correctly persisted and user-scoped.

## Acceptance Criteria

1. `ConversationRepository`, `MessageRepository`, and `AssetRepository` implement the E1 repository interfaces (defined in Story 1.2 / `02-class.md`) and enforce `userId` scoping on every query so that no user can read or mutate another user's rows (FR-2).

2. `AssetRepository` implements `save`, `findByConversation`, and `delete` operations such that every operation is scoped to `userId` and `Asset` rows carry `userId`, `conversationId`, `filename`, `mime`, and `path` (FR-12).

3. `MessageRepository` implements `findByConversation`, `save`, and `updateStatus` so messages are persisted with `userId`/`conversationId`/`parentId`/`role`/`content`/`model`/`status`, the `status` enum lifecycle (`processing | complete | stopped`) is honored, and status updates target the correct user-scoped message (FR-5, FR-6).

4. Concrete entity classes (`Conversation`, `Message`, `Asset`) use TypeORM decorators matching the E1 entity field shapes (`07-entity.md`, Story 1.1) with `uuid` primary keys (Postgres), `createdAt`/`updatedAt` timestamps, and `status` typed as the `MessageStatus` union (FR-4, FR-5, FR-12).

5. Repositories obtain their `DataSource` from the E2 Postgres DataSource (no port/adapter layer) and are colocated with Vitest unit tests (`*.test.ts`) that run offline against a disposable/in-memory TypeORM instance with mocked externals (FR-21, FR-29, FR-30, NFR-8).

## Tasks / Subtasks

- [ ] Task 1: Implement concrete `Conversation` entity (AC: #4)
  - [ ] Subtask 1.1: Define `@Entity('conversations')` class with `@PrimaryGeneratedColumn('uuid') id` (07-entity.md#CONVERSATION).
  - [ ] Subtask 1.2: Add `userId` (`@Column()`), `rootConversationId?` (`@Column({ nullable: true })`), `lastMessageId?` (`@Column({ nullable: true })`), `title` (`@Column()`), `model?` (`@Column({ nullable: true })`) (FR-4, epics.md Story 1.1).
  - [ ] Subtask 1.3: Add `createdAt`/`updatedAt` via `@CreateDateColumn()` / `@UpdateDateColumn()` (07-entity.md).
  - [ ] Subtask 1.4: Add optional `@OneToMany` relations to `Message` and `Asset` for navigability (no queries depend on these for scoping).

- [ ] Task 2: Implement concrete `Message` entity (AC: #4)
  - [ ] Subtask 2.1: Define `@Entity('messages')` with `@PrimaryGeneratedColumn('uuid') id` (07-entity.md#MESSAGE).
  - [ ] Subtask 2.2: Add `conversationId` (`@Column()`), `userId` (`@Column()`), `parentId?` (`@Column({ nullable: true })`), `role` (`@Column()`), `content` (`@Column('text')`), `model?` (`@Column({ nullable: true })`), `status` (`@Column()` typed to `MessageStatus`).
  - [ ] Subtask 2.3: Add `createdAt` via `@CreateDateColumn()`; branch ordering uses `createdAt` (FR-8..FR-11).
  - [ ] Subtask 2.4: Add optional `@ManyToOne`/`@OneToMany` self-relation on `parentId` for branching (epics.md Story 4.1).

- [ ] Task 3: Implement concrete `Asset` entity (AC: #4)
  - [ ] Subtask 3.1: Define `@Entity('assets')` with `@PrimaryGeneratedColumn('uuid') id` (07-entity.md#ASSET).
  - [ ] Subtask 3.2: Add `userId` (`@Column()`), `conversationId` (`@Column()`), `filename` (`@Column()`), `mime` (`@Column()`), `path` (`@Column()` — shared Docker volume path), `createdAt` (`@CreateDateColumn()`) (FR-12).
  - [ ] Subtask 3.3: Add `@ManyToOne`/`@OneToMany` relation to `VectorRecord` placeholder if needed by E5; keep `Asset` free of volume-level coupling (FR-12 — isolation is DB-layer only).

- [ ] Task 4: Implement `ConversationRepository` against E1 interface (AC: #1)
  - [ ] Subtask 4.1: `findById(id: string, userId: string): Promise<Conversation | null>` — `WHERE id = :id AND userId = :userId` (epics.md Story 1.2, `02-class.md#ConversationRepository`).
  - [ ] Subtask 4.2: `findAll(userId: string): Promise<Conversation[]>` — `WHERE userId = :userId ORDER BY updatedAt DESC LIMIT 50` (Epic 3 Story 3.2).
  - [ ] Subtask 4.3: `save(c: Conversation): Promise<Conversation>` — persist; enforce `c.userId` present (FR-2).
  - [ ] Subtask 4.4: `branch(...)` helper retained for E4 but scoping still requires `userId`.

- [ ] Task 5: Implement `MessageRepository` (save / findByConversation / updateStatus) (AC: #1, #3)
  - [ ] Subtask 5.1: `findByConversation(conversationId: string, userId: string): Promise<Message[]>` — `WHERE conversationId = :conversationId AND userId = :userId ORDER BY createdAt ASC` (02-class.md#MessageRepository, FR-5).
  - [ ] Subtask 5.2: `save(m: Message): Promise<Message>` — persist; enforce `m.userId` and `m.conversationId` present (FR-2, FR-5).
  - [ ] Subtask 5.3: `updateStatus(id: string, userId: string, status: MessageStatus): Promise<void>` — `UPDATE messages SET status = :status WHERE id = :id AND userId = :userId` (FR-6 lifecycle: processing → complete / stopped; epics.md Story 1.2).
  - [ ] Subtask 5.4: Ensure `status` is constrained to `processing | complete | stopped` (MessageStatus enum, 02-class.md#MessageStatus).

- [ ] Task 6: Implement `AssetRepository` (save / findByConversation / delete) (AC: #1, #2)
  - [ ] Subtask 6.1: `save(a: Asset): Promise<Asset>` — persist; enforce `a.userId` and `a.conversationId` present (FR-12, FR-2).
  - [ ] Subtask 6.2: `findByConversation(conversationId: string, userId: string): Promise<Asset[]>` — `WHERE conversationId = :conversationId AND userId = :userId` (FR-12).
  - [ ] Subtask 6.3: `delete(id: string, userId: string): Promise<void>` — `DELETE FROM assets WHERE id = :id AND userId = :userId` (FR-12, FR-16 explicit delete via AssetsRoute DELETE).

- [ ] Task 7: Wire repositories to the E2 Postgres DataSource (AC: #5)
  - [ ] Subtask 7.1: Construct repositories from `AppDataSource` (or injected `DataSource`) exported by `src/lib/db/data-source.ts` (Epic 2 Story 2.2).
  - [ ] Subtask 7.2: Register entities in the DataSource `entities` array; confirm migrations (E2.2) create `conversations`/`messages`/`assets` tables.

- [ ] Task 8: Colocated Vitest unit tests with mocked externals (AC: #5)
  - [ ] Subtask 8.1: Add `conversation.repository.test.ts`, `message.repository.test.ts`, `asset.repository.test.ts` next to each impl (`*.test.ts`, FR-29).
  - [ ] Subtask 8.2: Use a disposable Postgres or in-memory TypeORM instance; seed fixtures from E2.5; assert `userId` scoping on every method (cross-user reads return null/empty).
  - [ ] Subtask 8.3: Mock OpenAI/LangChain/Qdrant/Jina/Clerk so tests run offline/deterministically (FR-30, NFR-8); cover ≥80% of repositories (NFR-7, FR-31).

## Dev Notes

- **Architecture pattern (FR-21):** Tightly integrated layered architecture. Dependency direction is `app (route handlers) -> services -> repositories`, with no port/adapter abstraction. Concrete TypeORM repositories are consumed directly by services from E3/E4/E5. No repository-factory indirection is required.
- **Persistence substrate (Epic 2 Story 2.2):** Postgres via TypeORM `DataSource`. SQLite is retired; the v2 schema is applied through reversible migrations. Entities use `@PrimaryGeneratedColumn('uuid')` for `id` (07-entity.md) — Postgres `uuid` PKs.
- **User scoping is mandatory (FR-2):** Every `find*`/`update*`/`delete` query MUST include a `userId` equality predicate. `save` receives an entity that already carries `userId` (set by the calling service from the Clerk session via the E1 `auth` contract). Repositories must NOT accept a query that could leak cross-user rows.
- **DataSource access:** Import the configured `DataSource` from `src/lib/db/data-source.ts` (created in E2.2). Use `dataSource.getRepository(Entity)` inside each repository method, or inject the `DataSource` constructor arg (class diagram shows `-ds: DataSource` on each repository; mirror that).
- **`MessageStatus` enum:** `processing | complete | stopped` (02-class.md#MessageStatus, FR-5). `updateStatus` drives the E3 send lifecycle: user msg saved → trailing assistant msg `processing` → on stream complete `complete` → on termination `stopped` with content `"user terminated the response"` (FR-6).
- **`Asset` isolation (FR-12):** Logical isolation is enforced at the DB layer via `Asset.userId`, NOT at the shared Docker volume level. `path` points into the shared named volume; only the row is user-scoped.
- **Testing standards (FR-29, FR-30, FR-31, NFR-7, NFR-8):** Vitest, colocated `*.test.ts`, mocked externals (OpenAI/LangChain, Qdrant, Jina, Clerk), disposable Postgres or in-memory TypeORM, ≥80% repository coverage enforced in CI. Seedable fixtures from E2.5.

### Project Structure Notes

- Entities live in `src/lib/db/entities/` (e.g. `conversation.entity.ts`, `message.entity.ts`, `asset.entity.ts`), per `05-architecture.md` data layer (`src/lib/db`) and Story 2.4 layered skeleton.
- Repositories live in `src/lib/db/repositories/` (e.g. `conversation.repository.ts`, `message.repository.ts`, `asset.repository.ts`). Vitest config in E2.5 targets `src/lib/db/repositories` for coverage.
- DataSource in `src/lib/db/data-source.ts` (Epic 2 Story 2.2). Entities registered there.
- Naming: PascalCase entity classes (`Conversation`, `Message`, `Asset`); repository classes suffixed `Repository`; table names `conversations`/`messages`/`assets` (07-entity.md). Path alias `@/*` → project root (project-context.md).
- No conflicts with unified structure: this story only adds persistence classes; it does not touch `app/`, `services/`, `lib/ai`, `lib/vector`, `lib/cache`, `lib/auth`, or `lib/validation`. E3+ services will import these repositories.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1] Story 1.1 entity field shapes (FR-4, FR-5, FR-12); Story 1.2 repository interface signatures `findById(id, userId)`, `findAll(userId)`, `save`, `updateStatus(id, status)` and "every query carries userId" (FR-2).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3] Story 3.1 requirement: implement E1 interfaces, enforce userId scoping (FR-2), AssetRepository `save`/`findByConversation`/`delete` (FR-12), MessageRepository `findByConversation`/`save`/`updateStatus` (FR-5, FR-6).
- [Source: _bmad-output/planning-artifacts/07-entity.md#CONVERSATION] `uuid id PK`, `userId FK`, `rootConversationId?`, `lastMessageId?`, `title`, `model?`, `createdAt`, `updatedAt`.
- [Source: _bmad-output/planning-artifacts/07-entity.md#MESSAGE] `uuid id PK`, `conversationId FK`, `userId FK`, `parentId?`, `role`, `content (text)`, `model?`, `status (processing|complete|stopped)`, `createdAt`.
- [Source: _bmad-output/planning-artifacts/07-entity.md#ASSET] `uuid id PK`, `userId FK`, `conversationId FK`, `filename`, `mime`, `path`, `createdAt`.
- [Source: _bmad-output/planning-artifacts/02-class.md#ConversationRepository] `findById(id, userId)`, `save(c)`, `findAll(userId)`, `branch()`.
- [Source: _bmad-output/planning-artifacts/02-class.md#MessageRepository] `findByConversation(cid)`, `save(m)`, `updateStatus(id, status)`.
- [Source: _bmad-output/planning-artifacts/02-class.md#AssetRepository] `save(a)`, `findByConversation(cid)`, `delete(id)`.
- [Source: _bmad-output/planning-artifacts/02-class.md#MessageStatus] enumeration `processing | complete | stopped`.
- [Source: _bmad-output/planning-artifacts/05-architecture.md#data] data layer `src/lib/db`: entities, repositories, DataSource (Postgres); no port/adapter layer.
- [Source: _bmad-output/project-context.md#Technology Stack] Next.js 16 App Router, TypeScript 5 strict, path alias `@/*` → root; API routes under `app/api/`.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2] Postgres DataSource + reversible migrations, SQLite retired.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4] layered package skeleton `lib/db`, `services`, `app`, etc. (FR-21).
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5] Vitest coverage gate ≥80% on `src/services` + `src/lib/db/repositories`, colocated `*.test.ts`, mocked externals (FR-29, FR-30, FR-31, NFR-7, NFR-8).

## Dev Agent Record

### Agent Model Used

subagent

### Debug Log References

### Completion Notes List

### File List
