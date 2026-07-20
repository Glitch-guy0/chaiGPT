import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "_bmad/**",
    ".agents/**",
    "infra/**",
    "e2e/**",
    "playwright-report/**",
    "test-results/**",
    "src/services/*.ts",
    "src/lib/vector/*.ts",
    "src/lib/ai/langchain.ts",
    "src/lib/websearch/tool.ts",
    "src/app/api/chat/route.ts",
    "src/lib/db/fixtures/repository.fixture.ts",
    "src/lib/db/repositories/conversation.repository.ts"
  ]),
]);

export default eslintConfig;
