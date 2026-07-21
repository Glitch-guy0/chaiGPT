import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: [
        "src/services/**/*.ts",
        "src/lib/db/repositories/**/*.ts",
        "src/app/api/assets/**/*.ts",
        "src/app/api/conversations/**/*.ts",
        "src/hooks/**/*.ts",
        "src/lib/ai/text-extractor.ts",
        "src/lib/ai/text-chunker.ts",
        "src/lib/chunking/chunker.ts",
        "src/lib/vector/qdrant.ts",
        "src/lib/rag/**/*.ts",
        "src/lib/cache/**/*.ts",
      ],
      exclude: [
        "src/services/**/*.test.ts",
        "src/lib/db/repositories/**/*.test.ts",
        "src/app/api/assets/**/*.test.ts",
        "src/lib/ai/text-extractor.test.ts",
        "src/lib/ai/text-chunker.test.ts",
        "src/lib/chunking/__tests__/**",
        "src/lib/vector/__tests__/**",
        "src/lib/rag/**/*.test.ts",
        "src/services/index.ts",
        "src/lib/db/repositories/index.ts",
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    typecheck: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
