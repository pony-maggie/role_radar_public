import { describe, expect, it, vi } from "vitest";
import { discoveryCatalog } from "@/lib/ingest/search-discovery-catalog";
import { fetchSearchDiscoveryItems } from "@/lib/ingest/fetch-search-discovery";

describe("search discovery fetcher", () => {
  it("defines the bounded discovery whitelist", () => {
    expect(discoveryCatalog.map((site) => site.id)).toEqual([
      "discovery-jiqizhixin",
      "discovery-qbitai",
      "discovery-aibase",
      "discovery-infoq-cn",
      "discovery-the-decoder"
    ]);
    expect(discoveryCatalog.every((site) => site.maxResults === 6)).toBe(true);
    expect(discoveryCatalog.some((site) => site.queryTemplates.includes("AI 招聘"))).toBe(true);
  });

  it("normalizes bounded search results into raw source items", async () => {
    const site = discoveryCatalog[0];
    const html = `
      <html>
        <body>
          <a class="result__a" href="https://www.jiqizhixin.com/articles/ai-workflow">AI 工作流进入岗位协作</a>
          <a class="result__snippet">机器之心关于 AI 工作流自动化的报道</a>
        </body>
      </html>
    `;

    const items = await fetchSearchDiscoveryItems(site, {
      fetchHtml: async () => html,
      now: () => new Date("2026-04-16T10:00:00.000Z")
    });

    expect(items[0]).toMatchObject({
      sourceCatalogId: "discovery-jiqizhixin",
      sourceLabel: "机器之心 Search Discovery",
      sourceType: "NEWS",
      sourceUrl: "https://jiqizhixin.com/articles/ai-workflow",
      title: "AI 工作流进入岗位协作"
    });
  });

  it("unwraps redirect URLs and handles reversed attribute order", async () => {
    const site = discoveryCatalog[0];
    const html = `
      <html>
        <body>
          <a href="/l/?uddg=https%3A%2F%2Fwww.jiqizhixin.com%2Farticles%2Fai-workflow" class="result__a">AI 工作流进入岗位协作</a>
          <a href="/l/?uddg=https%3A%2F%2Fwww.jiqizhixin.com%2Farticles%2Fai-workflow" class="result__snippet">机器之心关于 AI 工作流自动化的报道</a>
        </body>
      </html>
    `;

    const items = await fetchSearchDiscoveryItems(site, {
      fetchHtml: async () => html,
      now: () => new Date("2026-04-16T10:00:00.000Z")
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://jiqizhixin.com/articles/ai-workflow",
      title: "AI 工作流进入岗位协作",
      summary: "机器之心关于 AI 工作流自动化的报道"
    });
  });

  it("rejects off-domain result urls after redirect unwrapping", async () => {
    const site = discoveryCatalog[0];
    const html = `
      <html>
        <body>
          <a class="result__a" href="/l/?uddg=https%3A%2F%2Fwww.example.com%2Fnews%2Fai-workflow">Off-domain result</a>
          <a class="result__snippet">This should be rejected</a>
          <a class="result__a" href="https://www.jiqizhixin.com/articles/ai-workflow">AI 工作流进入岗位协作</a>
          <a class="result__snippet">机器之心关于 AI 工作流自动化的报道</a>
        </body>
      </html>
    `;

    const items = await fetchSearchDiscoveryItems(site, {
      fetchHtml: async () => html,
      now: () => new Date("2026-04-16T10:00:00.000Z")
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://jiqizhixin.com/articles/ai-workflow",
      title: "AI 工作流进入岗位协作"
    });
  });

  it("continues across duplicate search results until the unique cap is reached", async () => {
    const site = {
      ...discoveryCatalog[0],
      maxResults: 2,
      queryTemplates: ["first", "second"]
    };
    const fetchHtml = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("first")) {
        return `
          <html>
            <body>
              <a class="result__a" href="/l/?uddg=https%3A%2F%2Fwww.jiqizhixin.com%2Farticles%2Fduplicate">重复结果 A</a>
              <a class="result__snippet">重复结果摘要 A</a>
              <a class="result__a" href="/l/?uddg=https%3A%2F%2Fwww.jiqizhixin.com%2Farticles%2Fduplicate">重复结果 B</a>
              <a class="result__snippet">重复结果摘要 B</a>
            </body>
          </html>
        `;
      }

      return `
        <html>
          <body>
            <a class="result__a" href="https://www.jiqizhixin.com/articles/unique">唯一结果</a>
            <a class="result__snippet">唯一结果摘要</a>
          </body>
        </html>
      `;
    });

    const items = await fetchSearchDiscoveryItems(site, {
      fetchHtml,
      now: () => new Date("2026-04-16T10:00:00.000Z")
    });

    expect(fetchHtml).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.sourceUrl)).toEqual([
      "https://jiqizhixin.com/articles/duplicate",
      "https://jiqizhixin.com/articles/unique"
    ]);
  });

  it("carries the expanded query templates and stops at the new bounded cap", async () => {
    const site = {
      ...discoveryCatalog[0],
      maxResults: 6,
      queryTemplates: ["AI 职位", "AI 招聘"]
    };
    const fetchHtml = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("AI%20%E8%81%8C%E4%BD%8D")) {
        return `
          <html>
            <body>
              <a class="result__a" href="https://www.jiqizhixin.com/articles/job-1">岗位发现 1</a>
              <a class="result__snippet">岗位摘要 1</a>
              <a class="result__a" href="https://www.jiqizhixin.com/articles/job-2">岗位发现 2</a>
              <a class="result__snippet">岗位摘要 2</a>
              <a class="result__a" href="https://www.jiqizhixin.com/articles/job-3">岗位发现 3</a>
              <a class="result__snippet">岗位摘要 3</a>
            </body>
          </html>
        `;
      }

      return `
        <html>
          <body>
            <a class="result__a" href="https://www.jiqizhixin.com/articles/job-4">岗位发现 4</a>
            <a class="result__snippet">岗位摘要 4</a>
            <a class="result__a" href="https://www.jiqizhixin.com/articles/job-5">岗位发现 5</a>
            <a class="result__snippet">岗位摘要 5</a>
            <a class="result__a" href="https://www.jiqizhixin.com/articles/job-6">岗位发现 6</a>
            <a class="result__snippet">岗位摘要 6</a>
            <a class="result__a" href="https://www.jiqizhixin.com/articles/job-7">岗位发现 7</a>
            <a class="result__snippet">岗位摘要 7</a>
          </body>
        </html>
      `;
    });

    const items = await fetchSearchDiscoveryItems(site, {
      fetchHtml,
      now: () => new Date("2026-04-16T10:00:00.000Z")
    });

    expect(fetchHtml).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(6);
  });

  it("canonicalizes tracking variants before deduping search results", async () => {
    const site = {
      ...discoveryCatalog[1],
      maxResults: 2,
      queryTemplates: ["single"]
    };
    const html = `
      <html>
        <body>
          <a class="result__a" href="https://www.qbitai.com/2026/04/story/?utm_medium=rss">量子位结果 A</a>
          <a class="result__snippet">量子位摘要 A</a>
          <a class="result__a" href="https://qbitai.com/2026/04/story/?ref=search">量子位结果 B</a>
          <a class="result__snippet">量子位摘要 B</a>
        </body>
      </html>
    `;

    const items = await fetchSearchDiscoveryItems(site, {
      fetchHtml: async () => html,
      now: () => new Date("2026-04-16T10:00:00.000Z")
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceUrl: "https://qbitai.com/2026/04/story/",
      title: "量子位结果 A"
    });
  });

  it("uses the shared ingest http client on the default fetch path", async () => {
    const site = {
      ...discoveryCatalog[0],
      maxResults: 1,
      queryTemplates: ["AI 职位"]
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <body>
            <a class="result__a" href="https://www.jiqizhixin.com/articles/ai-workflow">AI 工作流进入岗位协作</a>
            <a class="result__snippet">机器之心关于 AI 工作流自动化的报道</a>
          </body>
        </html>
      `
    });
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetchMock);

    try {
      const items = await fetchSearchDiscoveryItems(site);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://html.duckduckgo.com/html/?q=site%3Ajiqizhixin.com%20AI%20%E8%81%8C%E4%BD%8D",
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            Referer: "https://html.duckduckgo.com/html/?q=site%3Ajiqizhixin.com%20AI%20%E8%81%8C%E4%BD%8D"
          })
        })
      );
      expect(items).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
      if (originalFetch) {
        vi.stubGlobal("fetch", originalFetch);
      }
    }
  });
});
