---
baseline_commit: 0169a4cd615e3e4e8e31d00c3f96a2681fb08144
---
# Story 1.2: Repository & Service Interface Definitions

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Maintainer,
I want the repository and service interface signatures defined,
so that logic epics implement against stable contracts.

## Acceptance Criteria

1. `ConversationRepository` interface is declared with methods: `findById(id, userId)`, `findAll(userId)`, `save(c)`, `branch(...)` — operating on the `Conversation` entity from Story 1.1. Every query method is scoped by `userId`. [FR-2] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — ConversationRepository]
2. `MessageRepository` interface is declared with methods: `findById(id, userId)`, `findAll(userId)`, `findByConversation(cid)`, `save(m)`, `updateStatus(id, status)` — operating on the `Message` entity and `MessageStatus` union from Story 1.1. [FR-2] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — MessageRepository]
3. `AssetRepository` interface is declared with methods: `findById(id, userId)`, `findAll(userId)`, `save(a)`, `findByConversation(cid)`, `delete(id)` — operating on the `Asset` entity from Story 1.1. [FR-2] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — AssetRepository]
4. Every repository method that reads/writes user-owned data carries an explicit `userId` parameter for scoping (AC applies uniformly to `ConversationRepository`, `MessageRepository`, `AssetRepository`, even where `02-class.md`'s class diagram shorthand omits it on some methods — the epics.md AC text is authoritative: "every repository query signature carries `userId` for scoping"). [FR-2] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2]
5. `ConversationService` interface is declared with method signatures: `list(userId)`, `create(userId, input)`, `getById(id, userId)`, `branch(id, messageId, userId)`. [FR-21] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — ConversationService]
6. `MessageService` interface is declared with method signatures: `append(conversationId, role, content)`, `history(conversationId)`, `editLatest(userId, conversationId, content)`. [FR-21] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — MessageService]
7. `ChatService` interface is declared with method signatures: `send(req, userId)`, `stream(req, onChunk)`, `regenerate(messageId, userId)`. [FR-21] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — ChatService]
8. `AssetService` interface is declared with method signatures: `ingest(userId, convId, file)`, `remove(assetId, userId)`. [FR-21] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes — AssetService]
9. All interfaces are TypeScript `interface` declarations only — no class bodies, no method implementations, no repository/service construction logic (e.g. no `DataSource` wiring, no SQL, no HTTP calls). This is Epic 1 scope: contracts only; implementations land in Story 3.1 (repositories) and later Epic 3/4/5 stories (services). [Epic 1 scope rule] [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Types & Contracts]
10. Interface files are placed under `src/lib/db/repositories/` (repository interfaces, colocated with or ahead of their future concrete implementations) and `src/services/` (service interfaces, colocated with or ahead of their future concrete implementations), matching the authoritative file tree from `01-package.md`. [Source: _bmad-output/planning-artifacts/01-package.md#1. File Tree (authoritative)]

## Tasks / Subtasks

- [x] Task 1: Define `ConversationRepository` interface (AC: #1, #4, #9, #10)
  - [x] Create `src/lib/db/repositories/conversation.repository.ts` (or a dedicated interface file within that same directory if the team later splits interface/impl — for this story, declare the `interface ConversationRepository` in this file since no concrete class exists yet)
  - [x] Import `Conversation` from `src/lib/db/entities/conversation.entity.ts` (Story 1.1)
  - [x] Declare `findById(id: string, userId: string): Promise<Conversation | null>`
  - [x] Declare `findAll(userId: string): Promise<Conversation[]>`
  - [x] Declare `save(c: Partial<Conversation>): Promise<Conversation>`
  - [x] Declare `branch(id: string, messageId: string, userId: string): Promise<Conversation>`
  - [x] No method bodies, no `DataSource` import, no SQL
- [x] Task 2: Define `MessageRepository` interface (AC: #2, #4, #9, #10)
  - [x] Create `src/lib/db/repositories/message.repository.ts`
  - [x] Import `Message`, `MessageStatus` from `src/lib/db/entities/message.entity.ts` (Story 1.1)
  - [x] Declare `findById(id: string, userId: string): Promise<Message | null>`
  - [x] Declare `findAll(userId: string): Promise<Message[]>`
  - [x] Declare `findByConversation(conversationId: string, userId: string): Promise<Message[]>`
  - [x] Declare `save(m: Partial<Message>): Promise<Message>`
  - [x] Declare `updateStatus(id: string, status: MessageStatus, userId: string): Promise<void>`
  - [x] No method bodies, no `DataSource` import, no SQL
- [x] Task 3: Define `AssetRepository` interface (AC: #3, #4, #9, #10)
  - [x] Create `src/lib/db/repositories/asset.repository.ts`
  - [x] Import `Asset` from `src/lib/db/entities/asset.entity.ts` (Story 1.1)
  - [x] Declare `findById(id: string, userId: string): Promise<Asset | null>`
  - [x] Declare `findAll(userId: string): Promise<Asset[]>`
  - [x] Declare `save(a: Partial<Asset>): Promise<Asset>`
  - [x] Declare `findByConversation(conversationId: string, userId: string): Promise<Asset[]>`
  - [x] Declare `delete(id: string, userId: string): Promise<void>`
  - [x] No method bodies, no `DataSource` import, no SQL
- [x] Task 4: Define `ConversationService` interface (AC: #5, #9, #10)
  - [x] Create `src/services/conversation.service.ts`
  - [x] Import `Conversation` type from the entity module (interface signatures reference it, not a repository instance)
  - [x] Declare `list(userId: string): Promise<Conversation[]>`
  - [x] Declare `create(userId: string, input: { title?: string; model?: string }): Promise<Conversation>`
  - [x] Declare `getById(id: string, userId: string): Promise<Conversation | null>`
  - [x] Declare `branch(id: string, messageId: string, userId: string): Promise<Conversation>`
  - [x] No method bodies, no repository construction/wiring
- [x] Task 5: Define `MessageService` interface (AC: #6, #9, #10)
  - [x] Create `src/services/message.service.ts`
  - [x] Import `Message`, `MessageStatus`, `Role`-shaped literal from entity/type modules as needed
  - [x] Declare `append(conversationId: string, role: "user" | "assistant" | "system", content: string): Promise<Message>`
  - [x] Declare `history(conversationId: string): Promise<Message[]>`
  - [x] Declare `editLatest(userId: string, conversationId: string, content: string): Promise<Message>`
  - [x] No method bodies
- [x] Task 6: Define `ChatService` interface (AC: #7, #9, #10)
  - [x] Create `src/services/chat.service.ts`
  - [x] Declare `send(req: unknown, userId: string): Promise<unknown>` (exact `ChatRequest`/`ChatResponse` shapes are defined in Story 1.4 — reference those types once they exist; use a documented placeholder/import stub for now if Story 1.4 has not landed, per Dev Notes guidance)
  - [x] Declare `stream(req: unknown, onChunk: (chunk: string) => void): Promise<void>`
  - [x] Declare `regenerate(messageId: string, userId: string): Promise<void>`
  - [x] No method bodies, no AiProvider/QdrantStore/RedisCache wiring (those are Story 1.3 interfaces + later concrete implementations)
- [x] Task 7: Define `AssetService` interface (AC: #8, #9, #10)
  - [x] Create `src/services/asset.service.ts`
  - [x] Declare `ingest(userId: string, convId: string, file: unknown): Promise<Asset>` (import `Asset` entity type)
  - [x] Declare `remove(assetId: string, userId: string): Promise<void>`
  - [x] No method bodies
- [x] Task 8: Verify directory structure and scope discipline (AC: #9, #10)
  - [x] Confirm `src/lib/db/repositories/` and `src/services/` directories exist with only the 7 interface files added by this story
  - [x] Do not create concrete repository classes, `DataSource` wiring, or route handlers in this story — those are Story 3.1 (repositories), Story 2.2 (DataSource), and Epic 3+ (services/routes)
  - [x] Do not implement `AiProvider`, `QdrantStore`, `RedisCache` interfaces here — those belong to Story 1.3
  - [ ] Confirm `src/lib/db/repositories/` and `src/services/` directories exist with only the 7 interface files added by this story
  - [ ] Do not create concrete repository classes, `DataSource` wiring, or route handlers in this story — those are Story 3.1 (repositories), Story 2.2 (DataSource), and Epic 3+ (services/routes)
  - [ ] Do not implement `AiProvider`, `QdrantStore`, `RedisCache` interfaces here — those belong to Story 1.3

## Dev Notes

**Scope discipline (critical):** This is Epic 1 — Types & Contracts. "No behavior is implemented here — only the shapes and signatures that downstream logic conforms to" [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Types & Contracts]. This story delivers ONLY `interface` declarations for 3 repositories + 4 services (7 files total). Concrete repository implementations are Story 3.1; concrete service implementations are spread across Epic 3 (ConversationService, ChatService, MessageService — Stories 3.2/3.3/3.5/3.6) and Epic 5 (AssetService — Story 5.1). Do not write any method body, `DataSource` query, HTTP call, or business rule in this story.

**Method shapes — authoritative source is the AC text in epics.md, not just the class diagram shorthand:** `02-class.md`'s mermaid class diagram shows repository methods without a `userId` param in some places (e.g. `MessageRepository.findByConversation(cid)`, `AssetRepository.findByConversation(cid)`) because it is a simplified UML view. The epics.md Story 1.2 AC is explicit and overrides this: "every repository query signature carries `userId` for scoping (FR-2)" [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2]. Add `userId` to every repository interface method in this story, even where `02-class.md` omits it. Where `02-class.md` shows `ConversationRepository.branch()` with no args, epics.md/03-sequence.md clarify the caller passes `(id, messageId)` at the service layer and the repository's `branch` participates in that flow — declare `branch(id, messageId, userId)` on `ConversationRepository` for consistency with the userId-scoping rule, and `branch(id, messageId, userId)` on `ConversationService` per the Story 4.1 AC text: `ConversationService.branch(id, messageId, userId)` [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1].

**Cross-check method shapes against 03-sequence.md (concrete call shapes used by later stories):**
- `ConversationRepository.findById(conversationId, userId)`, `MessageRepository.append(conversationId, user, content, status:processing)` (sequence #1) — note: `MessageRepository` in `02-class.md` calls this `save`, and epics.md Story 1.2 AC lists `save` (not `append`) as the repository method name — `append` is the **service**-level (`MessageService.append`) name. Use `save(m)` for the repository interface and `append(...)` for the `MessageService` interface to avoid naming collision and stay literal to the epics.md AC. [Source: _bmad-output/planning-artifacts/03-sequence.md#1] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2]
- `ConversationRepository.findAll(userId)` ordered by `updatedAt DESC LIMIT 50` (sequence #3) — ordering/limit is a repository **implementation** detail for Story 3.1, not part of this interface's signature; the interface just declares `findAll(userId): Promise<Conversation[]>`.
- `MessageRepository.updateStatus(messageId, processing)` (sequence #5, regenerate flow) confirms the `updateStatus(id, status)` shape from the AC; add `userId` per the scoping rule above.
- `AssetRepository.save(Asset)`, referenced alongside `AssetService.ingest` (sequence #4).

**Entity types this story's interfaces MUST reference (from Story 1.1 — do not invent new shapes):**
- `Conversation` — fields: `id`, `userId`, `rootConversationId?`, `lastMessageId?`, `title`, `model?`, `createdAt`, `updatedAt`. File: `src/lib/db/entities/conversation.entity.ts`.
- `Message` — fields: `id`, `conversationId`, `userId`, `parentId?`, `role` (`"user" | "assistant" | "system"`), `content`, `model?`, `status` (`MessageStatus`), `createdAt`. File: `src/lib/db/entities/message.entity.ts`. `MessageStatus = "processing" | "complete" | "stopped"` is colocated in this same file per Story 1.1's convention.
- `Asset` — fields: `id`, `userId`, `conversationId`, `filename`, `mime`, `path`, `createdAt`. File: `src/lib/db/entities/asset.entity.ts`.
[Source: _bmad-output/implementation-artifacts/1-1-entity-type-typeorm-decorator-definitions.md]

**Layering / dependency rule this story establishes at the type level:** `app (routes + middleware) → services → { repositories (TypeORM) | ai | vector | websearch | cache }` [Source: _bmad-output/planning-artifacts/01-package.md#3. Dependency Rule] [Source: _bmad-output/planning-artifacts/05-architecture.md]. Concretely: `ChatService`/`ConversationService`/`MessageService`/`AssetService` interfaces depend on (reference) the repository interfaces and entity types defined here and in Story 1.1 — they must NOT reference concrete repository classes (none exist yet) or concrete integration modules (`AiProvider`/`QdrantStore`/`RedisCache` concrete impls are out of scope; their interfaces are Story 1.3). Where a service method needs an integration (e.g. `ChatService.send` needing `AiProvider`), reference it only by its future interface name in a comment/type placeholder — do not implement or import a concrete integration in this story.

**No port/adapter abstraction, but interfaces are still used for repositories/services:** The "no port/adapter abstraction layer" rule in `01-package.md` refers to NOT decoupling from Next.js/TypeORM frameworks (i.e., entities keep TypeORM decorators directly, no repository-pattern-of-the-gaps hiding TypeORM). It does NOT mean repository/service interfaces themselves are skipped — Epic 1 explicitly is "Types & Contracts" and Story 1.2 exists precisely to define these interfaces as the contract layer downstream stories implement against [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Types & Contracts].

**ChatRequest/ChatResponse types not yet defined:** `ChatService.send`/`stream` conceptually take a `ChatRequest`-shaped argument, but the concrete `ChatRequest`/`ChatResponse` types are defined in Story 1.4 (Zod schemas & shared app types, `src/types`), which has not yet run as of this story. Use a loosely-typed placeholder (e.g. `req: unknown` or a local minimal inline type) in this story's `ChatService` interface, and leave a comment noting it should be narrowed to `ChatRequest`/`ChatResponse` from `src/types` once Story 1.4 lands. Do not block this story on Story 1.4, and do not invent a competing `ChatRequest` type here — that would create the exact "shape drift" problem Epic 1 exists to prevent.

**File placement:** Repository interfaces go in `src/lib/db/repositories/{conversation,message,asset}.repository.ts` (same directory as future concrete implementations from Story 3.1 — one file per repository, holding just the `interface` for now). Service interfaces go in `src/services/{chat,conversation,message,asset}.service.ts` (same directory as future concrete implementations from Epic 3/5). [Source: _bmad-output/planning-artifacts/01-package.md#1. File Tree (authoritative)] [Source: _bmad-output/planning-artifacts/01-package.md#2.2 Services — src/services] [Source: _bmad-output/planning-artifacts/01-package.md#2.3 Data (TypeORM) — src/lib/db]

**No testing requirement for this story:** Same rationale as Story 1.1 — interfaces have no behavior to unit test. The testing foundation (Vitest, coverage gate) is Story 2.5; fixtures per repository/service are built out from Story 2.5 onward as concrete implementations land.

### Learnings from Story 1.1

- Entity files live at `src/lib/db/entities/{conversation,message,asset}.entity.ts`; this story's repository interfaces must import from those exact paths, not redefine field shapes.
- `MessageStatus` union (`"processing" | "complete" | "stopped"`) is colocated in `message.entity.ts` — import it from there for `MessageRepository.updateStatus` and any service methods touching status.
- `role` on `Message` is `"user" | "assistant" | "system"` (not yet a named exported type in Story 1.1 — it's inlined as a literal union on the `role` field); this story's `MessageService.append(conversationId, role, content)` should type `role` the same way, or import a `Role` type if Story 1.1 exports one (check the entity file at implementation time — if `Role` is not exported, use the inline literal union to stay consistent, and flag as a minor drift risk for Story 1.4 which is expected to formalize `Role` as a shared app type per `02-class.md` view B).
- Story 1.1 established the "interfaces/entities only, no persistence wiring" scope discipline and flagged `_bmad-output/project-context.md` as non-authoritative/incomplete for backend work — the same conflict flag applies here (see Project Structure Notes below).
- Story 1.1 explicitly deferred `src/lib/db/repositories/`, `migrations/`, and `data-source.ts` to Stories 1.2/2.2/3.1. This story is the one that creates the `repositories/` directory's interface files (not migrations or data-source — those remain Story 2.2/3.1 scope).
[Source: _bmad-output/implementation-artifacts/1-1-entity-type-typeorm-decorator-definitions.md]

### Project Structure Notes

- Files to create, matching the authoritative file tree: `src/lib/db/repositories/conversation.repository.ts`, `src/lib/db/repositories/message.repository.ts`, `src/lib/db/repositories/asset.repository.ts`, `src/services/conversation.service.ts`, `src/services/message.service.ts`, `src/services/chat.service.ts`, `src/services/asset.service.ts` [Source: _bmad-output/planning-artifacts/01-package.md#1. File Tree (authoritative)].
- Consistent with Story 1.1's convention: interface-only files at this stage, no method bodies, no framework wiring (`DataSource`, TypeORM query builders, HTTP clients).
- Do NOT create `src/lib/db/data-source.ts` or `src/lib/db/migrations/` (Story 2.2 scope), and do NOT write concrete repository/service classes (Story 3.1 for repositories; Epic 3/5 for services).
- **Conflict flag (carried forward from Story 1.1):** `_bmad-output/project-context.md` describes a Next.js 16 / React 19 / Tailwind / shadcn-ui / TanStack Query **frontend-only** stack and is silent on `src/services` or `src/lib/db` backend layers. Treat it as incomplete for this backend contract-definition story, not authoritative — follow `01-package.md`, `02-class.md`, and `05-architecture.md` for all structural decisions here, consistent with the precedent set in Story 1.1.
- No UI, route handler, migration, or concrete persistence/business logic is touched by this story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] — Story text, AC (Given/When/Then), FR-2/FR-21 tags
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Types & Contracts] — Epic scope: contracts only, no logic
- [Source: _bmad-output/planning-artifacts/02-class.md#A) Concrete Classes] — `ConversationRepository`, `MessageRepository`, `AssetRepository`, `ConversationService`, `MessageService`, `ChatService`, `AssetService` method shapes
- [Source: _bmad-output/planning-artifacts/01-package.md#1. File Tree (authoritative)] — exact repository/service file paths
- [Source: _bmad-output/planning-artifacts/01-package.md#2.2 Services — src/services] — services depend on repositories/ai/vector/cache
- [Source: _bmad-output/planning-artifacts/01-package.md#2.3 Data (TypeORM) — src/lib/db] — repositories location, "depends on nothing" for entities (repositories sit just above)
- [Source: _bmad-output/planning-artifacts/01-package.md#3. Dependency Rule] — `app → services → {repositories | ai | vector | websearch | cache}`, no port/adapter abstraction
- [Source: _bmad-output/planning-artifacts/05-architecture.md] — layered architecture diagram confirming services → repositories/integrations
- [Source: _bmad-output/planning-artifacts/03-sequence.md#1,#3,#4,#5] — concrete call shapes confirming method signatures (`findById`, `findAll` with ordering, `save`/`append`, `updateStatus`, `branch`)
- [Source: _bmad-output/planning-artifacts/04-requirements.md] (referenced inline via epics.md Requirements Inventory) — FR-2 (userId scoping), FR-21 (layered architecture, services hold use-case logic)
- [Source: _bmad-output/implementation-artifacts/1-1-entity-type-typeorm-decorator-definitions.md] — entity field shapes/paths, `MessageStatus` location, scope-discipline precedent, project-context.md conflict flag
- [Source: _bmad-output/project-context.md] — frontend stack facts; flagged as non-authoritative/incomplete for this backend story

## Dev Agent Record

### Agent Model Used

Claude Haiku 4.5 (user model preference)

### Debug Log References

No build failures. All 7 interface files validated against AC. Imports from Story 1.1 entities verified. userId scoping applied uniformly across all repository methods per FR-2. ChatService placeholders documented pending Story 1.4 type definitions.

### Completion Notes List

✅ Created ConversationRepository interface (4 methods with userId scoping)
✅ Created MessageRepository interface (5 methods with userId scoping, MessageStatus typing)
✅ Created AssetRepository interface (5 methods with userId scoping)
✅ Created ConversationService interface (4 methods including branch orchestration)
✅ Created MessageService interface (3 methods with role literal typing)
✅ Created ChatService interface (3 methods with unknown placeholders for Story 1.4 ChatRequest/ChatResponse types)
✅ Created AssetService interface (2 methods)
✅ All 10 acceptance criteria satisfied; no deviations from story spec
✅ Zero implementations; interfaces only per Epic 1 scope discipline
✅ All imports from Story 1.1 entities validated
✅ Established src/lib/db/repositories/ and src/services/ directories (no DataSource, migrations, or concrete classes)

### File List

- src/lib/db/repositories/conversation.repository.ts (NEW — interface only)
- src/lib/db/repositories/message.repository.ts (NEW — interface only)
- src/lib/db/repositories/asset.repository.ts (NEW — interface only)
- src/services/conversation.service.ts (NEW — interface only)
- src/services/message.service.ts (NEW — interface only)
- src/services/chat.service.ts (NEW — interface only, with Story 1.4 ChatRequest/ChatResponse placeholder)
- src/services/asset.service.ts (NEW — interface only)
