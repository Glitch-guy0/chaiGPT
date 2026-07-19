import { DynamicTool } from "@langchain/core/tools"
import { WebSearchArgsSchema } from "@/lib/validation/schemas"
import type { WebSearchProvider } from "./provider"
import { WebSearchToolImpl } from "./tool"

export function createWebSearchLangChainTool(
  provider: WebSearchProvider,
): DynamicTool {
  const webSearchTool = new WebSearchToolImpl(provider)

  return new DynamicTool({
    name: "web_search",
    description:
      "Search the web for current information. Input should be a search query string.",
    func: async (input: string) => {
      const parsed = WebSearchArgsSchema.safeParse({ query: input })
      if (!parsed.success) {
        return JSON.stringify({
          results: [],
          urls: [],
          error: `Invalid input: ${parsed.error.message}`,
        })
      }
      return webSearchTool.run(parsed.data)
    },
  })
}
