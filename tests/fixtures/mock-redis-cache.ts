import type { RedisCache } from "@/lib/cache/redis";

export class MockRedisCache implements RedisCache {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string, _ttl: number): Promise<void> {
    this.store.set(key, value);
  }
  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}
