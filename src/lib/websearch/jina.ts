export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchProvider {
  search(query: string): Promise<WebResult[]>;
}

export class JinaProvider implements WebSearchProvider {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async search(query: string): Promise<WebResult[]> {
    const key = this.apiKey || process.env.JINA_API_KEY;
    if (!key) {
      throw new Error("JINA_API_KEY environment variable is missing");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    try {
      const response = await fetch("https://api.jina.ai/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Jina API request failed with status ${response.status}`);
      }

      const data = (await response.json()) as any;
      const items = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.results)
          ? data.results
          : [];

      return items.map((item: any) => ({
        title: item.title || "",
        url: item.url || "",
        snippet: item.content || item.snippet || item.description || "",
      }));
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error("Jina API request timed out after 1500ms");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
