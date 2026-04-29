import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BRAVE_SEARCH_COUNTRY,
  DEFAULT_BRAVE_SEARCH_LANGUAGE,
  createBraveSearchClient,
  getBraveSearchSettings
} from "@/lib/role-discovery/brave-search-client";

function makeEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    ...overrides
  };
}

describe("getBraveSearchSettings", () => {
  it("reads the api key from BRAVE_SEARCH_API_KEY", () => {
    const settings = getBraveSearchSettings(makeEnv({
      BRAVE_SEARCH_API_KEY: " brave-key "
    }));

    expect(settings).toEqual({
      apiKey: "brave-key",
      country: DEFAULT_BRAVE_SEARCH_COUNTRY,
      searchLang: DEFAULT_BRAVE_SEARCH_LANGUAGE
    });
  });
});

describe("createBraveSearchClient", () => {
  it("throws when BRAVE_SEARCH_API_KEY is missing", () => {
    expect(() => createBraveSearchClient(makeEnv())).toThrow(
      "Missing BRAVE_SEARCH_API_KEY"
    );
  });

  it("calls the official Brave web search endpoint and maps results", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            {
              url: "https://example.com/support-ai",
              title: "Support AI rollout",
              description: "AI handles <strong>ticket</strong> routing.",
              age: "2026-04-19T00:00:00.000Z"
            }
          ]
        }
      })
    });
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetchMock);

    try {
      const client = createBraveSearchClient(makeEnv({
        BRAVE_SEARCH_API_KEY: "brave-key"
      }));
      const hits = await client.search("customer support ai", 50);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const requestUrl = new URL(url);

      expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe(
        "https://api.search.brave.com/res/v1/web/search"
      );
      expect(requestUrl.searchParams.get("q")).toBe("customer support ai");
      expect(requestUrl.searchParams.get("count")).toBe("20");
      expect(requestUrl.searchParams.get("country")).toBe("us");
      expect(requestUrl.searchParams.get("search_lang")).toBe("en");
      expect(init).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/json",
            "X-Subscription-Token": "brave-key"
          })
        })
      );

      expect(hits).toEqual([
        {
          url: "https://example.com/support-ai",
          title: "Support AI rollout",
          snippet: "AI handles ticket routing.",
          publishedAt: "2026-04-19T00:00:00.000Z"
        }
      ]);
    } finally {
      vi.unstubAllGlobals();
      if (originalFetch) {
        vi.stubGlobal("fetch", originalFetch);
      }
    }
  });
});
