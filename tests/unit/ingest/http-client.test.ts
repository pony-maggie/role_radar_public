import { describe, expect, it, vi } from "vitest";
import { fetchSourceText } from "@/lib/ingest/http-client";

const source = {
  id: "media-techcrunch-ai",
  label: "TechCrunch AI",
  class: "media",
  transport: "rss",
  tier: "structured",
  enabledByDefault: true,
  locale: "en",
  url: "https://techcrunch.com/category/artificial-intelligence/feed/",
  mappingMode: "observe_only",
  sourceType: "NEWS",
  maxItems: 6
} as const;

describe("fetchSourceText", () => {
  it("retries retryable statuses before succeeding", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "<rss></rss>"
      });

    const text = await fetchSourceText(source, fetchFn as typeof fetch, {
      accept: "application/rss+xml"
    });

    expect(text).toBe("<rss></rss>");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("throws immediately on non-retryable statuses", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 403 });

    await expect(fetchSourceText(source, fetchFn as typeof fetch)).rejects.toThrow(
      "Failed to fetch TechCrunch AI: 403"
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
