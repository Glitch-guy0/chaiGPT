import type { AuthSession } from "@/lib/auth/session";

export function createMockSession(
  userId: string | null = "test-user-id",
): () => Promise<AuthSession> {
  return async () => ({ userId: userId ?? "test-user-id" });
}
