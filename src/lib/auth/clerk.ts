import { auth } from "@clerk/nextjs/server";
import type { AuthProvider } from "./session";

export const clerkAuthProvider: AuthProvider = {
  async session() {
    const { userId } = await auth();

    if (!userId) {
      throw new Error("Unauthorized");
    }

    return { userId };
  },
};
