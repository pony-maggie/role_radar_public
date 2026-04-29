import type { SourceCatalogEntry } from "./source-types";
import type { RawSourceItem } from "./source-types";
import { fetchSourceText } from "./http-client";

type FetchLike = typeof fetch;

type ManualHtmlExtractor = (html: string, source: SourceCatalogEntry) => RawSourceItem[];
type HeadingLinkOptions = {
  allowPublishedAtFallback?: boolean;
};
type ArticleCardOptions = {
  allowPublishedAtFallback?: boolean;
};

type RankedKeywordRule = {
  pattern: RegExp;
  weight: number;
};

const DEFAULT_CARD_CLASS_HINTS = ["post-card", "entry-card", "article-card", "post-item"];

const supportedManualHtmlSourceIds = new Set([
  "official-openai-news",
  "official-anthropic-news",
  "official-google-deepmind-blog",
  "official-hugging-face-blog",
  "official-github-ai-ml",
  "official-microsoft-ai",
  "official-cohere-blog",
  "official-mistral-news",
  "media-the-decoder-ai",
  "media-infoq-ai-ml",
  "media-jiqizhixin-ai",
  "media-qbitai-ai",
  "media-aibase-ai"
]);

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

function getFirstTagBody(fragment: string, tagNames: string[]) {
  for (const tag of tagNames) {
    const match = fragment.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    if (match) {
      return stripHtml(match[1]);
    }
  }

  return null;
}

function getAnchorTitle(fragment: string) {
  const anchorMatch = fragment.match(/<a\b[^>]*href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!anchorMatch) return null;

  return (
    getFirstTagBody(anchorMatch[1], ["h1", "h2", "h3"]) ??
    stripHtml(anchorMatch[1]) ??
    null
  );
}

function getPublishedAt(fragment: string) {
  const datetime = getAttribute(fragment, "time", "datetime");
  if (datetime) return datetime;

  const timeBody = getFirstTagBody(fragment, ["time"]);
  if (timeBody) return timeBody;

  const dateTextMatch = fragment.match(
    /\b([A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2}(?:T[0-9:.+-Z]+)?)\b/
  );
  if (dateTextMatch) return dateTextMatch[1];

  return null;
}

function cleanTitle(value: string | null) {
  if (!value) return null;

  return value
    .split(/\s+Tag:\s+/i)[0]
    .replace(/\s+/g, " ")
    .trim();
}

function createRawSourceItem(
  source: SourceCatalogEntry,
  sourceUrl: string | null,
  title: string | null,
  publishedAt: string | null,
  summary: string | null
) {
  if (!sourceUrl || !title || !publishedAt) {
    return null;
  }

  return {
    sourceUrl,
    title,
    publishedAt,
    summary: summary ?? "",
    sourceType: source.sourceType,
    sourceLabel: source.label,
    sourceCatalogId: source.id,
    roleSlug: source.roleSlug,
    topicHints: source.topicHints
  } satisfies RawSourceItem;
}

function extractArticleCards(
  html: string,
  source: SourceCatalogEntry,
  options: ArticleCardOptions = {}
) {
  const articleMatches = [...html.matchAll(/<article\b[\s\S]*?<\/article>/gi)];

  const items: Array<RawSourceItem | null> = articleMatches
    .map((match) => match[0])
    .map((article) => {
      const href = getAttribute(article, "a", "href");
      const title = getAnchorTitle(article) ?? getFirstTagBody(article, ["h1", "h2", "h3"]);
      const publishedAt =
        getPublishedAt(article) ??
        (options.allowPublishedAtFallback ? new Date().toISOString() : null);
      const summary = getFirstTagBody(article, ["p", "div"]);
      const sourceUrl = href ? absolutizeUrl(source.url, href) : null;

      return createRawSourceItem(source, sourceUrl, title, publishedAt, summary);
    });

  return items.filter((item): item is RawSourceItem => item !== null);
}

