import { auth as clerkAuth } from "@clerk/nextjs/server";

export interface IAuth {
  session(): Promise<{ userId: string }>;
}

export const auth: IAuth = {
  session: async () => {
    const { userId } = await clerkAuth();
    if (!userId) {
      throw new Error("Unauthorized");
    }
    return { userId };
  },
};
