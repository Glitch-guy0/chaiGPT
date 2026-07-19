---
title: chaiGPT Implementation Readiness — Issues Log
status: resolved
created: 2026-07-19
updated: 2026-07-19
source_assessment: bmad-check-implementation-readiness
artifacts_reviewed:
  - prds/prd-chaiGPT-2026-07-15/prd.md
  - prds/prd-chaiGPT-2026-07-15/prd-validation-report.md
  - briefs/brief-chaiGPT-2026-07-15/brief.md
  - 01-package.md
  - 02-class.md
  - 03-sequence.md
  - 04-requirements.md
  - 05-architecture.md
  - 06-git.md
  - 07-entity.md
  - 08-object.md
  - 09-component-ishikawa.md
  - epics.md
  - ux-designs/ux-chaiGPT-2026-07-19/DESIGN.md
  - ux-designs/ux-chaiGPT-2026-07-19/EXPERIENCE.md
overall_readiness: READY
---

# chaiGPT — Implementation Readiness Issues

Compiled from the `bmad-check-implementation-readiness` workflow run (Steps 1–6). All planning artifacts were inventoried, the PRD (23 FRs / 7 NFRs) and epics (E1–E6, 30 stories) were cross-validated, UX alignment assessed, and epic quality reviewed. FR coverage is **complete**; the issues below are documentation-consistency, structural, and coverage gaps that should be resolved before or during implementation.

## 1. Document Discovery & Inventory

| Type | File | Status |
|------|------|--------|
| PRD | `prds/prd-chaiGPT-2026-07-15/prd.md` | ✅ approved |
| PRD validation | `prds/prd-chaiGPT-2026-07-15/prd-validation-report.md` | ✅ PASS |
| Brief | `briefs/brief-chaiGPT-2026-07-15/brief.md` | ✅ |
| Architecture (UML) | `01`–`09` (`06-git.md` excluded per user) | ✅ |
| Epics | `epics.md` | ✅ |
| UX design | (none) | ⚠️ see ISSUE-UX-1 |

No whole-vs-sharded duplicates. PRD/Arch/Epics each a single whole document.

---

## 2. Issues (by severity)

### 🔴 Critical

> None blocking. FR/NFR coverage is complete and traceable. The items below are correctness/consistency defects, not missing functionality.

### 🟠 Major

#### ISSUE-DOC-1 — `08-object.md` references a non-canonical provider abstraction
- **Where:** `08-object.md` object diagram
- **Detail:** Shows `LangChainAiProvider` and `Gpt4oMiniStrategy` as runtime instances. The approved integrated model (FR-22, `02-class.md`, `epics.md` E1.3 / E3.4) uses a single thin `AiProvider` module. The user clarified `AiProvider` is implemented as a **LangChain extension wrapping the OpenAI provider** (`ChatOpenAI` via LangChain) — there is no separate `Gpt4oMiniStrategy`/`LangChainAiProvider` class.
- **Impact (resolved):** A dev reading `08-object.md` would have implemented an unused strategy layer. Now corrected to match the approved `AiProvider` (LangChain OpenAI provider) design.
- **Resolution:** ✅ RESOLVED — `08-object.md` rewritten. `AiProvider` is shown as one instance wired into `ChatService`, implemented as a LangChain extension over the OpenAI provider (`ChatOpenAI`); `Gpt4oMiniStrategy` and `LangChainAiProvider` dropped. Aligned with `02-class.md` and `epics.md` E1.3 / E3.4.
- **Action taken:** Updated `08-object.md` (see artifact change below).

#### ISSUE-DOC-2 — `04-requirements.md` REQ text predates the integrated model and is partially stale
- **Where:** `04-requirements.md` (REQ4/REQ5/REQ6, NFR1/NFR2)
- **Detail:** REQ4/REQ5/REQ6 still read as standalone requirements ("Swap AI model via the LangChain AiProvider", "Add KV cache and vector store via Redis and Qdrant"). These overlap FR-22 / FR-14 but are phrased as if AI-swap and caching are the central goals, whereas the PRD now treats them as Should-grade extensibility. NFR text ("SOLID compliance", "Horizontal scale") duplicates NFR-1/NFR-2 but is not linked to the PRD FR numbers. The diagram also never references the `Asset`, `Clerk`, or `branching` concerns.
- **Impact (resolved):** The mermaid requirements diagram under-represented the actual scope. Now corrected to an accurate scope mirror.
- **Resolution:** ✅ RESOLVED — `04-requirements.md` rewritten to map REQ↔FR (FR-1..FR-23), add auth-scoping/branching/asset-lifecycle/per-conversation-RAG requirements, and use integrated-model wording (no port/adapter). NFR entries linked to NFR-1..NFR-7.
- **Action taken:** Updated `04-requirements.md` (see artifact change below).

