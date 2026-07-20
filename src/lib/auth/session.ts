import { auth as clerkAuth } from "@clerk/nextjs/server";

export interface AuthSession {
  userId: string;
}

export async function auth(): Promise<AuthSession> {
  const { userId } = await clerkAuth();

  if (!userId) {
    throw new Error("Unauthorized: No valid session found");
  }

  return { userId };
}
