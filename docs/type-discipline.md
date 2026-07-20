# Type Discipline — chaiGPT

Onboarding reference for type conventions used across the project.

## 1. TypeScript Configuration

`strict: true` in `tsconfig.json` — includes `strictNullChecks`, `strictPropertyInitialization`, `noImplicitAny`, and all other strict flags.

**Entity `!` assertions:** TypeORM decorators initialize properties at runtime, but TypeScript can't see that. Entity properties use `!` (definite assignment assertion) for required columns:

```ts
@PrimaryGeneratedColumn('uuid')
id!: string;
```

Optional columns use `?`:
```ts
@Column({ nullable: true })
model?: string;
```

Do NOT add `!` to relationship properties (`@OneToMany`, `@ManyToOne`) — they should always be `?` since they're lazily loaded:

```ts
@OneToMany(() => Message, message => message.conversation)
messages?: Message[];
```

Reference: `src/lib/db/entities/conversation.entity.ts`

## 2. Entity Patterns

- **IDs:** `@PrimaryGeneratedColumn('uuid')` — always UUIDs, never auto-increment integers.
- **Timestamps:** `@CreateDateColumn()` and `@UpdateDateColumn()` on every entity.
- **Columns:** `@Column()` for simple fields, `@Column({ type: 'text' })` or `@Column({ type: 'varchar' })` for explicit typing.
- **Relationships:** `@ManyToOne` + `@JoinColumn` on the child side; `@OneToMany` on the parent side.
- **Plain classes:** Entities hold schema only — no business logic, no methods beyond what TypeORM provides.
- **Type exports:** Export entity types from the entity file (e.g., `export type MessageStatus = ...`).

References: `src/lib/db/entities/*.entity.ts`

## 3. Service Patterns

Services follow an interface + implementation pattern:

```ts
export interface ChatService {
  send(req: ChatRequest, userId: string): Promise<ReadableStream>;
  regenerate(messageId: string, userId: string): Promise<ReadableStream>;
}

export class ChatServiceImpl implements ChatService {
  constructor(
    private conversationRepo: ConversationRepository,
    private messageRepo: MessageRepository,
    private aiProvider: AiProvider,
    // optional deps last
    private assetRepo?: AssetRepository,
  ) {}
}
```

Conventions:
- Dependencies injected via constructor (repository interfaces, providers).
- Optional dependencies go last with `?`.
- Use Zod `.parse()` at service entry points for runtime validation (e.g., `ChatRequestSchema.parse(req)`).
- Import types with `import type { ... }` when only using the type.
- Use `satisfies` for mock repos in tests to ensure type safety without widening.

References: `src/services/chat.service.ts:16-30`, `src/lib/validation/schemas.ts`

## 4. Error Handling

Custom errors live in `src/lib/errors.ts`:

```ts
export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}
```

Rules:
- Throw `NotFoundError` (not generic `Error`) when an entity is missing.
- Map to HTTP status codes: **400** (validation), **404** (not found), **409** (conflict), **500** (unexpected).
- Never catch a `NotFoundError` and rethrow as a 500 — let it propagate to the error handler.
- Zod `.parse()` throws `ZodError` (400) — don't wrap it in a try/catch unless you need custom error mapping.

References: `src/lib/errors.ts`, `src/services/chat.service.ts:38`

## 5. Testing Patterns

Framework: **Vitest** with in-memory SQLite for repository tests, mocked dependencies for service tests.

Key conventions:
- Use `vi.fn()` for mocks, typed via `satisfies` against the repository interface.
- Use `uuid()` from the `uuid` package for test IDs — never hardcoded strings like `"1"`.
- Create factory functions for test entities (`makeConversation()`, `makeMessage()`) with sensible defaults and `Partial<T>` overrides.
- Verify both the **result** and the **source** — e.g., if a service saves a message, assert both the return value and that `repo.save` was called with the right args.
- Use `as Conversation` cast in factory functions to satisfy TypeScript (entities have `!` properties).

References: `src/services/conversation.service.test.ts:8-60`

## 6. Import Conventions

- **Path aliases:** `@/*` maps to `src/*` (configured in `tsconfig.json`).
- **Named imports:** Always use named imports for local modules.
- **Type imports:** Use `import type { X }` when importing only types — keeps runtime bundles clean.
- **No default exports** except for React components and Next.js page/route files.
- **Unused imports:** Prefix with `_` if intentionally unused (e.g., `_req` for unused parameters).
- **Re-exports:** Barrel files (`types/index.ts`, `types/chat.ts`) re-export types for convenience.

```ts
// ✅ Correct
import type { ChatRequest } from '@/types';
import { NotFoundError } from '@/lib/errors';

// ❌ Avoid
import ChatRequest from '@/types';  // no default exports
import { ChatRequest, UnusedThing } from '@/types';  // no unused imports
```

References: `tsconfig.json` (paths), `src/types/index.ts`, `src/types/chat.ts`