#### ISSUE-COV-1 — NFR-7 (≥80% service/repository test coverage) has no story
- **Where:** PRD §7 NFR-7; `epics.md` (not covered by any story)
- **Detail:** NFR-7 ("Test coverage of services + repositories ≥ 80%") is a quality gate but no epic/story establishes the test harness, fixtures, or coverage target. E2.2 mentions reversible migrations; nothing mandates the ≥80% bar or where tests live.
- **Impact (resolved):** Acceptance for NFR-7 is now verifiable via an explicit story.
- **Resolution:** ✅ RESOLVED — Added **Story E2.5 "Testing foundation"** to `epics.md` (Vitest setup, repository + service test fixtures, ≥80% coverage gate in CI). NFR-7 now mapped to E2 / Story 2.5.
- **Action taken:** Updated `epics.md` E2 (added Story 2.5) and the FR/NFR coverage matrix (NFR-7 → E2 / 2.5).

### 🟡 Minor

#### ISSUE-STR-1 — Epic 1 (Types & Contracts) is a contracts-only epic with no runtime user value
- **Where:** `epics.md` E1 (Stories 1.1–1.4)
- **Detail:** Per `bmad-create-epics-and-stories` standards, epics should deliver user value, not be technical milestones. E1 defines only types/interfaces/schemas (no behavior). This is intentional per the user's "types/interfaces first" directive, but it is a deviation from the default best-practice that should be explicitly accepted.
- **Impact:** None functionally; flagged for transparency. If a reviewer runs the standard quality check, E1 reads as a technical milestone.
- **Resolution:** ✅ ACCEPTED (no change) — User-approved contract-first ordering; E1 overview already states "No behavior is implemented here."

#### ISSUE-STR-2 — E1.1 entity definitions overlap E2.2 migrations and E3.1 concrete repos
- **Where:** `epics.md` E1.1 vs E2.2 vs E3.1
- **Detail:** E1.1 declares entity *classes with decorators*; E2.2 applies them via migrations; E3.1 implements concrete repositories. Defining decorator-bearing classes in a "contracts-only" story slightly blurs the boundary (decorators imply persistence behavior). Low risk because ordering is sound (E1 → E2 → E3).
- **Impact:** Possible duplicate effort / ambiguity about where the `@Entity()` decorator lives.
- **Resolution:** ✅ ACCEPTED (no change) — Ordering already sound (E1 contract → E2 migration → E3 repos). E1.1 states it declares field shapes + TypeORM decorators as the contract. Optional clarification only.

#### ISSUE-STR-3 — No greenfield Next.js app-scaffold story (existing repo: strip/replace backend)
- **Where:** `epics.md` E2 (assumes `src/` app already exists)
- **Detail:** E2.4 creates the layered *package skeleton*. The repo already has a Next.js 16 App Router skeleton (user confirmed), so no scaffold story is needed. **However**, the existing repo's backend (SQLite/TypeORM `Conversation`/`Message`, flat LangChain streaming, no auth/branching/assets/RAG) is NOT reusable — only the existing UI shell is useful. The plan must be built directly on top of the existing repo, ignoring/replacing the legacy backend rather than reusing it.
- **Impact (resolved):** No scaffold story needed (Option B). But E2 must explicitly state the legacy backend is removed/replaced, not carried forward, to avoid devs reusing dead SQLite code.
- **Resolution:** ✅ RESOLVED — Scaffold story skipped (Next.js skeleton exists). Added a note to `epics.md` E2 that the existing backend is replaced per the integrated plan and only the UI shell is retained.
- **Action taken:** Updated `epics.md` E2 intro (legacy-backend replacement note). No new story.

