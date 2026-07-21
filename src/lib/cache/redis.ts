import Redis from "ioredis";
import type { Hit } from "@/lib/vector/qdrant";

export interface RedisCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl: number): Promise<void>;
  del(key: string): Promise<void>;
}

export const CACHE_TTL_SECONDS = Number(process.env.REDIS_CACHE_TTL) || 600;

export function cacheKey(convId: string): string {
  return `ctx:${convId}`;
}

export function serializeHits(hits: Hit[]): string {
  return JSON.stringify(hits);
}

export function deserializeHits(raw: string): Hit[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (h: unknown): h is Hit =>
        h != null &&
        typeof h === "object" &&
        "chunkId" in h &&
        "assetId" in h &&
        "score" in h &&
        "text" in h,
    );
  } catch {
    console.warn("[Cache] Failed to deserialize cached hits, treating as miss");
    return null;
  }
}

let singleton: Redis | null = null;

export function getRedisClient(): Redis {
  if (singleton) return singleton;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is required in production. Set it to redis://localhost:6379 for development.",
    );
  }

  singleton = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  singleton.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });

  if (!process.listenerCount("SIGINT")) {
    process.on("SIGINT", async () => {
      if (singleton) {
        await singleton.quit().catch(() => {});
        singleton = null;
      }
    });
    process.on("SIGTERM", async () => {
      if (singleton) {
        await singleton.quit().catch(() => {});
        singleton = null;
      }
    });
  }

  return singleton;
}

export class RedisClient implements RedisCache {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttl: number): Promise<void> {
    await this.redis.setex(key, ttl, value);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

export async function invalidateRagCache(convId: string): Promise<void> {
  try {
    const client = getRedisClient();
    const rc = new RedisClient(client);
    await rc.del(cacheKey(convId));
  } catch (err) {
    console.warn("[Cache] Failed to invalidate RAG cache:", err);
  }
}

export function resetSingleton(): void {
  if (singleton) {
    singleton.disconnect();
    singleton = null;
  }
}
