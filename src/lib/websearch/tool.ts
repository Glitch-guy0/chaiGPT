import { WebSearchArgsSchema, type WebSearchArgs } from "@/lib/validation/schemas"
import type { WebSearchProvider } from "./provider"

export interface WebSearchTool {
  run(args: WebSearchArgs): Promise<string>
  provider: WebSearchProvider
}
