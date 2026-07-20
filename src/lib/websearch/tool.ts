import { DynamicStructuredTool } from "@langchain/core/tools";
import { WebSearchArgsSchema } from '../validation/schemas';
import { jinaProvider } from './jina';

export interface IWebSearchTool {
  run(args: { query: string }): Promise<any>;
}

export const webSearchTool = new DynamicStructuredTool({
  name: "web_search",
  description: "Search the web for up-to-date information on a topic.",
  schema: WebSearchArgsSchema,
  func: async ({ query }) => {
    try {
      const results = await jinaProvider.search(query);
      if (results.length === 0) return "No results found.";

      const formatted = results.map(r => `Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n');
      return `Web Search Results:\n\n${formatted}`;
    } catch (error) {
      console.error("WebSearchTool error:", error);
      return "Web search is currently unavailable.";
    }
  },
});
