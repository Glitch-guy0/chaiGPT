export interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

export interface WebSearchProvider {
  search(query: string): Promise<WebSearchResult[]>
}