function extractClassedCardBlocks(
  html: string,
  source: SourceCatalogEntry,
  options: ArticleCardOptions = {},
  classHints: string[] = DEFAULT_CARD_CLASS_HINTS
) {
  const cardMatches = getClassedCardBlockMatches(html, classHints);

  const items: Array<RawSourceItem | null> = cardMatches
    .map((card) => {
      const href = getAttribute(card, "a", "href");
      const title = getAnchorTitle(card) ?? getFirstTagBody(card, ["h1", "h2", "h3"]);
      const publishedAt =
        getPublishedAt(card) ??
        (options.allowPublishedAtFallback ? new Date().toISOString() : null);
      const summary =
        getFirstTagBody(card, ["p"]) ??
        getClassedCardSummary(card);
      const sourceUrl = href ? absolutizeUrl(source.url, href) : null;

      return createRawSourceItem(source, sourceUrl, title, publishedAt, summary);
    });

  return items.filter((item): item is RawSourceItem => item !== null);
}

function getClassedCardBlockMatches(html: string, classHints: string[] = DEFAULT_CARD_CLASS_HINTS) {
  const classPattern = classHints.map(escapeRegExp).join("|");
  const classMatcher = new RegExp(
    `<(article|section|li)\\b[^>]*class=["'][^"']*\\b(${classPattern})\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    "gi"
  );
  const matches = [
    ...[...html.matchAll(classMatcher)].map((match) => ({
      index: match.index ?? 0,
      fragment: match[0]
    })),
    ...getNestedDivCardMatches(html, classHints)
  ];

  return matches
    .sort((left, right) => left.index - right.index)
    .map((match) => match.fragment);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getNestedDivCardMatches(html: string, classHints: string[] = DEFAULT_CARD_CLASS_HINTS) {
  const classPattern = classHints.map(escapeRegExp).join("|");
  const openTagPattern =
    new RegExp(
      `<div\\b[^>]*class=["'][^"']*\\b(${classPattern})\\b[^"']*["'][^>]*>`,
      "gi"
    );

  return [...html.matchAll(openTagPattern)]
    .map((match) => {
      const startIndex = match.index ?? 0;
      const endIndex = findMatchingDivEndIndex(html, startIndex + match[0].length);
      if (endIndex === null) {
        return null;
      }

      return {
        index: startIndex,
        fragment: html.slice(startIndex, endIndex)
      };
    })
    .filter((match): match is { index: number; fragment: string } => match !== null);
}

function findMatchingDivEndIndex(html: string, fromIndex: number) {
  const tokenPattern = /<div\b[^>]*>|<\/div>/gi;
  tokenPattern.lastIndex = fromIndex;
  let depth = 1;

  for (let token = tokenPattern.exec(html); token; token = tokenPattern.exec(html)) {
    if (token[0].startsWith("</")) {
      depth -= 1;
    } else {
      depth += 1;
    }

    if (depth === 0) {
      return tokenPattern.lastIndex;
    }
  }

  return null;
}

function getClassedCardSummary(fragment: string) {
  const explicitMatch = fragment.match(
    /<div\b[^>]*class=["'][^"']*(excerpt|summary|description|dek|teaser)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  );
  if (explicitMatch) {
    return stripHtml(explicitMatch[2]);
  }

  const contentMatch = fragment.match(
    /<div\b[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  );
  if (contentMatch) {
    return stripHtml(contentMatch[1] ?? contentMatch[0]);
  }

  const divMatches = [
    ...fragment.matchAll(/<div\b([^>]*)>([\s\S]*?)<\/div>/gi)
  ];

  const candidates = divMatches
    .map((match) => {
      const attributes = match[1] ?? "";
      const body = match[2] ?? "";
      return {
        attributes,
        body,
        text: stripHtml(body)
      };
    })
    .filter((candidate) => candidate.text.length > 0)
    .filter((candidate) => !/<a\b|<h[1-6]\b/i.test(candidate.body))
    .filter(
      (candidate) => !/\b(post-card|entry-card|article-card|post-item)\b/i.test(candidate.attributes)
    )
    .filter((candidate) => !/\b(meta|date|time|author|byline)\b/i.test(candidate.attributes));

  const preferredCandidate = candidates.find((candidate) =>
    /(excerpt|summary|description|dek|teaser)/i.test(candidate.attributes)
  );

  const contentCandidate = candidates.find((candidate) => /content/i.test(candidate.attributes));

  return preferredCandidate?.text ?? contentCandidate?.text ?? candidates[0]?.text ?? null;
}

function pickFirstStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function extractJsonPayloadItems(html: string, source: SourceCatalogEntry) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const items: RawSourceItem[] = [];

  for (const match of scripts) {
    const attrs = match[1] ?? "";
    const body = (match[2] ?? "").trim();
    if (!body) continue;
    if (!/__NEXT_DATA__|pageProps|article/i.test(`${attrs} ${body}`)) continue;

    const jsonStart = body.indexOf("{");
    const jsonEnd = body.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) continue;

    const parsedJson = decodeHtml(body.slice(jsonStart, jsonEnd + 1));
    let parsed: unknown;
    try {
      parsed = JSON.parse(parsedJson);
    } catch {
      continue;
    }

    collectJsonArticleItems(parsed, source, items);
  }

  return dedupeItems(items);
}

function extractAibaseRecordItems(html: string, source: SourceCatalogEntry) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const items: RawSourceItem[] = [];

  for (const match of scripts) {
    const body = decodeHtml((match[2] ?? "").trim()).replaceAll('\\"', '"');
    if (!body || !/Id|addtime|title/i.test(body)) continue;

    for (let cursor = 0; cursor < body.length; ) {
      const start = body.indexOf('{"Id":', cursor);
      if (start < 0) break;

      const end = body.indexOf("}", start);
      if (end < 0) {
        break;
      }

      cursor = end + 1;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(body.slice(start, end + 1));
      } catch {
        continue;
      }

      const title = pickFirstStringValue(parsed, ["title"]);
      const idValue = parsed["Id"] ?? parsed["id"];
      const id =
        typeof idValue === "number"
          ? String(idValue)
          : typeof idValue === "string" && idValue.trim().length > 0
            ? idValue.trim()
            : null;
      const sourceHref = pickFirstStringValue(parsed, [
        "url",
        "vurl",
        "link",
        "href",
        "canonicalUrl",
        "pathname",
        "slug"
      ]);
      const publishedAt = pickFirstStringValue(parsed, [
        "addtime",
        "publishedAt",
        "pubDate",
        "published",
        "date",
        "createdAt",
        "updatedAt"
      ]);
      const summary = pickFirstStringValue(parsed, [
        "description",
        "subtitle",
        "excerpt",
        "teaser",
        "content",
        "summary"
      ]);

      const sourceUrl =
        sourceHref && (sourceHref.startsWith("http://") || sourceHref.startsWith("https://"))
          ? sourceHref
          : sourceHref
            ? absolutizeUrl(source.url, sourceHref)
            : id
              ? absolutizeUrl(source.url, `/news/${id}`)
              : null;

      if (!title || !sourceUrl || !publishedAt) {
        continue;
      }

      const item = createRawSourceItem(source, sourceUrl, cleanTitle(title), publishedAt, summary);
      if (item) {
        items.push(item);
      }
    }
  }

  return dedupeItems(items);
}

