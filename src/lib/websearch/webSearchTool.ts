import type { WebSearchArgs } from '@/lib/validation/schemas';

export interface WebSearchTool {
  run(args: WebSearchArgs): Promise<string>;
}
