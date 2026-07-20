import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@clerk/nextjs", "better-sqlite3"],
};

export default nextConfig;
