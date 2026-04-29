import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getHomepageViewModel } from "@/lib/view-models/homepage";

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.roleEvidenceCandidate.deleteMany({
    where: {
      roleSlug: "test-homepage-view-model-timeline-copy"
    }
  });

  await prisma.role.deleteMany({
    where: {
      OR: [
        {
          slug: {
            startsWith: "test-homepage-view-model-ranking-"
          }
        },
        {
          slug: "test-homepage-view-model-timeline-copy"
        },
        {
          slug: {
            startsWith: "test-homepage-view-model-zh-"
          }
        }
      ]
    }
  });

  await prisma.roleDictionary.deleteMany({
    where: {
      slug: {
        startsWith: "test-homepage-view-model-zh-"
      }
    }
  });
});

describe("getHomepageViewModel", () => {
  it("surfaces a localized top-10 replacement ranking block", async () => {
    await prisma.role.deleteMany({
      where: {
        slug: {
          startsWith: "test-homepage-view-model-ranking-"
        }
      }
    });

    await prisma.role.createMany({
      data: Array.from({ length: 10 }, (_, index) => {
        const rank = 10 - index;
        const suffix = String(index + 1).padStart(2, "0");

        return {
          slug: `test-homepage-view-model-ranking-${suffix}`,
          socCode: null,
          nameEn: `Test Homepage View Model ${suffix}`,
          nameZh: `测试首页视图模型 ${suffix}`,
          summaryEn: `Ranking fixture ${suffix}.`,
          summaryZh: `排行夹具 ${suffix}。`,
          riskLevel: index % 2 === 0 ? "HIGH" : "MEDIUM",
          replacementRate: 300 + rank,
          riskSummaryEn: `Ranking summary ${suffix}.`,
          riskSummaryZh: `排行摘要 ${suffix}。`,
          riskReasons: [],
          riskModelProvider: index % 2 === 0 ? "google" : "fallback",
          riskModelName: index % 2 === 0 ? "gemini-2.5-flash" : "role-profile",
          riskInferenceRaw: { fixture: suffix },
          ratingStatus: "RATED",
          lastRatedAt: new Date("2026-04-16T00:00:00.000Z"),
          repetitionScore: 4,
          ruleClarityScore: 4,
          transformationScore: 4,
          workflowAutomationScore: 4,
          interpersonalScore: 2,
          physicalityScore: 1,
          ambiguityScore: 2
        };
      })
    });

    const english = await getHomepageViewModel("en");
    const chinese = await getHomepageViewModel("zh");

    expect(english.replacementRankingTitle).toBe("Replacement-rate ranking");
    expect(english.replacementRankingMetricLabel).toBe("Replacement rate");
    expect(english.replacementRanking).toHaveLength(10);
    expect(english.replacementRanking[0]).toMatchObject({
      slug: "test-homepage-view-model-ranking-01",
      name: "Test Homepage View Model 01",
      replacementRate: 310
    });

    expect(chinese.replacementRankingTitle).toBe("替代率排行");
    expect(chinese.replacementRankingMetricLabel).toBe("替代率");
    expect(chinese.replacementRanking[0]).toMatchObject({
      slug: "test-homepage-view-model-ranking-01",
      name: "测试首页视图模型 01",
      replacementRate: 310
    });
  });

  it("replaces no-source fallback card copy when timeline coverage exists", async () => {
    await prisma.role.create({
      data: {
        slug: "test-homepage-view-model-timeline-copy",
        socCode: null,
        nameEn: "Test Homepage Timeline Copy",
        nameZh: "测试首页时间线文案",
        summaryEn: "Test summary.",
        summaryZh: "测试摘要。",
        riskLevel: "MEDIUM",
        replacementRate: 61,
        riskSummaryEn:
          "No role-specific source items are attached yet, so the current score is inferred from the role profile and current AI capability trends.",
        riskSummaryZh: "这个岗位暂时还没有挂接到足够的专属资讯，因此当前分数主要由岗位性质和当前 AI 能力趋势推理得出。",
        riskReasons: [],
        riskModelProvider: "fallback",
        riskModelName: "role-profile",
        riskInferenceRaw: { fixture: true },
        ratingStatus: "RATED",
        lastRatedAt: new Date("2026-04-19T00:00:00.000Z"),
        repetitionScore: 4,
        ruleClarityScore: 4,
        transformationScore: 4,
        workflowAutomationScore: 4,
        interpersonalScore: 2,
        physicalityScore: 1,
        ambiguityScore: 2
      }
    });

    await prisma.roleEvidenceCandidate.create({
      data: {
        roleSlug: "test-homepage-view-model-timeline-copy",
        sourceUrl: "https://news.role-radar.local/homepage-timeline-copy",
        title: "Homepage timeline coverage fixture",
        snippet: "Timeline-backed card copy fixture.",
        sourceLabel: "Role Search",
        evidenceKind: "role_search",
        timelineEligible: true,
        scoreEligible: false
      }
    });

    const english = await getHomepageViewModel("en");
    const chinese = await getHomepageViewModel("zh");
    const englishRole = english.roles.find((role) => role.slug === "test-homepage-view-model-timeline-copy");
    const chineseRole = chinese.roles.find((role) => role.slug === "test-homepage-view-model-timeline-copy");

    expect(englishRole?.risk.summary).toContain("timeline item");
    expect(englishRole?.risk.summary).not.toContain("No role-specific source items are attached yet");
    expect(chineseRole?.risk.summary).toContain("时间线资讯");
    expect(chineseRole?.risk.summary).not.toContain("暂时还没有挂接到足够的专属资讯");
  });

  it("keeps untranslated roles out of zh homepage exposure while preserving them in english", async () => {
    await prisma.roleDictionary.createMany({
      data: [
        {
          source: "test",
          sourceCode: "test-homepage-view-model-zh-untranslated",
          socCode: null,
          slug: "test-homepage-view-model-zh-untranslated",
          nameEn: "Test Homepage View Model Zh Untranslated",
          nameZh: "Test Homepage View Model Zh Untranslated",
          industryCode: "all-roles",
          keywords: ["test", "homepage", "untranslated"],
          isActive: true
        },
        {
          source: "test",
          sourceCode: "test-homepage-view-model-zh-translated",
          socCode: null,
          slug: "test-homepage-view-model-zh-translated",
          nameEn: "Test Homepage View Model Zh Translated",
          nameZh: "测试首页中文岗位",
          industryCode: "all-roles",
          keywords: ["test", "homepage", "translated"],
          isActive: true
        }
      ]
    });

    await prisma.role.createMany({
      data: [
        {
          slug: "test-homepage-view-model-zh-untranslated",
          socCode: null,
          nameEn: "Test Homepage View Model Zh Untranslated",
          nameZh: "Test Homepage View Model Zh Untranslated",
          summaryEn: "Untranslated homepage fixture.",
          summaryZh: "Untranslated homepage fixture.",
          riskLevel: "HIGH",
          replacementRate: 999,
          riskSummaryEn: "Untranslated homepage fixture.",
          riskSummaryZh: "Untranslated homepage fixture.",
          riskReasons: [],
          riskModelProvider: "fallback",
          riskModelName: "role-profile",
          riskInferenceRaw: { fixture: "untranslated" },
          ratingStatus: "RATED",
          lastRatedAt: new Date("2026-04-22T00:00:00.000Z"),
          repetitionScore: 4,
          ruleClarityScore: 4,
          transformationScore: 4,
          workflowAutomationScore: 4,
          interpersonalScore: 2,
          physicalityScore: 1,
          ambiguityScore: 2
        },
        {
          slug: "test-homepage-view-model-zh-translated",
          socCode: null,
          nameEn: "Test Homepage View Model Zh Translated",
          nameZh: "测试首页中文岗位",
          summaryEn: "Translated homepage fixture.",
          summaryZh: "首页中文夹具。",
          riskLevel: "MEDIUM",
          replacementRate: 998,
          riskSummaryEn: "Translated homepage fixture.",
          riskSummaryZh: "首页中文夹具。",
          riskReasons: [],
          riskModelProvider: "fallback",
          riskModelName: "role-profile",
          riskInferenceRaw: { fixture: "translated" },
          ratingStatus: "RATED",
          lastRatedAt: new Date("2026-04-22T00:00:00.000Z"),
          repetitionScore: 4,
          ruleClarityScore: 4,
          transformationScore: 4,
          workflowAutomationScore: 4,
          interpersonalScore: 2,
          physicalityScore: 1,
          ambiguityScore: 2
        }
      ]
    });

    const english = await getHomepageViewModel("en");
    const chinese = await getHomepageViewModel("zh");

    expect(english.roles.some((role) => role.slug === "test-homepage-view-model-zh-untranslated")).toBe(true);
    expect(english.replacementRanking.some((role) => role.slug === "test-homepage-view-model-zh-untranslated")).toBe(true);
    expect(english.searchSuggestions.some((role) => role.slug === "test-homepage-view-model-zh-untranslated")).toBe(true);

    expect(chinese.roles.some((role) => role.slug === "test-homepage-view-model-zh-untranslated")).toBe(false);
    expect(chinese.replacementRanking.some((role) => role.slug === "test-homepage-view-model-zh-untranslated")).toBe(false);
    expect(chinese.searchSuggestions.some((role) => role.slug === "test-homepage-view-model-zh-untranslated")).toBe(false);

    expect(
      chinese.searchSuggestions.find((role) => role.slug === "test-homepage-view-model-zh-translated")
    ).toMatchObject({
      label: "测试首页中文岗位",
      secondaryLabel: ""
    });
  });
});
