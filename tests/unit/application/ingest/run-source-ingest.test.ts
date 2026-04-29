import { describe, expect, it } from "vitest";
import type { RawSourceItem } from "@/lib/ingest/source-types";
import {
  normalizeAndDedupeItems,
  resolveIngestTargets
} from "@/lib/application/ingest/run-source-ingest";

describe("run-source-ingest application helpers", () => {
  it("accepts targeted discovery ids and only runs the requested ingest targets", () => {
    const selection = resolveIngestTargets(["discovery-qbitai"]);

    expect(selection.primarySources).toHaveLength(0);
    expect(selection.discoverySites.map((site) => site.id)).toEqual(["discovery-qbitai"]);
  });

  it("dedupes by canonical compare key without rewriting primary source urls", () => {
    const primaryItem: RawSourceItem = {
      sourceCatalogId: "media-qbitai-ai",
      sourceLabel: "QbitAI RSS",
      sourceType: "NEWS",
      sourceUrl: "https://www.qbitai.com/2026/04/story/?utm_medium=rss",
      title: "Primary lane item",
      summary: "Summary",
      publishedAt: "2026-04-16T10:00:00.000Z"
    };
    const discoveryItem: RawSourceItem = {
      sourceCatalogId: "discovery-qbitai",
      sourceLabel: "量子位 Search Discovery",
      sourceType: "NEWS",
      sourceUrl: "https://qbitai.com/2026/04/story/?ref=search",
      title: "Discovery lane item",
      summary: "Summary",
      publishedAt: "2026-04-16T10:00:00.000Z"
    };
    const seenCompareKeys = new Set<string>();

    const primaryItems = normalizeAndDedupeItems([primaryItem], seenCompareKeys, {
      canonicalizeForStorage: false
    });
    const discoveryItems = normalizeAndDedupeItems([discoveryItem], seenCompareKeys, {
      canonicalizeForStorage: true
    });

    expect(primaryItems).toHaveLength(1);
    expect(primaryItems[0]?.sourceUrl).toBe("https://www.qbitai.com/2026/04/story/?utm_medium=rss");
    expect(discoveryItems).toHaveLength(0);
  });
});
