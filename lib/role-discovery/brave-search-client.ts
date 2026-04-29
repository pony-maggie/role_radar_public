import type { RoleSearchClient, SearchResultHit } from "@/lib/role-discovery/search-client";

export const DEFAULT_BRAVE_SEARCH_COUNTRY = "us";
export const DEFAULT_BRAVE_SEARCH_LANGUAGE = "en";
const BRAVE_WEB_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

type BraveSearchSettings = {
  apiKey: string;
  country: string;
  searchLang: string;
};

type BraveSearchResponse = {
  web?: {
    results?: Array<{
      url?: string;
      title?: string;
      description?: string;
      age?: string;
      page_age?: string;
    }>;
  };
};

type BraveWebResult = {
  url?: string;
  title?: string;
  description?: string;
  age?: string;
  page_age?: string;
};

function clampResultCount(limit: number) {
  if (!Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(20, Math.trunc(limit)));
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function toSearchResultHit(result: BraveWebResult): SearchResultHit | null {
  if (!result.url || !result.title) return null;

  return {
    url: result.url,
    title: result.title,
    snippet: stripHtmlTags(result.description ?? ""),
    publishedAt: result.age ?? result.page_age ?? null
  };
}

export function getBraveSearchSettings(env: NodeJS.ProcessEnv = process.env): BraveSearchSettings {
  return {
    apiKey: env.BRAVE_SEARCH_API_KEY?.trim() || "",
    country: DEFAULT_BRAVE_SEARCH_COUNTRY,
    searchLang: DEFAULT_BRAVE_SEARCH_LANGUAGE
  };
}

export function createBraveSearchClient(env: NodeJS.ProcessEnv = process.env): RoleSearchClient {
  const settings = getBraveSearchSettings(env);
  if (!settings.apiKey) {
    throw new Error("Missing BRAVE_SEARCH_API_KEY");
  }

  return {
    async search(query: string, limit: number) {
      const url = new URL(BRAVE_WEB_SEARCH_ENDPOINT);
      url.searchParams.set("q", query);
      url.searchParams.set("count", String(clampResultCount(limit)));
      url.searchParams.set("country", settings.country);
      url.searchParams.set("search_lang", settings.searchLang);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": settings.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Brave search request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as BraveSearchResponse;
      return (data.web?.results ?? [])
        .map(toSearchResultHit)
        .filter((value): value is SearchResultHit => value !== null);
    }
  };
}
