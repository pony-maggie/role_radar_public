import { describe, expect, it } from "vitest";
import { normalizeItem } from "@/lib/ingest/normalize-item";

describe("normalizeItem", () => {
  it("trims title/summary and parses publishedAt", () => {
    const normalized = normalizeItem({
      sourceUrl: "https://example.com/a",
      title: "  Example title  ",
      publishedAt: "2026-04-01T00:00:00.000Z",
      summary: "  Example summary  ",
      sourceType: "NEWS"
    });

    expect(normalized.title).toBe("Example title");
    expect(normalized.summary).toBe("Example summary");
    expect(normalized.publishedAt.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("throws a clear error for invalid publishedAt", () => {
    expect(() =>
      normalizeItem({
        sourceUrl: "https://example.com/b",
        title: "Bad date",
        publishedAt: "not-a-date",
        summary: "Bad source timestamp",
        sourceType: "NEWS"
      })
    ).toThrow("Invalid publishedAt timestamp");
  });
});
