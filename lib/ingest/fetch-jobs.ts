import type { SourceCatalogEntry } from "./source-types";
import type { RawSourceItem } from "./source-types";
import { fetchSourceText } from "./http-client";

type FetchLike = typeof fetch;

type JobHtmlExtractor = (html: string, source: SourceCatalogEntry) => RawSourceItem[];

const supportedJobsSourceIds = new Set(["jobs-openai-careers", "jobs-anthropic-careers"]);

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function stripHtml(value: string) {
  return decodeHtml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function absolutizeUrl(sourceUrl: string, href: string) {
  try {
    return new URL(href, sourceUrl).toString();
  } catch {
    return null;
  }
}

function getAttribute(fragment: string, tag: string, attribute: string) {
  const match = fragment.match(
    new RegExp(`<${tag}\\b[^>]*${attribute}=["']([^"']+)["'][^>]*>`, "i")
  );
  return match?.[1]?.trim() ?? null;
}

function getDataAttribute(fragment: string, attributeNames: string[]) {
  for (const attributeName of attributeNames) {
    const match = fragment.match(
      new RegExp(`<[^>]+${attributeName}=["']([^"']+)["'][^>]*>`, "i")
    );
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function getFirstTagBody(fragment: string, tagNames: string[]) {
  for (const tag of tagNames) {
    const match = fragment.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    if (match) {
      return stripHtml(match[1]);
    }
  }

  return null;
}

function getTagBodies(fragment: string, tagNames: string[]) {
  return tagNames.flatMap((tag) =>
    [...fragment.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))]
      .map((match) => stripHtml(match[1]))
      .filter((value) => value.length > 0)
  );
}

function getAnchorTitle(fragment: string) {
  const anchorMatch = fragment.match(/<a\b[^>]*href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!anchorMatch) return null;

  return (
    getFirstTagBody(anchorMatch[1], ["h1", "h2", "h3", "h4"]) ?? stripHtml(anchorMatch[1]) ?? null
  );
}

function getVisiblePublishedAt(fragment: string) {
  return getFirstTagBody(fragment, ["time"]);
}

function getPublishedAt(fragment: string) {
  const datetime = getAttribute(fragment, "time", "datetime");
  if (datetime) return datetime;

  const timeBody = getVisiblePublishedAt(fragment);
  if (timeBody && !Number.isNaN(Date.parse(timeBody))) {
    return new Date(timeBody).toISOString();
  }

  return null;
}

function extractLabelValue(text: string, label: string) {
  const match = text.match(new RegExp(`\\b${label}\\b\\s*[:\\-]?\\s*([^•|\\n]+)`, "i"));
  return match?.[1]?.trim() ?? null;
}

function uniqueBySourceUrl(items: RawSourceItem[]) {
  return [...new Map(items.map((item) => [item.sourceUrl, item])).values()];
}

function extractJobCards(html: string, source: SourceCatalogEntry) {
  const fragments = [
    ...html.matchAll(/<article\b[\s\S]*?<\/article>/gi),
    ...html.matchAll(/<li\b[\s\S]*?<\/li>/gi)
  ].map((match) => match[0]);

  const fallbackFragments = fragments.length
    ? fragments
    : [...html.matchAll(/<div\b[\s\S]*?<\/div>/gi)].map((match) => match[0]);

  const items = fallbackFragments
    .map((fragment) => {
      const href = getAttribute(fragment, "a", "href");
      const title = getAnchorTitle(fragment) ?? getFirstTagBody(fragment, ["h1", "h2", "h3", "h4"]);
      const publishedAt = getPublishedAt(fragment);
      const sourceUrl = href ? absolutizeUrl(source.url, href) : null;

      if (!sourceUrl || !title || !publishedAt) {
        return null;
      }

      const metadataBodies = getTagBodies(fragment, ["p", "div", "span", "li"]);
      const metadataText = metadataBodies.join(" ");
      const location =
        getDataAttribute(fragment, ["data-location", "data-office"]) ??
        metadataBodies.map((body) => extractLabelValue(body, "Location")).find(Boolean) ??
        null;
      const team =
        getDataAttribute(fragment, ["data-team", "data-group"]) ??
        metadataBodies.map((body) => extractLabelValue(body, "Team")).find(Boolean) ??
        null;
      const department =
        getDataAttribute(fragment, ["data-department", "data-org"]) ??
        metadataBodies.map((body) => extractLabelValue(body, "Department")).find(Boolean) ??
        null;
      const visibleTime = getVisiblePublishedAt(fragment);
      const summaryParts = [team, department, location, visibleTime].filter(
        (value): value is string => Boolean(value)
      );
      const summary = summaryParts.length > 0 ? summaryParts.join(" • ") : metadataText;

      const item: RawSourceItem = {
        sourceUrl,
        title,
        publishedAt,
        summary: summary || "",
        sourceType: source.sourceType,
        sourceLabel: source.label,
        sourceCatalogId: source.id,
        ...(source.roleSlug ? { roleSlug: source.roleSlug } : {}),
        ...(source.topicHints ? { topicHints: source.topicHints } : {})
      };

      return item;
    })
    .filter((item): item is RawSourceItem => item !== null);

  return uniqueBySourceUrl(items);
}

const jobsHtmlExtractors: Record<string, JobHtmlExtractor> = {
  "jobs-openai-careers": extractJobCards,
  "jobs-anthropic-careers": extractJobCards
};

export async function fetchJobsItems(
  source: SourceCatalogEntry,
  fetchFn: FetchLike = fetch
): Promise<RawSourceItem[]> {
  if (!supportedJobsSourceIds.has(source.id)) {
    throw new Error(`Unsupported jobs source ${source.id}`);
  }

  const extractor = jobsHtmlExtractors[source.id];
  if (!extractor) {
    throw new Error(`Missing extractor for jobs source ${source.id}`);
  }

  const html = await fetchSourceText(source, fetchFn, {
    accept: "text/html,application/xhtml+xml"
  });
  return extractor(html, source).slice(0, source.maxItems ?? 8);
}
