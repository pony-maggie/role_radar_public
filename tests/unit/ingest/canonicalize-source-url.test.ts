import { describe, expect, it } from "vitest";
import { canonicalizeSourceUrl } from "@/lib/ingest/canonicalize-source-url";

describe("canonicalizeSourceUrl", () => {
  it("drops common tracking params from discovery urls", () => {
    expect(
      canonicalizeSourceUrl("https://example.com/post?a=1&utm_source=ddg&ref=search")
    ).toBe("https://example.com/post?a=1");
  });

  it("keeps canonical paths stable for dedupe", () => {
    expect(
      canonicalizeSourceUrl("https://www.qbitai.com/2026/04/story/?utm_medium=rss")
    ).toBe("https://qbitai.com/2026/04/story/");
  });
});
