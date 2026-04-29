import { dedupeBySourceUrl } from "./classify-signal";
import { canonicalizeSourceUrl } from "./canonicalize-source-url";
import { fetchSourceText } from "./http-client";
import type { DiscoverySiteEntry } from "./search-discovery-catalog";
import type { SourceCatalogEntry } from "./source-types";
import type { RawSourceItem } from "./source-types";

type FetchHtmlLike = (url: string) => Promise<string>;

const DUCKDUCKGO_HTML_SEARCH_URL = "https://html.duckduckgo.com/html/";

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function absolutizeUrl(href: string) {
  try {
    return new URL(href, DUCKDUCKGO_HTML_SEARCH_URL).toString();
  } catch {
    return href;
  }
}

function getAttribute(fragment: string, attribute: string) {
  const match = fragment.match(new RegExp(`\\b${attribute}=["']([^"']+)["']`, "i"));
  return match?.[1]?.trim() ?? null;
}

function getInnerText(html: string) {
  return stripHtml(decodeHtml(html));
}

function normalizeSearchResultUrl(href: string) {
  const absoluteHref = absolutizeUrl(decodeHtml(href.trim()));

  try {
    const url = new URL(absoluteHref);
    if (url.hostname.endsWith("duckduckgo.com") && url.pathname === "/l/") {
      const uddg = url.searchParams.get("uddg");
      if (uddg) {
        return canonicalizeSourceUrl(absolutizeUrl(decodeHtml(uddg)));
      }
    }
  } catch {
    // Fall through to the original href handling below.
  }

  try {
    return canonicalizeSourceUrl(absoluteHref);
  } catch {
    return absoluteHref;
  }
}

function hostnameMatchesSiteDomain(hostname: string, siteDomain: string) {
  return hostname === siteDomain || hostname.endsWith(`.${siteDomain}`);
}

export function buildDuckDuckGoSearchUrl(domain: string, query: string) {
  const searchQuery = `site:${domain} ${query}`.trim();
  return `${DUCKDUCKGO_HTML_SEARCH_URL}?q=${encodeURIComponent(searchQuery)}`;
}

function getResultTitle(fragment: string, site: DiscoverySiteEntry) {
  const anchorMatches = [...fragment.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];

  for (const match of anchorMatches) {
    const attrs = match[1] ?? "";
    const className = getAttribute(attrs, "class");
    const href = getAttribute(attrs, "href");
    if (!href || !className || !/\bresult__a\b/i.test(className)) continue;

    const sourceUrl = normalizeSearchResultUrl(href);
    try {
      const hostname = new URL(sourceUrl).hostname.toLowerCase();
      if (!hostnameMatchesSiteDomain(hostname, site.domain.toLowerCase())) {
        continue;
      }
    } catch {
      continue;
    }

    return {
      sourceUrl,
      title: getInnerText(match[2] ?? "")
    };
  }

  return null;
}

function getResultSnippet(fragment: string) {
  const snippetMatches = [
    ...fragment.matchAll(/<(a|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi)
  ];

  for (const match of snippetMatches) {
    const attrs = match[2] ?? "";
    const className = getAttribute(attrs, "class");
    if (className && /\bresult__snippet\b/i.test(className)) {
      return getInnerText(match[3] ?? "");
    }
  }

  return "";
}

export function parseDuckDuckGoResults(
  html: string,
  site: DiscoverySiteEntry,
  publishedAt: Date
) {
  const titleAnchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].filter((match) => {
    const attrs = match[1] ?? "";
    const className = getAttribute(attrs, "class");
    return Boolean(className && /\bresult__a\b/i.test(className));
  });

  const items: RawSourceItem[] = [];

  for (let index = 0; index < titleAnchors.length; index += 1) {
    const anchor = titleAnchors[index];
    const startIndex = anchor.index ?? 0;
    const nextAnchorIndex = titleAnchors[index + 1]?.index ?? html.length;
    const fragment = html.slice(startIndex, nextAnchorIndex);
    const titleMatch = getResultTitle(fragment, site);
    if (!titleMatch) continue;

    const summary = getResultSnippet(fragment);
    items.push({
      sourceUrl: titleMatch.sourceUrl,
      title: titleMatch.title,
      publishedAt: publishedAt.toISOString(),
      summary,
      sourceType: site.sourceType,
      sourceLabel: site.label,
      sourceCatalogId: site.id,
      topicHints: site.topicHints
    });
  }

  return items;
}

async function defaultFetchSearchHtml(url: string) {
  const searchSource = {
    url,
    label: "DuckDuckGo Search Discovery"
  } as Pick<SourceCatalogEntry, "url" | "label">;

  return fetchSourceText(
    searchSource as SourceCatalogEntry,
    fetch,
    {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  );
}

export async function fetchSearchDiscoveryItems(
  site: DiscoverySiteEntry,
  deps: {
    fetchHtml?: FetchHtmlLike;
    now?: () => Date;
  } = {}
): Promise<RawSourceItem[]> {
  const fetchHtml = deps.fetchHtml ?? defaultFetchSearchHtml;
  const now = deps.now ?? (() => new Date());
  const results: RawSourceItem[] = [];
  const seenSourceUrls = new Set<string>();

  for (const query of site.queryTemplates) {
    const url = buildDuckDuckGoSearchUrl(site.domain, query);
    const html = await fetchHtml(url);
    const parsed = parseDuckDuckGoResults(html, site, now());

    for (const item of parsed) {
      if (seenSourceUrls.has(item.sourceUrl)) continue;
      seenSourceUrls.add(item.sourceUrl);
      results.push(item);

      if (results.length >= site.maxResults) break;
    }

    if (results.length >= site.maxResults) break;
  }

  return dedupeBySourceUrl(results);
}
