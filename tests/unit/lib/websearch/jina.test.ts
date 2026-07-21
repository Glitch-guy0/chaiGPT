import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JinaProvider } from "@/lib/websearch/jina";

describe("JinaProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("throws error when JINA_API_KEY is missing", async () => {
    delete process.env.JINA_API_KEY;
    const provider = new JinaProvider();
    await expect(provider.search("test query")).rejects.toThrow(
      "JINA_API_KEY environment variable is missing"
    );
  });

  it("issues POST request to Jina API and normalizes results", async () => {
    process.env.JINA_API_KEY = "test-jina-key";
    const provider = new JinaProvider();

    const mockResponseData = {
      data: [
        {
          title: "Test Page 1",
          url: "https://example.com/1",
          content: "Snippet content 1",
        },
        {
          title: "Test Page 2",
          url: "https://example.com/2",
          snippet: "Snippet content 2",
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponseData,
    } as Response);

    const results = await provider.search("test query");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.jina.ai/v1/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-jina-key",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ q: "test query" }),
      })
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: "Test Page 1",
      url: "https://example.com/1",
      snippet: "Snippet content 1",
    });
    expect(results[1]).toEqual({
      title: "Test Page 2",
      url: "https://example.com/2",
      snippet: "Snippet content 2",
    });
  });

  it("throws error when Jina API returns non-200 status", async () => {
    process.env.JINA_API_KEY = "test-jina-key";
    const provider = new JinaProvider();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    await expect(provider.search("test query")).rejects.toThrow(
      "Jina API request failed with status 401"
    );
  });

  it("throws timeout error when request exceeds 1500ms timeout budget", async () => {
    process.env.JINA_API_KEY = "test-jina-key";
    const provider = new JinaProvider();

    vi.spyOn(globalThis, "fetch").mockImplementationOnce((_url, options) => {
      return new Promise((_resolve, reject) => {
        const signal = (options as any)?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    });

    await expect(provider.search("slow query")).rejects.toThrow(
      "Jina API request timed out after 1500ms"
    );
  });
});