function collectJsonArticleItems(
  value: unknown,
  source: SourceCatalogEntry,
  items: RawSourceItem[],
  seen = new Set<unknown>()
) {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectJsonArticleItems(entry, source, items, seen);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  const title = pickFirstStringValue(record, ["title", "headline", "name"]);
  const sourceHref = pickFirstStringValue(record, [
    "sourceUrl",
    "url",
    "href",
    "link",
    "canonicalUrl",
    "pathname",
    "slug"
  ]);
  const publishedAt = pickFirstStringValue(record, [
    "publishedAt",
    "pubDate",
    "published",
    "date",
    "createdAt",
    "updatedAt"
  ]);
  const summary = pickFirstStringValue(record, [
    "summary",
    "excerpt",
    "description",
    "dek",
    "teaser",
    "content"
  ]);

  if (title && sourceHref && publishedAt) {
    const absoluteSourceUrl =
      sourceHref.startsWith("http://") || sourceHref.startsWith("https://")
        ? sourceHref
        : absolutizeUrl(source.url, sourceHref);

    const item = createRawSourceItem(
      source,
      absoluteSourceUrl,
      cleanTitle(title),
      publishedAt,
      summary
    );
    if (item) {
      items.push(item);
    }
  }

  for (const nestedValue of Object.values(record)) {
    collectJsonArticleItems(nestedValue, source, items, seen);
  }
}

