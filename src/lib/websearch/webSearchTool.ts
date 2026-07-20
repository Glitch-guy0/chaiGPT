import type { WebSearchProvider } from './jina';
import type { WebSearchArgs } from '@/lib/validation/schemas';
import { WebSearchArgsSchema } from '@/lib/validation/schemas';

// WebSearchArgsSchema (Zod validation) is defined in Story 1.4 (src/lib/validation/schemas.ts)
// This tool routes parsed args from that schema to WebSearchProvider.search
export interface WebSearchTool {
  run(args: WebSearchArgs): Promise<string>;
}
