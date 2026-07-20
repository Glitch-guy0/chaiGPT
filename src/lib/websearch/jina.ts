export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchProvider {
  search(query: string): Promise<WebResult[]>;
}