function isPromotionalChrome(fragment: string, title: string | null) {
  const normalized = `${fragment} ${title ?? ""}`.toLowerCase();
  return /\b(sponsored|promoted|promotional|advertorial|advertisement|newsletter|webinar|promo)\b/i.test(
    normalized
  );
}

function extractHeadingLinkCards(
  html: string,
  source: SourceCatalogEntry,
  options: HeadingLinkOptions = {}
) {
  const headingMatches = [
    ...html.matchAll(
      /<(h2|h3)\b[^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/\1>([\s\S]{0,800}?)(?=<(?:h2|h3)\b|<\/main>|<\/section>|<\/body>)/gi
    )
  ];

  const items = headingMatches
    .map((match) => {
      const href = match[2];
      const body = match[3];
      const trailing = match[4] ?? "";
      const title = cleanTitle(stripHtml(body));
      if (isPromotionalChrome(trailing, title)) {
        return null;
      }
      const publishedAt =
        getPublishedAt(trailing) ??
        (options.allowPublishedAtFallback ? new Date().toISOString() : null);
      const summary = getFirstTagBody(trailing, ["p", "div"]);
      const sourceUrl = href ? absolutizeUrl(source.url, href) : null;

      return createRawSourceItem(source, sourceUrl, title, publishedAt, summary);
    })
    .flatMap((item) => (item ? [item] : []))
    .filter((item) => item.title.length > 12);

  return dedupeItems(items);
}

function extractAnchorDateCards(
  html: string,
  source: SourceCatalogEntry,
  options: HeadingLinkOptions = {}
) {
  const anchorMatches = [
    ...html.matchAll(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{20,500}?)<\/a>([\s\S]{0,400}?)(?=<a\b|<\/main>|<\/section>|<\/body>)/gi
    )
  ];

  const items = anchorMatches
    .map((match) => {
      const href = match[1];
      const body = match[2];
      const trailing = match[3] ?? "";
      const title = cleanTitle(stripHtml(body));
      const publishedAt =
        getPublishedAt(body) ??
        getPublishedAt(trailing) ??
        (options.allowPublishedAtFallback ? new Date().toISOString() : null);
      const summary = getFirstTagBody(trailing, ["p", "div"]);
      const sourceUrl = href ? absolutizeUrl(source.url, href) : null;

      return createRawSourceItem(source, sourceUrl, title, publishedAt, summary);
    })
    .flatMap((item) => (item ? [item] : []))
    .filter((item) => item.title.length > 16)
    .filter((item) => /\b20\d{2}\b|[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}/.test(item.publishedAt));

  return dedupeItems(items);
}

function dedupeItems(items: RawSourceItem[]) {
  return [...new Map(items.map((item) => [item.sourceUrl, item])).values()];
}

function rankItemsByRelevance(items: RawSourceItem[], rules: RankedKeywordRule[]) {
  return [...items].sort((left, right) => {
    const leftScore = rules.reduce((score, rule) => {
      const haystack = `${left.title} ${left.summary}`.toLowerCase();
      return score + (rule.pattern.test(haystack) ? rule.weight : 0);
    }, 0);
    const rightScore = rules.reduce((score, rule) => {
      const haystack = `${right.title} ${right.summary}`.toLowerCase();
      return score + (rule.pattern.test(haystack) ? rule.weight : 0);
    }, 0);

    if (rightScore !== leftScore) return rightScore - leftScore;
    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
  });
}

