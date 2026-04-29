import { describe, expect, it } from "vitest";
import { roleTranslationOverrides } from "@/lib/dictionaries/role-translation-overrides";
import { sourceCatalog } from "@/lib/ingest/source-catalog";
import { listConfiguredSources } from "@/lib/ingest/source-loader";

describe("source catalog filtering", () => {
  it("adds Chinese overrides for visible AI-relevant roles", () => {
    const expectedTranslations = [
      ["Air Crew Officers", "空勤军官"],
      ["Bioinformatics Scientists", "生物信息学科学家"],
      ["Chief Executives", "首席执行官"],
      ["Chief Sustainability Officers", "首席可持续发展官"],
      ["Climate Change Policy Analysts", "气候变化政策分析师"],
      ["Computer and Information Research Scientists", "计算机与信息研究科学家"],
      ["Computer and Information Systems Managers", "计算机与信息系统经理"],
      ["Computer Hardware Engineers", "计算机硬件工程师"],
      ["Computer Network Architects", "计算机网络架构师"],
      ["Computer Systems Engineers/Architects", "计算机系统工程师/架构师"],
      ["Data Warehousing Specialists", "数据仓库专员"],
      ["Demonstrators and Product Promoters", "产品演示与推广员"],
      ["Digital Forensics Analysts", "数字取证分析师"],
      ["Document Management Specialists", "文档管理专员"],
      ["Marketing Managers", "营销经理"]
    ] as const;

    for (const [nameEn, nameZh] of expectedTranslations) {
      expect(roleTranslationOverrides[nameEn]).toBe(nameZh);
    }
  });

  it("returns only default-enabled sources unless manual sources are requested", () => {
    const defaultSources = listConfiguredSources();
    const allSources = listConfiguredSources({ includeManual: true });

    expect(defaultSources.every((source) => source.enabledByDefault)).toBe(true);
    expect(allSources.length).toBeGreaterThan(defaultSources.length);
    expect(allSources.some((source) => source.tier === "manual_html")).toBe(true);
  });

  it("keeps default-enabled structured media sources observe-only by default", () => {
    const defaultSources = listConfiguredSources();

    expect(defaultSources.length).toBeGreaterThan(0);
    expect(defaultSources.every((source) => source.mappingMode === "observe_only")).toBe(true);
    expect(defaultSources.every((source) => source.roleSlug === undefined)).toBe(true);
  });

  it("keeps official newsroom sources observe-only without direct-mapped fallbacks", () => {
    const officialSources = sourceCatalog.filter((source) => source.class === "official");

    expect(officialSources).toHaveLength(8);
    expect(officialSources.every((source) => source.mappingMode === "observe_only")).toBe(true);
    expect(officialSources.every((source) => source.roleSlug === undefined)).toBe(true);
  });

  it("adds topic hints to default-enabled official and media sources", () => {
    const defaultSources = listConfiguredSources();

    expect(
      defaultSources
        .filter((source) => source.class === "official" || source.class === "media")
        .every((source) => Array.isArray(source.topicHints) && source.topicHints.length > 0)
    ).toBe(true);
  });

  it("enables all media sources by default", () => {
    const defaultSources = listConfiguredSources();

    expect(defaultSources.map((source) => source.id)).toEqual(
      expect.arrayContaining([
        "official-openai-news",
        "official-hugging-face-blog",
        "official-github-ai-ml",
        "official-microsoft-ai",
        "media-the-decoder-ai",
        "media-36kr-tech",
        "media-ifanr",
        "media-techcrunch-ai",
        "media-venturebeat-ai",
        "media-qbitai-ai",
        "media-aibase-ai",
        "media-infoq-ai-ml"
      ])
    );
    expect(defaultSources.map((source) => source.id)).toHaveLength(12);
  });

  it("keeps default-enabled sources at useful but bounded caps", () => {
    const enabledSources = sourceCatalog.filter((entry) => entry.enabledByDefault);
    const byId = new Map(enabledSources.map((entry) => [entry.id, entry]));

    expect(enabledSources).not.toHaveLength(0);
    expect(enabledSources.every((entry) => (entry.maxItems ?? 0) >= 10)).toBe(true);
    expect(enabledSources.every((entry) => (entry.maxItems ?? 0) <= 14)).toBe(true);
    expect(byId.get("official-openai-news")?.maxItems).toBe(14);
    expect(byId.get("official-hugging-face-blog")?.maxItems).toBe(12);
    expect(byId.get("official-github-ai-ml")?.maxItems).toBe(12);
    expect(byId.get("official-microsoft-ai")?.maxItems).toBe(12);
    expect(byId.get("media-the-decoder-ai")?.maxItems).toBe(10);
    expect(byId.get("media-36kr-tech")?.maxItems).toBe(14);
    expect(byId.get("media-ifanr")?.maxItems).toBe(14);
    expect(byId.get("media-techcrunch-ai")?.maxItems).toBe(14);
    expect(byId.get("media-venturebeat-ai")?.maxItems).toBe(14);
    expect(byId.get("media-qbitai-ai")?.maxItems).toBe(10);
    expect(byId.get("media-aibase-ai")?.maxItems).toBe(10);
    expect(byId.get("media-infoq-ai-ml")?.maxItems).toBe(10);
  });

  it("prefers rss for the most scraper-friendly official sources", () => {
    const defaultSources = listConfiguredSources();
    const openAiSource = defaultSources.find((source) => source.id === "official-openai-news");
    const huggingFaceSource = defaultSources.find((source) => source.id === "official-hugging-face-blog");
    const githubSource = defaultSources.find((source) => source.id === "official-github-ai-ml");

    expect(openAiSource?.transport).toBe("rss");
    expect(huggingFaceSource?.transport).toBe("rss");
    expect(githubSource?.transport).toBe("html");
    expect(openAiSource?.maxItems).toBeGreaterThan(0);
    expect(huggingFaceSource?.maxItems).toBeGreaterThan(0);
  });

  it("uses rss for the proven default-enabled Chinese shortlist", () => {
    const defaultSources = listConfiguredSources();
    const byId = new Map(defaultSources.map((source) => [source.id, source]));

    expect(byId.get("media-36kr-tech")).toMatchObject({
      transport: "rss",
      tier: "structured",
      enabledByDefault: true
    });
    expect(byId.get("media-ifanr")).toMatchObject({
      transport: "rss",
      tier: "structured",
      enabledByDefault: true
    });
  });

  it("keeps non-working Chinese rss candidates cataloged but out of the default ingest set", () => {
    const defaultSources = listConfiguredSources();
    const allSources = listConfiguredSources({ includeManual: true });

    expect(defaultSources.some((source) => source.id === "media-huxiu")).toBe(false);
    expect(defaultSources.some((source) => source.id === "media-geekpark")).toBe(false);
    expect(defaultSources.some((source) => source.id === "media-jiqizhixin-ai")).toBe(false);
    expect(allSources.find((source) => source.id === "media-huxiu")).toMatchObject({
      transport: "rss",
      enabledByDefault: false
    });
    expect(allSources.find((source) => source.id === "media-geekpark")).toMatchObject({
      transport: "rss",
      enabledByDefault: false
    });
    expect(allSources.find((source) => source.id === "media-jiqizhixin-ai")).toMatchObject({
      transport: "rss",
      enabledByDefault: false
    });
  });

  it("keeps only disabled official watchlist sources out of the default ingest set", () => {
    const defaultSources = listConfiguredSources();

    expect(defaultSources.some((source) => source.id === "official-anthropic-news")).toBe(false);
    expect(defaultSources.some((source) => source.id === "official-google-deepmind-blog")).toBe(false);
    expect(defaultSources.some((source) => source.id === "official-cohere-blog")).toBe(false);
    expect(defaultSources.some((source) => source.id === "official-mistral-news")).toBe(false);
  });

  it("keeps x and twitter out of the maintained allowlist", () => {
    expect(sourceCatalog.every((source) => !/twitter|x\.com/i.test(source.url))).toBe(true);
  });

  it("includes bilingual manual watchlist sources for operator review", () => {
    const allSources = listConfiguredSources({ includeManual: true });

    expect(allSources.some((source) => source.id === "official-github-ai-ml")).toBe(true);
    expect(allSources.some((source) => source.id === "official-microsoft-ai")).toBe(true);
    expect(allSources.some((source) => source.id === "official-cohere-blog")).toBe(true);
    expect(allSources.some((source) => source.id === "official-mistral-news")).toBe(true);
    expect(allSources.some((source) => source.id === "media-jiqizhixin-ai")).toBe(true);
    expect(allSources.some((source) => source.id === "media-qbitai-ai")).toBe(true);
    expect(allSources.some((source) => source.id === "media-aibase-ai")).toBe(true);
    expect(allSources.some((source) => source.id === "media-the-decoder-ai")).toBe(true);
    expect(allSources.some((source) => source.locale === "zh")).toBe(true);
  });

  it("keeps jobs sources cataloged as manual job postings", () => {
    const jobsSources = sourceCatalog.filter((source) => source.class === "jobs");

    expect(jobsSources).toHaveLength(2);
    expect(jobsSources.every((source) => source.sourceType === "JOB_POSTING")).toBe(true);
    expect(jobsSources.every((source) => source.enabledByDefault === false)).toBe(true);
    expect(jobsSources.every((source) => source.mappingMode === "direct_mapped")).toBe(true);
  });

  it("can target disabled official sources explicitly by id for one-off validation", () => {
    const targetedSources = listConfiguredSources({
      ids: ["official-github-ai-ml", "official-microsoft-ai"]
    });

    expect(targetedSources.map((source) => source.id)).toEqual([
      "official-github-ai-ml",
      "official-microsoft-ai"
    ]);
    expect(
      targetedSources.find((source) => source.id === "official-github-ai-ml")?.enabledByDefault
    ).toBe(true);
    expect(
      targetedSources.find((source) => source.id === "official-microsoft-ai")?.enabledByDefault
    ).toBe(true);
  });
});
