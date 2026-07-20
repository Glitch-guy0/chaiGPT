# Story 3.7: 500-Char Limit & Large-Paste-to-TXT

Status: ready-for-dev

## Story

As a user,
I want a 500-character cap and auto-conversion of long pastes to a `.txt` asset,
So that I stay within limits and keep long content as an asset.

## Acceptance Criteria

1. **Given** a message draft (typed or pasted) in the composer, **When** its total length exceeds the 500-character hard cap **or** a single paste operation exceeds 200 characters, **Then** the over-length content is converted into a `.txt` asset and uploaded via `AssetRepository`/`AssetService.ingest`, and the outgoing message references that asset (FR-7, UX-DR5).

2. **Given** the over-length content was converted to a `.txt` asset, **When** the message is sent, **Then** the inline message body (`Message.content`) stays within the 500-character limit — the converted blob is referenced, not inlined (FR-7).

3. **Given** a paste of more than 200 characters (but the remaining composed text is still ≤ 500 chars), **When** the user sends, **Then** the pasted block is extracted to a `.txt` asset while the inlined remainder continues to be a normal message body (FR-7, UX-DR5).

4. **Given** a message that is entirely composed of typed characters (no paste event) and stays ≤ 500 chars, **When** sent, **Then** it is persisted as a normal message body with no asset conversion (confirming the 200-char rule applies to paste detection, not total length).

5. **Given** a draft that *combines* typed text plus a paste, **When** a paste segment > 200 chars is detected, **Then** only the pasted segment is extracted to a `.txt` asset and the typed text remains inline, provided the inline residue ≤ 500 chars; otherwise the leftover inline text is further capped/indicated (FR-7).

6. **Given** an asset was created by this conversion, **When** the message is persisted, **Then** the message carries a reference to the asset (e.g. `Message.assets`/`assetIds` linked by `Asset.id`, `userId`, `conversationId`) so the reference is rendered in the UI and survives the send (FR-12, UX-DR5).

7. **Given** the conversion/upload cannot complete (e.g. repo failure), **When** the user attempts to send, **Then** the send is blocked or surfaced with a clear error rather than silently dropping the over-length content (graceful failure, consistent with FR-12 upload semantics).

## Tasks / Subtasks