function extractMicrosoftItems(html: string, source: SourceCatalogEntry) {
  const items = dedupeItems([
    ...extractArticleCards(html, source, { allowPublishedAtFallback: true }),
    ...extractHeadingLinkCards(html, source, { allowPublishedAtFallback: true }),
    ...extractAnchorDateCards(html, source, { allowPublishedAtFallback: true })
  ]);

  return rankItemsByRelevance(items, [
    { pattern: /\bfoundry\b|\bmai models?\b|\bmodel(s)?\b/, weight: 7 },
    { pattern: /\bcopilot\b|\bmicrosoft 365 copilot\b/, weight: 6 },
    { pattern: /\bdevelopers?\b|\bdeveloper\b/, weight: 6 },
    { pattern: /\bagents?\b|\bagentic\b/, weight: 5 },
    { pattern: /\bworkflow(s)?\b|\bwork\b/, weight: 5 },
    { pattern: /\bsecure software\b|\bsoftware\b|\bengineering\b/, weight: 4 },
    { pattern: /\bproductivity\b|\bc suite\b|\bpartnerships?\b/, weight: 3 },
    { pattern: /\bresponse operations\b|\bmsrc\b|\bsecurity response\b/, weight: 3 },
    { pattern: /\bhealthcare\b|\bwellbeing\b/, weight: -5 },
    { pattern: /\blanguage\b|\beveryone\b/, weight: -4 }
  ]);
}

function extractSourceAwareListingItems(
  html: string,
  source: SourceCatalogEntry,
  classHints: string[],
  options: ArticleCardOptions = {}
) {
  return dedupeItems([
    ...extractArticleCards(html, source, options),
    ...extractClassedCardBlocks(html, source, options, classHints)
  ]);
}

const manualHtmlExtractors: Record<string, ManualHtmlExtractor> = {
  "official-openai-news": extractArticleCards,
  "official-anthropic-news": extractArticleCards,
  "official-google-deepmind-blog": extractArticleCards,
  "official-hugging-face-blog": extractArticleCards,
  "official-github-ai-ml": (html, source) =>
    dedupeItems([...extractArticleCards(html, source), ...extractClassedCardBlocks(html, source)]),
  "official-microsoft-ai": extractMicrosoftItems,
  "official-cohere-blog": (html, source) =>
    extractHeadingLinkCards(html, source, { allowPublishedAtFallback: true }),
  "official-mistral-news": (html, source) =>
    extractAnchorDateCards(html, source),
  "media-the-decoder-ai": (html, source) =>
    extractSourceAwareListingItems(html, source, [
      "feed-entry",
      "news-card",
      "article-item",
      "post-card",
      "entry-card",
      "story-card",
      "teaser",
      "listing-item"
    ]),
  "media-infoq-ai-ml": (html, source) =>
    dedupeItems([
      ...extractHeadingLinkCards(html, source),
      ...extractSourceAwareListingItems(html, source, ["article-item", "news-card", "topic-item"])
    ]),
  "media-jiqizhixin-ai": (html, source) =>
    extractSourceAwareListingItems(html, source, [
      "news-card",
      "news-item",
      "article-card",
      "feed-entry",
      "story-card",
      "topic-card"
    ]),
  "media-qbitai-ai": (html, source) =>
    extractSourceAwareListingItems(html, source, [
      "qbit-article",
      "news-card",
      "news-item",
      "article-card",
      "feed-entry",
      "story-card"
    ]),
  "media-aibase-ai": (html, source) =>
    dedupeItems([
      ...extractAibaseRecordItems(html, source),
      ...extractJsonPayloadItems(html, source),
      ...extractSourceAwareListingItems(html, source, [
        "news-item",
        "news-card",
        "article-item",
        "feed-entry",
        "story-card"
      ])
    ])
};

export async function fetchHtmlItems(
  source: SourceCatalogEntry,
  fetchFn: FetchLike = fetch
): Promise<RawSourceItem[]> {
  if (!supportedManualHtmlSourceIds.has(source.id)) {
    throw new Error(`Unsupported HTML/manual source ${source.id}`);
  }

  const extractor = manualHtmlExtractors[source.id];
  if (!extractor) {
    throw new Error(`Missing extractor for HTML/manual source ${source.id}`);
  }

  const html = await fetchSourceText(source, fetchFn, {
    accept: "text/html,application/xhtml+xml"
  });
  return extractor(html, source).slice(0, source.maxItems ?? 6);
}
