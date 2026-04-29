import { describe, expect, it, vi } from "vitest";
import { fetchRssItems } from "@/lib/ingest/fetch-rss";

const source = {
  id: "media-techcrunch-ai",
  label: "TechCrunch AI",
  class: "media",
  transport: "rss",
  tier: "structured",
  enabledByDefault: true,
  locale: "en",
  url: "https://techcrunch.com/category/artificial-intelligence/feed/",
  roleSlug: "customer-service-representative",
  mappingMode: "observe_only",
  sourceType: "NEWS"
} as const;

const atomSource = {
  id: "official-openai-atom",
  label: "OpenAI Newsroom Atom",
  class: "official",
  transport: "atom",
  tier: "structured",
  enabledByDefault: true,
  locale: "en",
  url: "https://example.com/openai-atom.xml",
  roleSlug: "customer-service-representative",
  mappingMode: "observe_only",
  sourceType: "COMPANY_UPDATE"
} as const;

const chineseRssSource = {
  id: "media-36kr-tech",
  label: "36氪",
  class: "media",
  transport: "rss",
  tier: "structured",
  enabledByDefault: true,
  locale: "zh",
  url: "https://36kr.com/feed",
  mappingMode: "observe_only",
  sourceType: "NEWS"
} as const;

describe("fetchRssItems", () => {
  it("propagates source topic hints into parsed rss items", async () => {
    const hintedSource = {
      ...source,
      topicHints: ["workflow automation", "customer support"]
    } as const;
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<?xml version="1.0"?>
        <rss>
          <channel>
            <item>
              <title>Example AI workflow shift</title>
              <link>https://example.com/story</link>
              <pubDate>Tue, 01 Apr 2026 00:00:00 GMT</pubDate>
              <description><![CDATA[Recurring AI workflow automation.]]></description>
            </item>
          </channel>
        </rss>`
    });

    const items = await fetchRssItems(hintedSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]?.topicHints).toEqual(["workflow automation", "customer support"]);
  });

  it("parses rss items into raw source items", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<?xml version="1.0"?>
        <rss>
          <channel>
            <item>
              <title>Example AI workflow shift</title>
              <link>https://example.com/story</link>
              <pubDate>Tue, 01 Apr 2026 00:00:00 GMT</pubDate>
              <description><![CDATA[Recurring AI workflow automation.]]></description>
            </item>
          </channel>
        </rss>`
    });

    const items = await fetchRssItems(source, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://example.com/story",
      title: "Example AI workflow shift",
      sourceType: "NEWS",
      sourceLabel: "TechCrunch AI",
      sourceCatalogId: "media-techcrunch-ai",
      roleSlug: "customer-service-representative"
    });
  });

  it("throws for failed fetches", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 503
    });

    await expect(fetchRssItems(source, fetchFn as typeof fetch)).rejects.toThrow(
      "Failed to fetch TechCrunch AI: 503"
    );
  });

  it("parses atom entries into raw source items", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>OpenAI launches new support workflow tooling</title>
            <link href="https://openai.com/news/support-workflow-tooling" rel="alternate" />
            <updated>2026-04-02T00:00:00Z</updated>
            <summary>Official workflow update for customer support teams.</summary>
          </entry>
        </feed>`
    });

    const items = await fetchRssItems(atomSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://openai.com/news/support-workflow-tooling",
      title: "OpenAI launches new support workflow tooling",
      sourceType: "COMPANY_UPDATE",
      sourceLabel: "OpenAI Newsroom Atom",
      sourceCatalogId: "official-openai-atom",
      roleSlug: "customer-service-representative"
    });
  });

  it("parses atom content payloads when summary is absent", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>OpenAI updates support automation guidance</title>
            <link href="https://openai.com/news/support-automation-guidance" />
            <updated>2026-04-03T00:00:00Z</updated>
            <content type="html"><![CDATA[<p>Customer support workflow guidance.</p>]]></content>
          </entry>
        </feed>`
    });

    const items = await fetchRssItems(atomSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]?.summary).toBe("Customer support workflow guidance.");
  });

  it("parses a standard chinese rss feed item", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<?xml version="1.0"?>
        <rss>
          <channel>
            <item>
              <title><![CDATA[AI 助手进入企业工作流]]></title>
              <link>https://36kr.com/p/123</link>
              <pubDate>Wed, 16 Apr 2026 08:00:00 GMT</pubDate>
              <description><![CDATA[企业开始把 AI 工具纳入日常协作流程。]]></description>
            </item>
          </channel>
        </rss>`
    });

    const items = await fetchRssItems(chineseRssSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://36kr.com/p/123",
      title: "AI 助手进入企业工作流",
      sourceType: "NEWS",
      sourceLabel: "36氪",
      sourceCatalogId: "media-36kr-tech"
    });
  });

  it("caps parsed items using the source maxItems limit", async () => {
    const limitedSource = {
      ...source,
      maxItems: 1
    } as const;
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<?xml version="1.0"?>
        <rss>
          <channel>
            <item>
              <title>First item</title>
              <link>https://example.com/first</link>
              <pubDate>Tue, 01 Apr 2026 00:00:00 GMT</pubDate>
              <description>First summary.</description>
            </item>
            <item>
              <title>Second item</title>
              <link>https://example.com/second</link>
              <pubDate>Wed, 02 Apr 2026 00:00:00 GMT</pubDate>
              <description>Second summary.</description>
            </item>
          </channel>
        </rss>`
    });

    const items = await fetchRssItems(limitedSource, fetchFn as typeof fetch);

    expect(items).toHaveLength(1);
    expect(items[0]?.sourceUrl).toBe("https://example.com/first");
  });
});
