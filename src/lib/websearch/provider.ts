export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface IWebSearchProvider {
  search(query: string): Promise<WebSearchResult[]>;
}
