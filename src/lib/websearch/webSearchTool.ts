import type { WebSearchArgs } from '@/lib/validation/schemas';
import { WebSearchArgsSchema } from '@/lib/validation/schemas';
import type { WebSearchProvider } from './jina';
import { JinaProvider } from './jina';

export interface WebSearchTool {
  run(args: WebSearchArgs): Promise<string>;
}

export class DefaultWebSearchTool implements WebSearchTool {
  private provider: WebSearchProvider;

  constructor(provider?: WebSearchProvider) {
    this.provider = provider || new JinaProvider();
  }

  async run(args: WebSearchArgs): Promise<string> {
    const parsed = WebSearchArgsSchema.safeParse(args);
    if (!parsed.success) {
      return `Web search unavailable: Invalid arguments format. ${parsed.error.message}`;
    }

    try {
      const results = await this.provider.search(parsed.data.query);

      if (!results || results.length === 0) {
        return `No web search results found for: "${parsed.data.query}"`;
      }

      const formatted = results
        .map(
          (item, idx) =>
            `[${idx + 1}] Title: ${item.title}\nURL: ${item.url}\nSnippet: ${item.snippet}`
        )
        .join('\n\n');

      return `Web Search Results for "${parsed.data.query}":\n\n${formatted}`;
    } catch (err: any) {
      return `Web search unavailable: ${err?.message || 'Unknown error occurred'}`;
    }
  }
}
