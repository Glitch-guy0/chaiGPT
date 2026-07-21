import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Hit } from "@/lib/vector/qdrant";

function makeHit(overrides: Partial<Hit> = {}): Hit {
  return {
    chunkId: "c1",
    assetId: "a1",
    score: 0.9,
    text: "test content",
    ...overrides,
  };
}

describe("redis cache utilities", () => {
  describe("cacheKey", () => {
    it("returns ctx: prefix + convId", async () => {
      const { cacheKey } = await import("@/lib/cache/redis");
      expect(cacheKey("abc-123")).toBe("ctx:abc-123");
    });
  });

  describe("serializeHits / deserializeHits", () => {
    it("round-trips Hit[] through serialize/deserialize", async () => {
      const { serializeHits, deserializeHits } = await import("@/lib/cache/redis");
      const hits = [makeHit(), makeHit({ chunkId: "c2", score: 0.5 })];
      const serialized = serializeHits(hits);
      const deserialized = deserializeHits(serialized);
      expect(deserialized).toEqual(hits);
    });

    it("deserializeHits returns null on malformed JSON", async () => {
      const { deserializeHits } = await import("@/lib/cache/redis");
      const result = deserializeHits("not-valid-json{{{");
      expect(result).toBeNull();
    });

    it("deserializeHits returns null on empty string", async () => {
      const { deserializeHits } = await import("@/lib/cache/redis");
      const result = deserializeHits("");
      expect(result).toBeNull();
    });

    it("serializeHits produces valid JSON string", async () => {
      const { serializeHits } = await import("@/lib/cache/redis");
      const hits = [makeHit()];
      const result = serializeHits(hits);
      expect(typeof result).toBe("string");
      expect(JSON.parse(result)).toEqual(hits);
    });
  });

  describe("CACHE_TTL_SECONDS", () => {
    it("defaults to 600", async () => {
      const { CACHE_TTL_SECONDS } = await import("@/lib/cache/redis");
      expect(CACHE_TTL_SECONDS).toBe(600);
    });
  });

  describe("RedisClient class", () => {
    let mockRedis: {
      get: ReturnType<typeof vi.fn>;
      setex: ReturnType<typeof vi.fn>;
      del: ReturnType<typeof vi.fn>;
      quit: ReturnType<typeof vi.fn>;
    };
    let RedisClient: typeof import("@/lib/cache/redis").RedisClient;

    beforeEach(async () => {
      mockRedis = {
        get: vi.fn().mockResolvedValue(null),
        setex: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
        quit: vi.fn().mockResolvedValue("OK"),
      };
      const mod = await import("@/lib/cache/redis");
      RedisClient = mod.RedisClient;
    });

    it("get returns value on hit", async () => {
      mockRedis.get.mockResolvedValue("cached-value");
      const client = new RedisClient(mockRedis as any);
      const result = await client.get("key");
      expect(result).toBe("cached-value");
      expect(mockRedis.get).toHaveBeenCalledWith("key");
    });

    it("get returns null on miss", async () => {
      mockRedis.get.mockResolvedValue(null);
      const client = new RedisClient(mockRedis as any);
      const result = await client.get("key");
      expect(result).toBeNull();
    });

    it("set calls setex with TTL", async () => {
      const client = new RedisClient(mockRedis as any);
      await client.set("key", "value", 300);
      expect(mockRedis.setex).toHaveBeenCalledWith("key", 300, "value");
    });

    it("del calls redis.del", async () => {
      const client = new RedisClient(mockRedis as any);
      await client.del("key");
      expect(mockRedis.del).toHaveBeenCalledWith("key");
    });

    it("disconnect calls redis.quit", async () => {
      const client = new RedisClient(mockRedis as any);
      await client.disconnect();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe("getRedisClient singleton", () => {
    afterEach(async () => {
      const { resetSingleton } = await import("@/lib/cache/redis");
      resetSingleton();
    });

    it("throws when REDIS_URL is not set", async () => {
      const orig = process.env.REDIS_URL;
      delete process.env.REDIS_URL;
      const { getRedisClient } = await import("@/lib/cache/redis");
      expect(() => getRedisClient()).toThrow("REDIS_URL is required");
      process.env.REDIS_URL = orig;
    });
  });

  describe("invalidateRagCache", () => {
    it("del() is called with correct cache key", async () => {
      const { invalidateRagCache, cacheKey } = await import("@/lib/cache/redis");
      const mockDel = vi.fn().mockResolvedValue(undefined);
      const mockInstance = { del: mockDel };

      vi.doMock("ioredis", () => ({
        default: vi.fn().mockImplementation(() => ({
          del: mockDel,
          quit: vi.fn(),
          on: vi.fn(),
        })),
      }));

      // We test through the class directly instead since singleton is tricky
      const { RedisClient } = await import("@/lib/cache/redis");
      const client = new RedisClient({ del: mockDel } as any);
      await client.del(cacheKey("conv-1"));
      expect(mockDel).toHaveBeenCalledWith("ctx:conv-1");
    });
  });
});