- [ ] **Task 1 — Detect paste vs typed input (AC: #4, #5)** (refs: epics.md L34 FR-7, L96 UX-DR5)
  - [ ] Subtask 1.1: Capture paste events in the composer (clipboard `onPaste` / `paste` event) separately from `onChange` typed input, so a paste of > 200 chars is identifiable vs. gradual typing.
  - [ ] Subtask 1.2: Define the **200-char paste heuristic**: a `paste` event whose inserted text length > 200 chars triggers conversion; typed input is evaluated only against the **500-char hard cap**.
  - [ ] Subtask 1.3: For mixed drafts, track which spans originated from a paste so only the pasted span is extracted (preserve typed inline text).

- [ ] **Task 2 — Extract over-length / pasted content (AC: #1, #3, #5)** (refs: epics.md L467–468)
  - [ ] Subtask 2.1: Implement a client-side preprocessing util (e.g. `lib/utils.ts` or a new `services/transform` helper) that, given a draft + paste metadata, splits content into (a) inline remainder and (b) extracted blob(s) to become `.txt` assets.
  - [ ] Subtask 2.2: If total length > 500 chars with no single paste > 200 chars (pure typing), split the overflow (chars 501+) into a `.txt` asset and keep first 500 inline.
  - [ ] Subtask 2.3: If a paste > 200 chars, extract that pasted span to a `.txt` asset; keep any typed residue inline (capped at 500).

- [ ] **Task 3 — Create `.txt` asset via AssetRepository/upload (AC: #1, #6)** (refs: epics.md L186 Asset entity, L200–201 AssetRepository interface, L374 3.1 `save`/`findByConversation`/`delete`, L530 5.1 `AssetService.ingest`)
  - [ ] Subtask 3.1: Build the `.txt` asset payload: derive `filename` (e.g. `pasted-<timestamp>.txt`), `mime = "text/plain"`, `conversationId`, `userId`.
  - [ ] Subtask 3.2: Call `AssetRepository.save` / `AssetService.ingest(userId, convId, file)` to persist the `Asset` row (`id`, `userId`, `conversationId`, `filename`, `mime`, `path`) per the E1 `Asset` contract — this story performs the **minimal** upload (persist the asset row + stage file); full staging-to-volume + LangChain embed + delete-original lives in Epic 5 Story 5.1 (note explicitly).
  - [ ] Subtask 3.3: Return the created `Asset.id` to attach as a message reference.

- [ ] **Task 4 — Reference the asset from the message (AC: #1, #6)** (refs: epics.md L184 Message entity shape, L468)
  - [ ] Subtask 4.1: Attach the asset reference (assetIds / `Message.assets`) to the outgoing `ChatRequest` so `ChatService.send` persists the link on the `Message`.
  - [ ] Subtask 4.2: Ensure UI render shows the asset reference chip in the sent message (cross-ref Story 6.5 UX-DR5).

- [ ] **Task 5 — Enforce 500-char inline cap (AC: #2, #3, #4)** (refs: epics.md L34 FR-7, L470)
  - [ ] Subtask 5.1: After extraction, assert `Message.content.length <= 500`; truncate/indicate and convert remainder to a `.txt` asset if exceeded.
  - [ ] Subtask 5.2: Validate the cap both client-side (pre-send) and server-side in `ChatService.send` / `ChatRequestSchema` (E1 1.4) so the hard cap is enforced even if a client bypasses the UI.

- [ ] **Task 6 — Validation & graceful failure (AC: #7)** (refs: epics.md L468 FR-7, L530 5.1)
  - [ ] Subtask 6.1: If asset creation/upload fails, surface a clear error and prevent silent content loss.
  - [ ] Subtask 6.2: Add Zod guard(s) to `ChatRequestSchema` (E1 1.4) confirming `content` length ≤ 500 when no asset references are present.

- [ ] **Task 7 — Tests (AC: all)** (refs: epics.md L29–34 FR-29/30/31, NFR-7/8)
  - [ ] Subtask 7.1: Unit tests (Vitest, colocated `*.test.ts`) for the preprocessing/transform util — paste-vs-typed detection, 200-char threshold, 500-char cap, split/extract behavior. Mock `AssetRepository`/`AssetService` (externals mocked, offline).
  - [ ] Subtask 7.2: Unit test that `ChatService.send` rejects/trims a > 500-char inline body without asset refs (server-side enforcement).
  - [ ] Subtask 7.3: Coverage of this logic counts toward the ≥80% services+repositories gate (FR-31, NFR-7); mock OpenAI/LangChain/Clerk so tests run offline (FR-30, NFR-8).

## Dev Notes

- **Nature of the change:** This is a **client-side / pre-send transform** that prepares the draft before `ChatService.send`. It is NOT the RAG embedding pipeline. It collaborates with the asset upload path but performs only the minimal asset creation needed to reference long content; the full volume-staging + LangChain embed + delete-original flow is Epic 5 Story 5.1 (FR-12). Keep concerns separate per NFR-1 (single responsibility per layer).

- **Two distinct thresholds (clarify):**
  - **200-char paste heuristic** — triggers conversion when a *single paste event* inserts > 200 characters. This is a UX affordance (UX-DR5) so users don't have to manually attach a long paste; it applies to detected paste content, not total draft length.
  - **500-char hard cap** — the absolute maximum length of the inline `Message.content`. Anything beyond 500 (whether from a paste ≤ 200 chars repeated, or pure typing) must be extracted to a `.txt` asset. The inline body must never exceed 500.

- **Where the logic lives:**
  - Draft detection/transform: composer component (`"use client"`) captures paste events; a shared preprocessing util in `lib/utils.ts` or new `services/transform` performs split/extract (pure function, easily unit-tested).
  - Asset creation: delegate to `AssetRepository.save` / `AssetService.ingest` (defined in E1 Story 1.2 and implemented in Story 3.1). This story depends on **Story 3.1 (concrete `AssetRepository`)** being available.
  - Send-time enforcement: `ChatService.send(req, userId)` validates and persists; `ChatRequestSchema` (E1 Story 1.4) enforces the cap server-side.
  - UI reference rendering: Story 6.5 (Epic 6) renders the asset reference chip.

- **Architecture / layering (FR-21, NFR-1):** `app` (composer/route handler) → `services` (`ChatService`, `AssetService`) → `repositories`/integration modules. No port/adapter abstraction. Route handlers stay stateless; asset rows enforce logical user isolation at the DB layer via `Asset.userId` (FR-12) — NOT at the volume level.

- **Asset entity contract (E1 Story 1.1, epics.md L186):** `Asset` = `id`, `userId`, `conversationId`, `filename`, `mime`, `path`, `createdAt`. For this story: `mime = "text/plain"`, `filename` derived, `path` set by minimal upload.

- **AssetRepository contract (E1 Story 1.2, epics.md L200–201, L374):** declares `findById(id, userId)`, `findAll(userId)`, `save`, `updateStatus(id, status)`; Story 3.1 adds `save`, `findByConversation`, `delete` (FR-12). Use `save` to persist the converted `.txt` asset.

- **Message entity contract (E1 Story 1.1, epics.md L184):** `Message` = `id`, `conversationId`, `userId`, `parentId?`, `role`, `content`, `model?`, `status`, `createdAt`. `content` is the inline body (≤ 500). Asset linkage carried via reference (assetIds / `Message.assets`).

- **Testing standards (FR-29/30/31, NFR-7/8):** Vitest, colocated `*.test.ts`; mock OpenAI/LangChain/Qdrant/Jina/Clerk so tests run offline/deterministically; ≥80% coverage gate on services+repositories enforced in CI.

### Project Structure Notes

- **Alignment:** Composer detection belongs in the existing `app/` chat UI (client component). The pure transform util should sit in `lib/utils.ts` or `services/transform` to stay framework-free and unit-testable, matching the shared `lib/utils` + `services` layout from `01-package.md` (epics.md L242, L312). Asset persistence reuses the E1/E3 `AssetRepository`/`AssetService` — no new repository required.
- **Conflicts / variances:** There is a conceptual overlap with Epic 5 asset upload (Story 5.1). Resolution: Story 3.7 does **minimal** asset creation (persist row + stage file) and explicitly hands the full embed/delete pipeline to Epic 5. This story must NOT embed or chunk the pasted content (chunking/embedding is FR-13/FR-14, Epic 5). The pasted `.txt` is stored as a referenceable asset, not yet a RAG source, unless Epic 5 ingestion is later triggered.
- **Thresholds:** Enforce both client- and server-side to satisfy FR-7 even if a client is bypassed; the 200-char rule is paste-event detection only.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3 Story 3.7] — FR-7 requirement, AC lines L458–471.
- [Source: _bmad-output/planning-artifacts/epics.md#FR-7] — "Max 500 characters per message; paste > 200 chars -> converted to `.txt` asset and uploaded." (L34).
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR5] — "On paste > 200 chars, convert to a `.txt` asset and show as an asset reference in the message." (L96).
- [Source: _bmad-output/planning-artifacts/epics.md#E1 Story 1.1] — `Asset` entity shape (L186), `Message` entity shape (L184).
- [Source: _bmad-output/planning-artifacts/epics.md#E1 Story 1.2] — `AssetRepository` interface (`findById`, `findAll`, `save`, `updateStatus`) (L200–201).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3 Story 3.1] — concrete `AssetRepository` implements `save`, `findByConversation`, `delete` (L374).
- [Source: _bmad-output/planning-artifacts/epics.md#E1 Story 1.4] — `ChatRequestSchema` Zod validation (L238).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5 Story 5.1] — full asset upload pipeline (volume + embed + delete original) — OUT OF SCOPE for this story (L520–534).
- [Source: _bmad-output/planning-artifacts/epics.md#FR-12] — Asset stored with `userId`/`conversationId`/`filename`/`mime`/`path`; logical isolation at DB layer (L39).
- [Source: _bmad-output/planning-artifacts/epics.md#FR-29/30/31, NFR-7/8] — testing standards (Vitest, colocated, mocked externals, ≥80% coverage).
- [Source: _bmad-output/project-context.md#Technology Stack] — Next.js 16 App Router, `"use client"` for interactive components, `app/api/` route handlers, `@/*` path alias.

## Dev Agent Record

### Agent Model Used

subagent

### Debug Log References

TODO

### Completion Notes List

TODO

### File List

TODO
