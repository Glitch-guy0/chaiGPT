# Story 1.4: Zod Validation Schemas & Shared App Types

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Maintainer,
I want Zod request schemas and shared app types,
so that every inbound request is validated against a single contract.

## Acceptance Criteria

1. `src/types/index.ts` exports canonical app types matching `02-class.md` view B exactly: `Role` (`"user" | "assistant" | "system"`), `ChatMessage` (`{ role: Role; content: string }`), `ChatRequest` (`{ messages: ChatMessage[]; model?: string; conversationId?: string }`), `ChatResponse` (`{ id: string; content: string; conversationId: string; model?: string }`). [FR-21] [Source: _bmad-output/planning-artifacts/02-class.md#B) Entities & Types]
2. `src/lib/validation/schemas.ts` exports `ChatRequestSchema`, `ConversationSchema`, `AssetSchema` (plus supporting schemas: `RoleSchema`, `ChatMessageSchema`, `CreateConversationSchema`) — Zod schemas used to validate inbound requests, each schema's inferred/annotated type matching the corresponding `src/types` type with zero drift. [FR-20] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4]
3. `ChatRequestSchema`, `ChatMessageSchema`, and `RoleSchema` are annotated as `z.ZodType<ChatRequest>` / `z.ZodType<ChatMessage>` / `z.ZodType<Role>` (importing the type from `src/types`) so TypeScript fails to compile if the schema drifts from the canonical type — `src/types` is the shape source of truth, `schemas.ts` is the runtime-validation source of truth, and this annotation keeps them locked together. [FR-20, FR-21]
4. `src/lib/utils.ts` retains the existing `cn()` helper (shadcn/ui class-merge, still required by `src/components/ui/**`) and adds `safeParseOrThrow<T>(schema, data): T`, a shared Zod-parsing helper that route handlers/services use as the single validation entry point (throws a consistent error on failure) — satisfying "shared helpers" for FR-21. [FR-21]
5. Zod `WebSearchArgsSchema` (`{ query: string (min 1) }`) is defined in `src/lib/validation/schemas.ts` for the LangChain `WebSearchTool` input contract, with an exported `WebSearchArgs = z.infer<typeof WebSearchArgsSchema>` type. [FR-28] [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4]
6. This story resolves the placeholder types explicitly deferred by Stories 1.2 and 1.3 by narrowing the following existing files to import from the canonical `src/types` / `src/lib/validation/schemas.ts` (created in this story) instead of using `unknown` or locally-declared shapes:
   - `src/services/chat.service.ts` (Story 1.2): `send`/`stream` parameters narrowed from `req: unknown` to `req: ChatRequest`, return types narrowed from `Promise<unknown>` to `Promise<ChatResponse>`.
   - `src/lib/ai/langchain.ts` (Story 1.3): the locally-declared `ChatMessage` interface is removed and replaced with `import type { ChatMessage, Role } from "@/types"`.
   - `src/lib/websearch/webSearchTool.ts` (Story 1.3): `run(query: string)` is narrowed to `run(args: WebSearchArgs)`, importing `WebSearchArgs`/`WebSearchArgsSchema` from `src/lib/validation/schemas.ts`.
   - `src/lib/db/entities/message.entity.ts` (Story 1.1): the inline `role: "user" | "assistant" | "system"` literal union is narrowed to `role: Role` via `import type { Role } from "@/types"` (type-only import, erased at compile time — preserves the "entities depend on nothing at runtime" rule while eliminating type duplication).
   [FR-20, FR-21, FR-28]
7. No new business logic, route handlers, or concrete provider wiring is introduced — this story only adds/finalizes shapes, schemas, and the narrow-the-placeholder edits in AC #6. [Epic 1 scope rule]

## Tasks / Subtasks

- [ ] Task 1: Create `src/types/index.ts` with canonical app types (AC: #1)
  - [ ] Replace the legacy `src/types/chat.ts` (currently re-exports outdated types from `src/lib/validation/schemas.ts` — see Dev Notes "Legacy file collision") with a new `src/types/index.ts`
  - [ ] Export `type Role = "user" | "assistant" | "system"`
  - [ ] Export `interface ChatMessage { role: Role; content: string }`
  - [ ] Export `interface ChatRequest { messages: ChatMessage[]; model?: string; conversationId?: string }`
  - [ ] Export `interface ChatResponse { id: string; content: string; conversationId: string; model?: string }`
  - [ ] Delete `src/types/chat.ts` (superseded); update any import of it (none exist outside legacy route handlers, which are out of scope — see Dev Notes)
- [ ] Task 2: Rewrite `src/lib/validation/schemas.ts` as the canonical Zod contract layer (AC: #2, #3, #5)
  - [ ] Import `Role`, `ChatMessage`, `ChatRequest` as types from `@/types`
  - [ ] Declare `RoleSchema: z.ZodType<Role> = z.enum(["user", "assistant", "system"])`
  - [ ] Declare `ChatMessageSchema: z.ZodType<ChatMessage> = z.object({ role: RoleSchema, content: z.string().min(1) })`
  - [ ] Declare `ChatRequestSchema: z.ZodType<ChatRequest> = z.object({ messages: z.array(ChatMessageSchema).min(1), model: z.string().optional(), conversationId: z.string().uuid().optional() })`
  - [ ] Declare `ConversationSchema = z.object({ title: z.string().min(1).max(255).optional(), model: z.string().optional() })` (validates conversation create/update request bodies)
  - [ ] Declare `CreateConversationSchema = z.object({ title: z.string().min(1).max(255).default("New Chat") })`
  - [ ] Declare `AssetSchema = z.object({ filename: z.string().min(1), mime: z.string().min(1), conversationId: z.string().uuid() })` (validates asset upload metadata; does not validate the file binary itself)
  - [ ] Declare `WebSearchArgsSchema = z.object({ query: z.string().min(1) })` and `export type WebSearchArgs = z.infer<typeof WebSearchArgsSchema>`
  - [ ] Do NOT bake FR-7's 500-char hard cap / 200-char paste rule into `ChatMessageSchema.content` — that is Story 3.7's business-rule enforcement, not a shape/contract concern (see Dev Notes)
  - [ ] Remove the legacy `MessageSchema`/`Conversation` (full-entity) schemas that validated read-shapes with `id`/`createdAt`/`updatedAt` — those are entity concerns (Story 1.1/3.1), not inbound-request validation; this story's schemas validate request *inputs* only
- [ ] Task 3: Extend `src/lib/utils.ts` (AC: #4)
  - [ ] Keep the existing `cn(...inputs: ClassValue[])` export unchanged (still consumed by `src/components/ui/**`)
  - [ ] Add `export function safeParseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T` that calls `schema.safeParse(data)` and throws a `new Error(...)` with the Zod error message on failure, otherwise returns `result.data`
- [ ] Task 4: Narrow Story 1.2's `ChatService` interface placeholder (AC: #6)
  - [ ] In `src/services/chat.service.ts`, import `ChatRequest`, `ChatResponse` from `@/types`
  - [ ] Change `send(req: unknown, userId: string): Promise<unknown>` to `send(req: ChatRequest, userId: string): Promise<ChatResponse>`
  - [ ] Change `stream(req: unknown, onChunk: (chunk: string) => void): Promise<void>` to `stream(req: ChatRequest, onChunk: (chunk: string) => void): Promise<void>`
  - [ ] Leave `regenerate(messageId, userId)` unchanged (no request-body shape involved)
- [ ] Task 5: Narrow Story 1.3's `AiProvider` placeholder (AC: #6)
  - [ ] In `src/lib/ai/langchain.ts`, remove the locally-declared `interface ChatMessage { role: ...; content: string }`
  - [ ] Add `import type { ChatMessage, Role } from "@/types"` and use the imported `ChatMessage` in the `AiProvider` interface's `complete`/`streamChat` signatures
- [ ] Task 6: Narrow Story 1.3's `WebSearchTool` placeholder (AC: #6)
  - [ ] In `src/lib/websearch/webSearchTool.ts`, import `WebSearchArgs` (type) and `WebSearchArgsSchema` (value, for the future concrete tool registration in Epic 7) from `@/lib/validation/schemas`
  - [ ] Change `run(query: string): Promise<string>` to `run(args: WebSearchArgs): Promise<string>` — this matches how LangChain structured tools validate a Zod-parsed args object (FR-28: "Zod-validated input args"), not a raw string
- [ ] Task 7: Narrow Story 1.1's `Message.role` field (AC: #6)
  - [ ] In `src/lib/db/entities/message.entity.ts`, add `import type { Role } from "@/types"` and change the `role` column's type annotation from the inline `"user" | "assistant" | "system"` literal union to `Role` (the `@Column({ type: "varchar" })` decorator itself is untouched — only the TS type annotation changes)
- [ ] Task 8: Verify scope discipline (AC: #7)
  - [ ] Confirm no route handler (`src/app/api/**`), UI component, or concrete provider logic (Jina HTTP calls, LangChain agent registration, `ChatOpenAI` instantiation beyond what Story 1.3/3.4 already own) was added or modified beyond the six files listed in Tasks 1–7
  - [ ] Confirm `src/lib/db/entities/conversation.entity.ts` and `src/lib/db/entities/asset.entity.ts` (if present) are untouched — this story does not touch `Conversation`/`Asset` entity shapes, only `Message.role`

## Dev Notes

**This story closes out Epic 1's contract layer.** Every FR-20/FR-21/FR-28 requirement for a single, non-duplicated request/type contract is now satisfied by `src/types/index.ts` (shapes) + `src/lib/validation/schemas.ts` (runtime validation of those shapes). **From this point forward, every later epic (2 through 7) MUST import `Role`/`ChatMessage`/`ChatRequest`/`ChatResponse` from `src/types` and MUST import `ChatRequestSchema`/`ConversationSchema`/`AssetSchema`/`WebSearchArgsSchema` from `src/lib/validation/schemas.ts` — no epic may redefine or locally re-shape these types.** This is the exact anti-pattern Epic 1 exists to prevent (see Story 1.2/1.3 Dev Notes: "do not invent a competing type").

**Legacy file collision (read before touching these paths):** This repository currently contains a **pre-Epic-1 legacy Next.js/SQLite chat app** at several of this story's target paths — `src/types/chat.ts`, `src/lib/validation/schemas.ts`, `src/lib/ai/langchain.ts` (concrete `LangChainService` class, not an interface), `src/lib/db/entities/{conversation,message}.entity.ts` (v1 shapes missing `userId`/`rootConversationId`/`parentId`/`status`), and legacy route handlers under `src/app/api/{chat,conversations}/**`. Epic 2's note is explicit: *"The existing backend ... is NOT reused ... removing or replacing the legacy backend code ... rather than carrying it forward"* [Source: _bmad-output/planning-artifacts/epics.md#Epic 2: Foundation & Infra — Existing repo note]. Practically: **Stories 1.1/1.2/1.3 must run (in order) before this story to replace `conversation.entity.ts`/`message.entity.ts` with v2 shapes and to create `src/services/chat.service.ts`, `src/lib/websearch/webSearchTool.ts`, and the interface-only `src/lib/ai/langchain.ts`.** If, at the time this story is implemented, any of those files still contain their legacy pre-Epic-1 content (i.e., Stories 1.1–1.3 have not actually been dev-run yet despite being marked ready-for-dev), do not skip Task 4–7 — instead flag it in Completion Notes and implement this story's own AC #1/#2/#4/#5 fully (the new `src/types` and `schemas.ts` files), applying Tasks 4–7's narrowing only to whichever of those files already have the Story 1.2/1.3 interface shape; leave a Completion Note identifying which files were skipped and why. Do not touch legacy route handlers (`src/app/api/**`) or legacy UI (`src/components/chat/**`) in this story — replacing those is Epic 2/3/6 scope.

**Exact shapes — authoritative source is `02-class.md` view B, cited verbatim:**
```
class ChatRequest {
    +messages: Role content[]
    +model?: string
    +conversationId?: string
}
class ChatResponse {
    +id: string
    +content: string
    +conversationId: string
    +model?: string
}
class Role {
    +user|assistant|system
}
```
[Source: _bmad-output/planning-artifacts/02-class.md#B) Entities & Types]. `messages: Role content[]` is UML shorthand for "an array of `{role, content}` objects" — this story formalizes that as the named `ChatMessage` type (`{ role: Role; content: string }`), reused by both `ChatRequest.messages` and `AiProvider.complete/streamChat`'s `messages` parameter (Story 1.3).

**Why schemas are typed `z.ZodType<T>` against `src/types`, not the reverse:** Two viable designs exist — (a) derive TS types via `z.infer` from schemas (schema is the source of truth), or (b) hand-author TS types and annotate schemas as `z.ZodType<T>` (types are the source of truth, schema is checked against them). This story chooses **(b)** because `02-class.md` view B defines the types independently of any validation library, and the entity/interface files from Stories 1.1–1.3 (`Message.role`, `AiProvider.complete(messages)`, `ChatService.send(req)`) need to reference **plain TypeScript types**, not Zod-inferred types, to avoid every consuming file importing `zod`. `src/types` has zero runtime dependencies (not even Zod); `src/lib/validation/schemas.ts` depends on `src/types` (one-directional). This keeps the layering clean: `types` is the lowest-level shape contract, `validation` is the runtime-enforcement layer built on top of it.

**FR-7's 500-char/200-char-paste rule is deliberately NOT enforced in `ChatMessageSchema`:** FR-20 is about validating *shape* (structural correctness of the request), while FR-7's length rules are a *business rule* enforced by Story 3.7 (`MessageService`/`ChatService` logic converts over-length content to a `.txt` asset before the message is ever persisted). Baking a hard `max(500)` into `ChatMessageSchema.content` would reject requests that Story 3.7 is supposed to transform, not reject. Leave `content: z.string().min(1)` with no upper bound here.

**`WebSearchArgsSchema` and the `run(query)` → `run(args)` resolution:** Story 1.3's `WebSearchTool.run(query)` used `query: string` as a placeholder, with an explicit comment deferring the Zod arg schema to this story [Source: _bmad-output/implementation-artifacts/1-3-integration-module-interface-contracts.md — Task 6]. LangChain structured tools validate a Zod-parsed **object**, not a bare string (`DynamicStructuredTool`'s `schema` validates the full args object passed by the LLM tool-call). This story therefore finalizes the contract as `run(args: WebSearchArgs)` where `WebSearchArgs = { query: string }`, not `run(query: string)` — the earlier signature was intentionally provisional per Story 1.3's own Dev Notes ("Zod-validated input args" per FR-28 implies an args object, not a bare parameter).

**FR references satisfied by this story:**
- FR-20 [Must]: "Inbound requests validated with Zod (`ChatRequestSchema`, `ConversationSchema`, etc.)" — satisfied by Task 2. [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory]
- FR-21 [Must]: "Tightly integrated layered architecture ... services hold use-case logic" — this story supplies the shared type/utils layer every service in Epic 3+ depends on, and narrows Story 1.2's `ChatService` interface to use it (Task 4). [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory]
- FR-28 [Must]: "Tool defined with typed schema (name, description, Zod-validated input args) registered with AiProvider/agent" — satisfied by `WebSearchArgsSchema` + Task 6. [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory]

### Learnings from Stories 1.1 / 1.2 / 1.3 — placeholders this story resolves

- **Story 1.1** (`src/lib/db/entities/message.entity.ts`): flagged that `role`'s inline `"user" | "assistant" | "system"` literal union "is expected to be formalized as a shared `Role` type in Story 1.4" [Source: _bmad-output/implementation-artifacts/1-2-repository-service-interface-definitions.md#Learnings from Story 1.1]. **Resolved by Task 7** — `role: Role` via type-only import.
- **Story 1.2** (`src/services/chat.service.ts`): explicitly used `req: unknown`/`Promise<unknown>` in `ChatService.send`/`stream` "since the concrete `ChatRequest`/`ChatResponse` types are defined in Story 1.4 ... Do not block this story on Story 1.4, and do not invent a competing `ChatRequest` type here" [Source: _bmad-output/implementation-artifacts/1-2-repository-service-interface-definitions.md — Task 6, Dev Notes]. **Resolved by Task 4** — narrowed to `ChatRequest`/`ChatResponse` from `@/types`.
- **Story 1.3** (`src/lib/ai/langchain.ts`): declared a **local** `ChatMessage` interface as an explicit placeholder, "Leave a comment noting this should be narrowed/aligned to a shared `ChatMessage`/`Role` type from `src/types` once Story 1.4 lands" [Source: _bmad-output/implementation-artifacts/1-3-integration-module-interface-contracts.md — Task 1, Dev Notes]. **Resolved by Task 5.**
- **Story 1.3** (`src/lib/websearch/webSearchTool.ts`): declared `run(query: string)` with a comment that "the Zod arg schema (`WebSearchArgsSchema`) is defined in Story 1.4 ... and this tool's real input validation wires to it once that story lands" [Source: _bmad-output/implementation-artifacts/1-3-integration-module-interface-contracts.md — Task 6]. **Resolved by Task 6** — signature changes to `run(args: WebSearchArgs)`.
- All three previous stories flagged `_bmad-output/project-context.md` as a frontend-only doc, non-authoritative for backend/contract work. The same flag applies here — `project-context.md` documents Next.js/React/Tailwind/shadcn/TanStack Query facts only and is silent on `src/types`, `src/lib/validation`, `src/lib/utils.ts` as backend contract locations; `01-package.md`/`02-class.md` remain authoritative. One concrete overlap: `project-context.md` confirms `src/lib/utils.ts` already exists with a shadcn `cn()` helper using `clsx`/`tailwind-merge` — this story's Task 3 must **add to**, not replace, that file.
[Source: _bmad-output/implementation-artifacts/1-1-entity-type-typeorm-decorator-definitions.md] [Source: _bmad-output/implementation-artifacts/1-2-repository-service-interface-definitions.md] [Source: _bmad-output/implementation-artifacts/1-3-integration-module-interface-contracts.md]

**No testing requirement for this story:** Same rationale as Stories 1.1–1.3 — this is Epic 1's contracts-only scope; the testing foundation (Vitest, coverage gate, ≥80% services+repositories) is Story 2.5. Type-level correctness here is enforced by the TypeScript compiler via the `z.ZodType<T>` annotations in AC #3, not by unit tests.

### Project Structure Notes

- Files created/rewritten: `src/types/index.ts` (new), `src/lib/validation/schemas.ts` (rewritten), `src/lib/utils.ts` (extended in place). [Source: _bmad-output/planning-artifacts/01-package.md#2.5 Shared — src/lib, src/types]
- Files deleted: `src/types/chat.ts` (superseded by `src/types/index.ts`).
- Files edited (narrow placeholders only, per AC #6): `src/services/chat.service.ts`, `src/lib/ai/langchain.ts`, `src/lib/websearch/webSearchTool.ts`, `src/lib/db/entities/message.entity.ts`.
- Alignment with `01-package.md`: `src/types` holds `ChatRequest`/`ChatResponse` (2.5), `src/lib/validation/schemas.ts` holds Zod schemas (2.5), `src/lib/utils.ts` holds shared helpers (2.5) — all three paths match the authoritative file tree exactly; no new directories are introduced.
- **Detected conflict (see Dev Notes "Legacy file collision"):** the repo's current `src/lib/validation/schemas.ts`, `src/types/chat.ts`, `src/lib/db/entities/*.entity.ts`, and `src/lib/ai/langchain.ts` are pre-Epic-1 legacy SQLite-app files that do not match the v2 contract — this story (and Stories 1.1–1.3 ahead of it) replace their contents at the same paths; this is expected per the Epic 2 "existing repo note," not a structural variance to escalate.
- **Conflict flag (carried forward from Stories 1.1/1.2/1.3):** `_bmad-output/project-context.md` is frontend-only and silent on `src/types`/`src/lib/validation` as backend contract locations — treat as incomplete, not authoritative, for this story; follow `01-package.md`/`02-class.md`.
- No route handler, migration, UI, or concrete provider logic is touched by this story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4] — Story text, AC, FR-20/FR-21/FR-28 tags
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Types & Contracts] — Epic scope: contracts only, no logic
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2: Foundation & Infra — Existing repo note] — legacy backend replacement, not reuse
- [Source: _bmad-output/planning-artifacts/02-class.md#B) Entities & Types] — `ChatRequest`/`ChatResponse`/`Role` exact shapes (verbatim source of AC #1)
- [Source: _bmad-output/planning-artifacts/01-package.md#2.5 Shared — src/lib, src/types] — file locations for validation/utils/types
- [Source: _bmad-output/planning-artifacts/01-package.md#1. File Tree (authoritative)] — `src/lib/validation/schemas.ts`, `src/lib/utils.ts`, `src/types/` paths
- [Source: _bmad-output/planning-artifacts/05-architecture.md] — layered architecture diagram (types/schemas are shared, cross-cutting)
- [Source: _bmad-output/planning-artifacts/04-requirements.md] (referenced inline via epics.md Requirements Inventory) — FR-20, FR-21, FR-28 text
- [Source: _bmad-output/implementation-artifacts/1-1-entity-type-typeorm-decorator-definitions.md] — `Message.role` placeholder flag, entity file paths
- [Source: _bmad-output/implementation-artifacts/1-2-repository-service-interface-definitions.md] — `ChatService.send/stream` `unknown` placeholder, deferred to this story
- [Source: _bmad-output/implementation-artifacts/1-3-integration-module-interface-contracts.md] — `AiProvider` local `ChatMessage` placeholder, `WebSearchTool.run(query)` placeholder, both deferred to this story
- [Source: _bmad-output/project-context.md] — frontend stack facts; flagged as non-authoritative/incomplete for this story; confirms existing `src/lib/utils.ts` / `cn()` helper

## Dev Agent Record

### Agent Model Used

TBD (populated by dev agent)

### Debug Log References

### Completion Notes List

### File List
