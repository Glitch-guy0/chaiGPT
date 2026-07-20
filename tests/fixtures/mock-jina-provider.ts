import type {
  WebSearchProvider,
  WebResult,
} from "@/lib/websearch/jina";

export class MockJinaProvider implements WebSearchProvider {
  private searchFn: (query: string) => Promise<WebResult[]> =
    async () => [];

  onSearch(fn: (query: string) => Promise<WebResult[]>) {
    this.searchFn = fn;
  }

  async search(query: string): Promise<WebResult[]> {
    return this.searchFn(query);
  }
}
