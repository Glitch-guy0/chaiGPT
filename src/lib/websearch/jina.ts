import type { WebSearchProvider, WebSearchResult } from "./provider"

const JINA_SEARCH_URL = "https://s.jina.ai"
const DEFAULT_TIMEOUT_MS = 12000

interface JinaResponse {
  data?: Array<{
    title?: string
    url?: string
    description?: string
    content?: string
  }>
}

function getApiKey(): string {
  const key = process.env.JINA_API_KEY
  if (!key) {
    throw new Error(
      "JINA_API_KEY is not set. Provide it via the JINA_API_KEY environment variable.",
    )
  }
  return key
}

export class JinaProvider implements WebSearchProvider {
  async search(query: string): Promise<WebSearchResult[]> {
    const apiKey = getApiKey()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    try {
      const res = await fetch(`${JINA_SEARCH_URL}/${encodeURIComponent(query)}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-No-Cache": "true",
        },
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(
          `Jina API returned ${res.status}: ${body || res.statusText}`,
        )
      }

      const json: JinaResponse = await res.json()

      return (json.data ?? []).map((item) => ({
        title: item.title ?? "",
        url: item.url ?? "",
        snippet: item.description ?? item.content ?? "",
      }))
    } finally {
      clearTimeout(timeout)
    }
  }
}
