---
title: chaiGPT Sprint Change Proposal — Web Search (Jina) + Testing Strategy
status: approved
created: 2026-07-19
trigger: PRD Update 2 (FR-24..FR-34, NFR-8..NFR-10, G7/G8, US-12/US-13)
scope: Major
artifacts_modified:
  - epics.md
  - 01-package.md
  - 02-class.md
  - 03-sequence.md
  - 05-architecture.md
  - 07-entity.md
  - 08-object.md
  - 09-component-ishikawa.md
---

# Sprint Change Proposal — Web Search (Jina) + Testing Strategy

## 1. Issue Summary

The PRD was extended (Update 2) with live web search via the Jina AI API, exposed as a LangChain tool, plus a detailed testing strategy (Vitest unit + Playwright e2e). The epic breakdown and UML artifacts did not yet reflect these requirements, so implementation stories and architecture diagrams were out of sync with the approved PRD.

## 2. Impact Analysis

- **Epic Impact:** New Epic 7 (Web Search) added. E1 (contracts), E2 (infra/testing), E3 (streaming/agent), E6 (UI citations) extended.
- **Story Impact:** +1 epic, +4 new stories (7.1, 7.2, 7.3, 2.6), +extensions to 1.3, 1.4, 2.5, 3.3, 3.4, 6.3.
- **Artifact Conflicts:** All 7 UML diagrams updated to include `lib/websearch`, `JinaProvider`, `WebSearchTool`, and a Testing node.
- **Technical Impact:** New `lib/websearch/` package, `JINA_API_KEY` env, Playwright e2e pipeline against Docker Compose, Vitest coverage gate.

## 3. Recommended Approach

Direct Adjustment — extend the existing plan and diagrams (no rollback, no MVP scope cut). Effort: low (planning artifacts only). Risk: low. All new FR IDs (FR-24..FR-34) slot cleanly after existing ones.

## 4. Detailed Change Proposals

### Epics (`epics.md`)
- Inventory: added FR-24..FR-34, NFR-8..NFR-10.
- FR Coverage Map: added 11 rows (FR-24→E1/E7 … FR-34→E2).
- Epic List: added E7.
- E1: Story 1.3 adds `WebSearchProvider.search` + `WebSearchTool.run`; Story 1.4 adds `WebSearchArgsSchema`.
- E2: Story 2.5 extended (FR-29/30/31, NFR-8); new Story 2.6 (Playwright e2e).
- E3: Story 3.3 injects Jina context; Story 3.4 registers `WebSearchTool`.
- E6: Story 6.3 cites web-source URLs.
- E7: Stories 7.1 (JinaProvider), 7.2 (WebSearchTool), 7.3 (Web Context Injection).

### UML Diagrams
- `01-package.md`: `lib/websearch/`, `tests/`, `e2e/` added.
- `02-class.md`: `WebSearchProvider`, `JinaProvider`, `WebSearchTool`, `WebResult`, mock doubles.
- `03-sequence.md`: web-search sequence + CI test pipeline sequence.
- `05-architecture.md`: websearch integration node + Testing cross-cutting node.
- `07-entity.md`: note — no new entity (WebResult ephemeral).
- `08-object.md`: runtime objects + test subgraph.
- `09-component-ishikawa.md`: Web Search + Testing components; latency/coverage risk bones.

## 5. Implementation Handoff

- **Scope:** Major (fundamental plan extension) → routed to Developer agent for story execution.
- **Success criteria:** E7 stories + E2.6 implementable; UML diagrams render; existing FR-1..FR-23 IDs unchanged (verified).
- **Next:** Begin Phase 4 implementation in order E1 → E2 → E3 → E4 → E5 → E6 → E7; add `JINA_API_KEY` to `.env.example`.
