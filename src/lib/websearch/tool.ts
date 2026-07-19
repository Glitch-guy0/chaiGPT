import { WebSearchArgsSchema, type WebSearchArgs } from "@/lib/validation/schemas"
import type { WebSearchProvider } from "./provider"

export interface WebSearchTool {
  run(args: WebSearchArgs): Promise<string>
  provider: WebSearchProvider
}

export class WebSearchToolImpl implements WebSearchTool {
  readonly provider: WebSearchProvider

  constructor(provider: WebSearchProvider) {
    this.provider = provider
  }

  async run(args: WebSearchArgs): Promise<string> {
    try {
      const results = await this.provider.search(args.query)
      if (results.length === 0) {
        return JSON.stringify({ results: [], urls: [], message: "No results found" })
      }
      const urls = results.map((r) => r.url)
      return JSON.stringify({ results, urls })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Web search failed"
      return JSON.stringify({ results: [], urls: [], error: message })
    }
  }
}
