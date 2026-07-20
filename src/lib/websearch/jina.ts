import { IWebSearchProvider, WebSearchResult } from './provider';

export class JinaProvider implements IWebSearchProvider {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.JINA_API_KEY;
  }

  async search(query: string): Promise<WebSearchResult[]> {
    if (!this.apiKey) {
      throw new Error('JINA_API_KEY is missing. Web search is disabled.');
    }

    try {
      // Jina's search API endpoint
      const response = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error(`Jina API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Map Jina's response to our expected format
      const results: WebSearchResult[] = [];
      if (data && data.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          results.push({
            title: item.title || '',
            url: item.url || '',
            snippet: item.content || item.description || ''
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Web search failed:', error);
      throw new Error('Failed to execute web search');
    }
  }
}

export const jinaProvider = new JinaProvider();
