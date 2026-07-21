# Deferred Work

## Deferred from: code review of Epic 5 (2026-07-21)

- Redis connection without TLS — deployment config issue, not a code bug. [src/lib/cache/redis.ts:41]
- Path traversal in asset storage — paths are server-generated with randomUUID, not user input. [src/services/asset.service.impl.ts:30]
- No rate limiting on asset upload — needs API gateway/rate limiter layer, not application code. [src/app/api/assets/route.ts:79]
- Duplicate qdrant.test.ts in two locations — test consolidation, not a code bug. [src/lib/vector/qdrant.test.ts, src/lib/vector/__tests__/qdrant.test.ts]
- Branch-awareness not verified in RAG search — uses parsed.conversationId directly without branch resolution. [src/services/chat.service.ts:100-101]
- RAG context marker injection — crafted asset content could manipulate LLM context boundaries. [src/lib/rag/inject.ts:21]
- getRedisClient throws in test environments without REDIS_URL — test env concern. [src/lib/cache/redis.ts:35-38]
- Missing asset preservation regression test — spec requires explicit test. [N/A]
- Missing concurrent collection handling test — no test for ensureCollection race behavior. [N/A]
- useAssetMetadata has zero test coverage — needs MSW-based test. [N/A]
- Cache tests don't verify TTL expiry — MockRedisCache ignores TTL. [N/A]
