# Story 5.4: Redis KV Cache for RAG Context Reuse

Status: ready-for-dev

## Story

As a Maintainer,
I want a Redis cache for RAG context keyed by conversation,
so that repeated retrieval is fast and stateless handlers scale.

## Acceptance Criteria

1. Given `lib/cache/redis.ts` implementing the E1 `RedisCache` contract
   When `ChatService` requests context for a conversation
   Then a cache hit returns stored context; on miss it embeds + searches Qdrant and caches with a TTL (03-sequence #6)

2. And route handlers remain stateless and stores externalized (NFR-2)

## Tasks / Subtasks

### T1: Redis Client Implementation (AC1, AC2)
- **T1.1** In `src/lib/cache/redis.ts`, implement `RedisClient` class satisfying the `RedisCache` interface (`get`, `set`).
- **T1.2** Use `ioredis` (already a dependency — see `package-lock.json`). Create a singleton `RedisClient` that reads `REDIS_URL` from env (default `redis://localhost:6379`).
- **T1.3** Implement `get(key: string): Promise<string | null>` — return the raw string value or `null` on miss.
- **T1.4** Implement `set(key: string, value: string, ttl: number): Promise<void>` — call `redis.setex(key, ttl, value)` for TTL-based expiry.
- **T1.5** Export a `getRedisClient()` factory function that lazily initializes the singleton. Throw a descriptive error if `REDIS_URL` is missing in production (allow undefined in test).
- **T1.6** Add a `disconnect()` method for graceful shutdown in tests and Docker stop.

### T2: Cache Key Strategy & Serialization (AC1)
- **T2.1** Define the cache key pattern: `"ctx:" + convId` (e.g., `"ctx:abc-123"`). Export a `cacheKey(convId: string): string` helper.
- **T2.2** Define serialization: `JSON.stringify(hits: Hit[])` for write, `JSON.parse` for read. Type the cached value as `Hit[]` (import from `src/lib/vector/qdrant.ts`).
- **T2.3** Implement `serializeHits(hits: Hit[]): string` and `deserializeHits(raw: string): Hit[] | null` utility functions. `deserializeHits` returns `null` on parse failure (corrupted cache) instead of throwing.
- **T2.4** Add a configurable TTL constant: `CACHE_TTL_SECONDS = 600` (10 minutes). Export from a config module or read from env `REDIS_CACHE_TTL`.

### T3: ChatService Cache Integration (AC1, AC2)
- **T3.1** In `ChatServiceImpl.send()`, before the existing `qdrantStore.embed()` call (line 97 of current `chat.service.ts`), check the cache:
  ```
  const key = cacheKey(parsed.conversationId);
  const cached = await this.redisCache?.get(key);
  ```
- **T3.2** On cache hit: parse `JSON.parse(cached)` into `Hit[]`, skip embed+search, proceed directly to prompt injection. Log `"cache hit for convId"`.
- **T3.3** On cache miss (or `redisCache` is undefined): fall through to the existing embed → search flow. After receiving `Hit[]` from `qdrantStore.search()`, write to cache:
  ```
  await this.redisCache?.set(key, JSON.stringify(hits), CACHE_TTL_SECONDS);
  ```
  Log `"cache miss — embedded + searched for convId"`.
- **T3.4** Ensure the cache write is fire-and-forget with error swallowing — a Redis write failure must not break the chat flow. Wrap `set()` in try/catch, log warning on failure.
- **T3.5** Ensure `get()` failures also degrade gracefully: catch errors, log warning, fall through to the miss path (embed+search).
- **T3.6** The `ChatServiceImpl` constructor already accepts `redisCache?: RedisCache`. No constructor changes needed — just wire the real client in the route handler.

### T4: Route Handler Wiring (AC2)
- **T4.1** In `src/app/api/chat/route.ts`, import `getRedisClient` from `src/lib/cache/redis.ts`.
- **T4.2** Replace the `undefined` placeholder at line 46 (`// redisCache — wire when Story 5.4 lands`) with the real Redis client instance.
- **T4.3** The route handler remains stateless — the Redis client is a shared singleton, not per-request state. Each request uses the same client connection pool. This satisfies NFR-2.
- **T4.4** Do NOT instantiate a new Redis connection per request. The singleton pattern ensures connection reuse.

### T5: Cache Invalidation (AC1)
- **T5.1** When a new asset is uploaded to a conversation (in `AssetService.ingest()` or the asset route), invalidate the cache for that conversation:
  ```
  await redisCache.del("ctx:" + conversationId);
  ```
- **T5.2** Add a `del(key: string): Promise<void>` method to the `RedisCache` interface in `src/lib/cache/redis.ts`. Implement it in `RedisClient` using `redis.del(key)`.
- **T5.3** If asset upload is in a different service/route that doesn't have direct access to `RedisCache`, export a standalone `invalidateRagCache(convId: string)` function that calls `getRedisClient().del(cacheKey(convId))`.
- **T5.4** Graceful degradation: if `del()` fails, log a warning but don't fail the upload. The cache will expire naturally via TTL.

### T6: Edge Cases
- **T6.1** **Cache stampede**: Multiple concurrent requests for the same convId with a cold cache. All will miss, all will embed+search, all will write. This is acceptable for now — the cost is duplicate embedding calls, not corruption. Document this as a known limitation. Future optimization: use Redis `SETNX` with a short lock TTL, or a request coalescing pattern.
- **T6.2** **Corrupted cache value**: If `JSON.parse` fails in `deserializeHits`, return `null` (treat as miss). Log a warning. The next request will re-embed and overwrite.
- **T6.3** **TTL expiration mid-conversation**: If the 10-minute TTL expires while the user is still chatting, the next message will re-embed. This is intentional — it keeps context fresh without unbounded memory growth.
- **T6.4** **Redis unavailable**: If Redis is down, all operations throw. The try/catch in T3.4/T3.5 ensures the chat flow degrades to the no-cache path (embed+search every time). Log an error-level message `"Redis unavailable — falling back to uncached RAG"`.
- **T6.5** **Conversation deleted**: Cache entries for deleted conversations will expire via TTL. No explicit invalidation needed on conversation delete.
- **T6.6** **Branch inheritance**: When a conversation is branched (Story 4.3), the new branch gets a new `convId`. It starts with a cold cache, which is correct — the branch may have different linked assets.
- **T6.7** **Large Hit[] payloads**: If the cached JSON exceeds Redis's 512MB value limit (unlikely — even 1000 hits would be ~500KB), the `set()` will fail. Log the error, degrade gracefully. Not a realistic concern for k=3.

### T7: Docker Compose — Redis Service
- **T7.1** Add a `redis` service to `infra/docker-compose.yml`:
  ```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      <<: *healthcheck-defaults
    networks:
      - chaigpt_net
  ```
- **T7.2** Add `REDIS_URL=redis://redis:6379` to the `app` service environment.
- **T7.3** Add `depends_on: redis: condition: service_healthy` to the `app` service.
- **T7.4** Add a `chaigpt_redis` volume if persistence is desired (optional — cache is ephemeral).
- **T7.5** Update `infra/docker-compose.e2e.yml` to include the Redis service for e2e tests.

### T8: Testing
- **T8.1** Unit test `RedisClient`: mock `ioredis` with `ioredis-mock` or a hand-rolled mock. Test `get` returns `null` on miss, returns value on hit. Test `set` stores with TTL. Test `del` removes key.
- **T8.2** Unit test `serializeHits` / `deserializeHits`: verify round-trip, verify `deserializeHits` returns `null` on malformed JSON.
- **T8.3** Unit test `cacheKey`: verify it produces `"ctx:" + convId`.
- **T8.4** Integration test `ChatService.send()` with mocked `RedisCache` (use existing `MockRedisCache` from `tests/fixtures/mock-redis-cache.ts`):
  - Test cache hit: pre-populate mock, verify embed+search is NOT called.
  - Test cache miss: empty mock, verify embed+search IS called, verify result is cached.
  - Test cache write failure: mock `set` to throw, verify chat still succeeds.
  - Test cache read failure: mock `get` to throw, verify chat falls through to embed+search.
- **T8.5** Add `del` method to `MockRedisCache` in `tests/fixtures/mock-redis-cache.ts` so integration tests can test invalidation.
- **T8.6** Test cache invalidation: upload an asset, verify the cache key is deleted.

## Dev Notes

### Sequence Diagram Reference
The cache flow follows sequence diagram #6 from `03-sequence.md`:
```
RedisCache.get("ctx:"+convId) → miss → VEC.embed → VEC.search(k=3) → CACHE.set
```
On hit, the embed+search steps are skipped entirely.

### Existing Code Context
- `RedisCache` interface already defined at `src/lib/cache/redis.ts:1-4` with `get` and `set` signatures.
- `ChatServiceImpl` already accepts `redisCache?: RedisCache` as constructor param (`src/services/chat.service.ts:29`).
- `RedisCache` is already imported in `chat.service.ts:8`.
- Route handler at `src/app/api/chat/route.ts:46` has a placeholder `undefined` waiting for this story.
- `MockRedisCache` exists at `tests/fixtures/mock-redis-cache.ts` — needs `del` method added.
- `Hit[]` type from `src/lib/vector/qdrant.ts:3-6` is the cached payload.

### Cache Key Pattern
```
ctx:{conversationId}
```
Example: `ctx:a1b2c3d4-e5f6-7890-abcd-ef1234567890`

### TTL Strategy
- Default: 600 seconds (10 minutes)
- Configurable via `REDIS_CACHE_TTL` env var
- Rationale: balances freshness (re-embed when assets change) against cost (skip redundant embedding calls)

### Serialization
- Write: `JSON.stringify(hits)` where `hits` is `Hit[]`
- Read: `JSON.parse(raw)` → `Hit[]` or `null` on parse failure
- Type safety: `deserializeHits` returns `Hit[] | null`, never throws

### Redis Connection
- Library: `ioredis` (already in `package-lock.json`)
- Singleton pattern: one connection per process, shared across requests
- `REDIS_URL` env var: default `redis://localhost:6379`
- Health check: `redis-cli ping` returns `PONG`

### Invalidation Points
- **Asset upload** → `del("ctx:" + convId)` — new asset changes the retrieval corpus
- **Conversation delete** → no explicit invalidation needed — TTL handles it
- **Branch creation** → no invalidation — new branch has its own convId and starts cold

### Performance Expectations
- Cache hit: ~2-5ms (Redis GET + JSON.parse)
- Cache miss: ~100-200ms (embed ~100ms + search ~30ms + Redis SET ~2ms)
- Without cache (Story 5.3 baseline): ~130ms per request
- With cache on repeated queries: ~5ms → 25x faster

### Dependencies on Prior Stories
- **Story 5.3**: Provides the embed+search flow that this story wraps with caching. Without 5.3, there's nothing to cache.
- **Story 5.1/5.2**: Assets must be chunked and embedded in Qdrant for search to return results.
- **Story 4.3**: Branch-aware conversation resolution ensures the correct `convId` is used for cache keys.

### Docker Infrastructure
Redis needs to be added to `infra/docker-compose.yml` alongside existing `db` (Postgres) and `qdrant` services. Use `redis:7-alpine` for minimal image size. Add health check with `redis-cli ping`.

### Files to Create
- None — all changes are to existing files.

### Files to Modify
- `src/lib/cache/redis.ts` — implement `RedisClient`, add `del()`, add `getRedisClient()`, add `cacheKey()`, add `serializeHits()`/`deserializeHits()`
- `src/services/chat.service.ts` — add cache check/write logic in `send()` method (lines 95-109)
- `src/app/api/chat/route.ts` — wire real Redis client (line 46)
- `infra/docker-compose.yml` — add Redis service
- `infra/docker-compose.e2e.yml` — add Redis service for e2e
- `tests/fixtures/mock-redis-cache.ts` — add `del()` method

### Testing Approach
- **Framework**: Vitest (project standard from Story 2.5)
- **Mock strategy**: `MockRedisCache` (in-memory Map) for unit tests; `ioredis-mock` for integration tests
- **Key tests**: cache hit skips embed+search, cache miss triggers embed+search and caches, failures degrade gracefully, invalidation deletes key

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled by dev agent)

### Completion Notes List
(To be filled by dev agent)

### File List
(To be filled by dev agent)

### Review Findings

- [x] [Review][Patch] Cache invalidation missing on asset delete — DELETE /api/assets/[id] doesn't call invalidateRagCache. [src/app/api/assets/[id]/route.ts:26-27] — fixed
- [x] [Review][Patch] Cache invalidation missing on removeAssetFromMessage — stale RAG context persists. [src/services/message.service.ts:111-119] — fixed (cache invalidated at DELETE route level after asset removal)
- [x] [Review][Patch] deserializeHits has no schema validation — stale schema after deploy propagates corrupted data. [src/lib/cache/redis.ts:20-27] — fixed
- [x] [Review][Patch] Redis singleton never cleaned up on process exit — delayed deploys. [src/lib/cache/redis.ts:29-52] — fixed (SIGINT/SIGTERM handlers added)
- [x] [Review][Defer] getRedisClient throws in test environments without REDIS_URL — test env concern. [src/lib/cache/redis.ts:35-38]