#### ISSUE-UX-1 — No dedicated UX design document
- **Where:** planning artifacts (no `*ux*.md` / `ux*/` folder)
- **Detail:** The product is user-facing (chat UI, sidebar, branching, asset management), so UX is implied. No bmad-ux DESIGN.md/EXPERIENCE.md existed. UX-DRs were extracted from the brief + PRD instead and are covered by E6 (UX-DR1..UX-DR8 all mapped).
- **Impact (resolved):** UX contract now planned. User chose to produce a bmad-ux DESIGN.md/EXPERIENCE.md spine for the branch-aware UI before implementation.
- **Resolution:** ✅ RESOLVED (in progress) — A bmad-ux run folder `ux-chaiGPT-2026-07-19/` was created under `planning-artifacts/ux-designs/` with `DESIGN.md` (visual identity, design tokens) and `EXPERIENCE.md` (IA, states, interactions, accessibility, journeys) scaffolding. These will be populated from UX-DR1..UX-DR8 and the existing flat UI shell. E6 stories now trace to this contract.
- **Action taken:** Created `planning-artifacts/ux-designs/ux-chaiGPT-2026-07-19/` scaffold; `implementation-issues.md` updated. Population is a follow-up authoring task (not part of readiness fixes).

#### ISSUE-COV-2 — FR-15 (prompt injection) split across E3 and E5 without an owning story
- **Where:** `epics.md` E3.3 (stream) and E5.3 (retrieval)
- **Detail:** FR-15 "retrieved context is injected into the prompt before completion" is satisfied by E3.3 (streaming shell) calling into E5.3 (Qdrant retrieval). Both reference FR-15. This is correct traceability but means FR-15 has no single owning story; it is an integration point between E3 and E5.
- **Impact:** None blocking; integration must be coordinated when E3 and E5 land.
- **Resolution:** ✅ ACCEPTED (no change) — Correct traceability; FR-15 is the E3↔E5 integration seam. No new story needed.

---

## 3. FR / NFR Coverage Matrix (validation result)

| ID | Requirement (short) | Epic | Story | Status |
|----|---------------------|------|-------|--------|
| FR-1 | Clerk integration + `auth()` | E2 | 2.3 | ✅ |
| FR-2 | userId scoping | E1/E3/E4/E5 | 1.2, 3.1, 3.2, 4.1, 5.1 | ✅ |
| FR-3 | 401/redirect unauth | E2/E6 | 2.3, 6.1 | ✅ |
| FR-4 | Conversation v2 fields | E1/E3 | 1.1, 3.2 | ✅ |
| FR-5 | Message v2 fields | E1/E3 | 1.1, 3.1 | ✅ |
| FR-6 | status lifecycle | E3/E6 | 3.3, 6.3 | ✅ |
| FR-7 | 500-char / paste-to-txt | E3/E6 | 3.7, 6.5 | ✅ |
| FR-8 | sibling + rootConversationId | E4 | 4.1 | ✅ |
| FR-9 | branch + sibling sidebar | E4/E6 | 4.1, 6.2 | ✅ |
| FR-10 | edit most-recent sibling | E4 | 4.2 | ✅ |
| FR-11 | edit in-place, no branch | E4 | 4.2 | ✅ |
| FR-12 | asset volume + embed + delete | E5 | 5.1 | ✅ |
| FR-13 | chunking rules | E5 | 5.2 | ✅ |
| FR-14 | per-chunk embed + top-3 conv-scoped | E5 | 5.2, 5.3 | ✅ |
| FR-15 | inject context pre-completion | E3/E5 | 3.3, 5.3 | ✅ (split, see ISSUE-COV-2) |
| FR-16 | preserve + explicit delete | E5/E6 | 5.5, 6.5 | ✅ |
| FR-17 | edit-mode asset refs | E5/E6 | 5.6, 6.5 | ✅ |
| FR-18 | re-runnable stopped | E3/E4 | 3.6, 4.3 | ✅ |
| FR-19 | SSE streaming | E3/E6 | 3.3, 6.3 | ✅ |
| FR-20 | Zod validation | E1 | 1.4 | ✅ |
| FR-21 | layered integrated arch | E1/E2/E3 | 1.2, 1.4, 2.4, 3.x | ✅ |
| FR-22 | AiProvider thin module | E1/E3 | 1.3, 3.4 | ✅ |
| FR-23 | middleware cross-cutting | E1/E2 | 1.3, 2.3 | ✅ |
| NFR-1 | SOLID per layer | E2 | 2.4 | ✅ |
| NFR-2 | horizontal scale / externalized | E1/E5 | 1.3, 5.4 | ✅ |
| NFR-3 | auth <50ms p95 | E2 | 2.3 | ✅ |
| NFR-4 | RAG <300ms p95 | E5 | 5.3 | ✅ |
| NFR-5 | TTFT <1s | E3 | 3.3 | ✅ |
| NFR-6 | reversible migrations | E2 | 2.2 | ✅ |
| NFR-7 | ≥80% coverage | E2 | 2.5 | ✅ |

