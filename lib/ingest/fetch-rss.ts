import type { SourceCatalogEntry } from "./source-types";
import type { RawSourceItem } from "./source-types";
import { fetchSourceText } from "./http-client";

type FetchLike = typeof fetch;

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function stripCdata(value: string) {
  return value.replaceAll("<![CDATA[", "").replaceAll("]]>", "");
}

function getTagValue(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return null;
  return decodeXml(stripCdata(match[1]).trim());
}

function getNamespacedTagValue(item: string, tags: string[]) {
  for (const tag of tags) {
    const value = getTagValue(item, tag);
    if (value) return value;
  }

  return null;
}

function getAtomLinkValue(item: string) {
  const hrefMatch = item.match(/<link\b[^>]*href="([^"]+)"/i);
  if (hrefMatch) return decodeXml(hrefMatch[1].trim());

  return getTagValue(item, "link");
}

export async function fetchRssItems(
  source: SourceCatalogEntry,
  fetchFn: FetchLike = fetch
): Promise<RawSourceItem[]> {
  const xml = await fetchSourceText(source, fetchFn, {
    accept: "application/rss+xml, application/atom+xml, application/xml, text/xml"
  });
  const itemMatches =
    source.transport === "atom"
      ? [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)]
      : [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)];

  const mappedItems: Array<RawSourceItem | null> = itemMatches
    .map((match) => match[0])
    .map((itemXml) => {
      const link = source.transport === "atom" ? getAtomLinkValue(itemXml) : getTagValue(itemXml, "link");
      const title = getTagValue(itemXml, "title");
      const publishedAt =
        getTagValue(itemXml, "pubDate") ??
        getTagValue(itemXml, "published") ??
        getTagValue(itemXml, "updated") ??
        "";
      const summary =
        getTagValue(itemXml, "description") ??
        getTagValue(itemXml, "summary") ??
        getTagValue(itemXml, "content:encoded") ??
        getNamespacedTagValue(itemXml, ["content", "atom:content"]) ??
        "";

      if (!link || !title || !publishedAt) {
        return null;
      }

      return {
        sourceUrl: link,
        title,
        publishedAt,
        summary: summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        sourceType: source.sourceType,
        sourceLabel: source.label,
        sourceCatalogId: source.id,
        roleSlug: source.roleSlug,
        topicHints: source.topicHints
      } satisfies RawSourceItem;
    });

  const items = mappedItems.filter((item): item is RawSourceItem => item !== null);

  return items.slice(0, source.maxItems ?? 6);
}
