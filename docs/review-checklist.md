# Code Review Checklist

Hard-won lessons from Epic 3 and Epic 4 retrospectives. Run through these before approving any PR.

---

## Cross-Contract Verification
- [ ] For every newly created/updated entity, verify all references to other entities are persisted (foreign keys, reference arrays)
- [ ] For branching/copy operations: verify source rows are UNCHANGED after the fork
- [ ] For any `findById(id, userId)` call: verify it's scoped by conversationId when the context provides one
- [ ] Verify `lastMessageId` references a valid message in the correct conversation

## Lineage & Branching
- [ ] When copying messages: verify fresh UUIDs (not reusing source ids)
- [ ] When copying messages: verify parentId is remapped via oldId→newId map
- [ ] When copying messages: verify createdAt/updatedAt are preserved
- [ ] Verify branch copies are wrapped in a transaction
- [ ] Verify branch's lastMessageId points to the NEW copy of the branch-point message

## Streaming & SSE
- [ ] Verify `X-Accel-Buffering: no` header on SSE routes
- [ ] Verify SSE events have proper event types (not just `data:`)
- [ ] Verify abort/cancel handlers emit `stopped` event

## Status Lifecycle
- [ ] For status transitions: use atomic conditional updates (not check-then-update)
- [ ] Verify status guards reject incorrect states (e.g., regenerate only from 'stopped')

## Error Handling
- [ ] Verify correct HTTP status codes (400 for validation, 404 for not found, 500 only for unexpected)
- [ ] Verify `NotFoundError` is thrown for missing entities, not generic `Error`

## Testing
- [ ] Verify tests use uuid ids (not hardcoded strings) for entity operations
- [ ] Verify tests check BOTH the result AND the source (regression test for source corruption)
- [ ] For mocked repo tests: verify mocks match the actual interface (including new methods)