**Coverage: 23/23 FR covered, 7/7 NFR covered.**

---

## 4. UX-DR Coverage Matrix

| UX-DR | Epic | Story | Status |
|-------|------|-------|--------|
| UX-DR1 Clerk-gated shell | E6 | 6.1 | ✅ |
| UX-DR2 branch-aware sidebar | E6 | 6.2 | ✅ |
| UX-DR3 live streaming view | E6 | 6.3 | ✅ |
| UX-DR4 markdown rendering | E6 | 6.3 | ✅ |
| UX-DR5 paste-to-txt asset | E6 | 6.5 | ✅ |
| UX-DR6 edit/regenerate controls | E6 | 6.4 | ✅ |
| UX-DR7 edit-mode asset refs | E6 | 6.5 | ✅ |
| UX-DR8 asset lifecycle UI | E6 | 6.5 | ✅ |

---

## 5. Epic Quality Review (best-practice check)

| Check | Result | Note |
|-------|--------|------|
| Epic delivers user value | ⚠️ E1 partial | Contract-first, user-approved (ISSUE-STR-1) |
| Epic independence | ✅ | E1→E2→E3/E4/E5→E6, forward-only |
| No forward story deps | ✅ | Stories build on previous only |
| Story sizing | ✅ | All single-dev sized |
| Given/When/Then ACs | ✅ | All stories formatted |
| DB created when needed | ✅ | E2.2 migrations first needed use |
| Starter template | ✅ | Skeleton exists; legacy backend replaced per E2 note (ISSUE-STR-3) |
| Traceability to FRs | ✅ | Every story cites FRs/NFRs |

---

## 6. Summary & Recommended Actions

**Overall readiness: READY** — all 3 Major issues and all Minor issues resolved. Coverage is 23/23 FR and 7/7 NFR. Artifacts updated: `08-object.md`, `04-requirements.md`, `epics.md` (E2.5 + E2 legacy-backend note), and a new bmad-ux contract scaffold.

| Issue | Severity | Resolution |
|-------|----------|------------|
| ISSUE-DOC-1 | Major | ✅ `08-object.md` rewritten — `AiProvider` = LangChain extension over OpenAI `ChatOpenAI` |
| ISSUE-DOC-2 | Major | ✅ `04-requirements.md` rewritten — REQ↔FR (FR-1..FR-23), integrated-model wording |
| ISSUE-COV-1 | Major | ✅ Added `epics.md` E2.5 "Testing foundation" (Vitest + ≥80% CI gate) |
| ISSUE-STR-1 | Minor | ✅ ACCEPTED (contract-first, user-approved) |
| ISSUE-STR-2 | Minor | ✅ ACCEPTED (ordering sound; optional clarification) |
| ISSUE-STR-3 | Minor | ✅ Scaffold skipped; legacy backend replaced per E2 note |
| ISSUE-UX-1 | Minor | ✅ bmad-ux `DESIGN.md`/`EXPERIENCE.md` scaffold created (to be populated) |
| ISSUE-COV-2 | Minor | ✅ ACCEPTED (FR-15 = E3↔E5 seam, no new story) |

**Follow-up (not blocking):** Populate the bmad-ux `DESIGN.md`/`EXPERIENCE.md` from UX-DR1..UX-DR8 before E6 implementation.
