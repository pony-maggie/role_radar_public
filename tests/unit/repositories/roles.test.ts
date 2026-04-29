import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { RatingStatus, RiskLevel } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { persistSourceItemDecision } from "@/lib/repositories/source-items";
import {
  getRoleBySlug,
  listHomepageRoles,
  listHomepageReplacementRanking,
  listTrackedRoleSlugs,
  listTopicRoles,
  listRelatedRoles,
  mergeHomepageRoles,
  sortDictionaryRolesForDisplay,
  sortRolesForHomepage
} from "@/lib/repositories/roles";

type SortableRole = {
  id: string;
  slug: string;
  riskLevel: RiskLevel;
  ratingStatus: RatingStatus;
  nameZh: string;
  nameEn: string;
  publicTimelineCount?: number;
};

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  const testCatalogIds = [
    "test-homepage-coverage-actors",
    "test-homepage-coverage-customer-service"
  ];

  await prisma.sourceItemInference.deleteMany({
    where: {
      sourceItem: {
        sourceCatalogId: {
          in: testCatalogIds
        }
      }
    }
  });

  await prisma.sourceItemRoleDecision.deleteMany({
    where: {
      sourceItem: {
        sourceCatalogId: {
          in: testCatalogIds
        }
      }
    }
  });

  await prisma.sourceItem.deleteMany({
    where: {
      sourceCatalogId: {
        in: testCatalogIds
      }
    }
  });

  await prisma.roleEvidenceCandidate.deleteMany({
    where: {
      roleSlug: {
        in: ["actors", "test-homepage-discovery-covered"]
      }
    }
  });

  await prisma.role.deleteMany({
    where: {
      slug: {
        in: ["test-homepage-uncovered-rated", "test-homepage-discovery-covered"]
      }
    }
  });

  await prisma.role.deleteMany({
    where: {
      slug: {
        startsWith: "test-homepage-ranking-"
      }
    }
  });

  await prisma.role.deleteMany({
    where: {
      slug: "media-programming-directors"
    }
  });

  await prisma.role.deleteMany({
    where: {
      slug: {
        startsWith: "test-related-role-"
      }
    }
  });

  await prisma.roleDictionary.deleteMany({
    where: {
      slug: {
        startsWith: "test-related-role-"
      }
    }
  });

  await prisma.role.deleteMany({
    where: {
      slug: {
        startsWith: "test-topic-role-"
      }
    }
  });

  await prisma.roleDictionary.deleteMany({
    where: {
      slug: {
        startsWith: "test-topic-role-"
      }
    }
  });

  await prisma.industryDictionary.deleteMany({
    where: {
      code: "test-related-industry"
    }
  });

  await prisma.industryDictionary.deleteMany({
    where: {
      code: "test-topic-industry"
    }
  });

  await prisma.role.deleteMany({
    where: {
      slug: {
        startsWith: "test-tracked-role-"
      }
    }
  });
});

describe("sortRolesForHomepage", () => {
  it("orders covered roles ahead of uncovered roles before falling back to severity and name", () => {
    const roles: SortableRole[] = [
      {
        id: "1",
        slug: "alpha",
        riskLevel: "HIGH",
        ratingStatus: "RATED",
        nameEn: "Alpha",
        nameZh: "Alpha",
        publicTimelineCount: 0
      },
      {
        id: "2",
        slug: "zeta",
        riskLevel: "LOW",
        ratingStatus: "RATED",
        nameEn: "Zeta",
        nameZh: "Zeta",
        publicTimelineCount: 2
      },
      {
        id: "3",
        slug: "beta",
        riskLevel: "HIGH",
        ratingStatus: "RATED",
        nameEn: "Beta",
        nameZh: "Beta",
        publicTimelineCount: 1
      },
      {
        id: "4",
        slug: "gamma",
        riskLevel: "MEDIUM",
        ratingStatus: "INSUFFICIENT_SIGNAL",
        nameEn: "Gamma",
        nameZh: "Gamma",
        publicTimelineCount: 0
      }
    ];

    const sorted = sortRolesForHomepage(roles);

    expect(sorted.map((role) => role.id)).toEqual(["2", "3", "1", "4"]);
  });

  it("fills the homepage with dictionary roles after rated roles", () => {
    const ratedRoles: SortableRole[] = [
      {
        id: "1",
        slug: "customer-service-representative",
        riskLevel: "HIGH",
        ratingStatus: "RATED",
        nameEn: "Customer Service Representative",
        nameZh: "客户服务专员"
      }
    ];
    const dictionaryRoles: SortableRole[] = [
      {
        id: "2",
        slug: "customer-service-representative",
        riskLevel: "LOW",
        ratingStatus: "INSUFFICIENT_SIGNAL",
        nameEn: "Customer Service Representatives",
        nameZh: "客户服务专员"
      },
      {
        id: "3",
        slug: "actors",
        riskLevel: "LOW",
        ratingStatus: "INSUFFICIENT_SIGNAL",
        nameEn: "Actors",
        nameZh: "演员"
      },
      {
        id: "4",
        slug: "actuaries",
        riskLevel: "LOW",
        ratingStatus: "INSUFFICIENT_SIGNAL",
        nameEn: "Actuaries",
        nameZh: "精算师"
      }
    ];

    const merged = mergeHomepageRoles(ratedRoles, dictionaryRoles, 3);

    expect(merged.map((role) => role.slug)).toEqual([
      "customer-service-representative",
      "actors",
      "actuaries"
    ]);
  });

  it("ranks dictionary-only roles with public coverage ahead of uncovered rated roles", async () => {
    await prisma.role.deleteMany({
      where: {
        slug: {
          in: ["actors", "test-homepage-uncovered-rated"]
        }
      }
    });

    await prisma.role.create({
      data: {
        slug: "test-homepage-uncovered-rated",
        socCode: null,
        nameEn: "Test Homepage Uncovered Rated",
        nameZh: "测试首页未覆盖已评分岗位",
        summaryEn: "A rated but currently uncovered homepage role.",
        summaryZh: "一个已评分但当前没有公开时间线覆盖的首页岗位。",
        riskLevel: "HIGH",
        replacementRate: 67,
        riskSummaryEn: "Rated risk summary.",
        riskSummaryZh: "已评分风险摘要。",
        riskReasons: [],
        riskModelProvider: "fallback",
        riskModelName: "role-profile",
        riskInferenceRaw: { fixture: true },
        ratingStatus: "RATED",
        lastRatedAt: new Date("2026-04-16T00:00:00.000Z"),
        repetitionScore: 4,
        ruleClarityScore: 4,
        transformationScore: 4,
        workflowAutomationScore: 4,
        interpersonalScore: 2,
        physicalityScore: 1,
        ambiguityScore: 2
      }
    });

    await persistSourceItemDecision(
      {
        sourceCatalogId: "test-homepage-coverage-actors",
        sourceLabel: "Homepage Coverage Actors",
        sourceUrl: "https://news.role-radar.local/homepage-coverage-actors",
        sourceType: "NEWS",
        title: "Studios adopt AI doubles in production workflows",
        summaryEn: "Public reporting ties AI doubles to actor-facing production changes.",
        summaryZh: null,
        publishedAt: new Date("2026-04-15T00:00:00.000Z"),
        mappingMode: "observe_only"
      },
      {
        status: "accepted",
        primaryRoleSlug: "actors",
        reason: "Accepted public timeline evidence for actors.",
        confidence: "high",
        candidateSlugs: ["actors"],
        matchedKeywords: ["actors", "production"],
        inference: {
          modelProvider: "google",
          modelName: "gemini-2.5-flash",
          assignedRoleSlug: "actors",
          inferenceSummaryEn: "Actors have visible public evidence tied to workflow changes.",
          inferenceSummaryZh: null,
          impactDirection: "increase",
          relevance: "high",
          signalWeight: 0.7,
          rawJson: {
            roleSlug: "actors",
            impactDirection: "increase"
          }
        }
      }
    );

    const homepageRoles = await listHomepageRoles(2000);
    const actorsIndex = homepageRoles.findIndex((role) => role.slug === "actors");
    const customerServiceIndex = homepageRoles.findIndex(
      (role) => role.slug === "test-homepage-uncovered-rated"
    );

    expect(actorsIndex).toBeGreaterThanOrEqual(0);
    expect(customerServiceIndex).toBeGreaterThanOrEqual(0);
    expect(actorsIndex).toBeLessThan(customerServiceIndex);
  });

  it("counts timeline-eligible role discovery candidates toward homepage ordering", async () => {
    await prisma.role.upsert({
      where: {
        slug: "test-homepage-discovery-covered"
      },
      create: {
        slug: "test-homepage-discovery-covered",
        socCode: null,
        nameEn: "Test Homepage Discovery Covered",
        nameZh: "测试首页搜索补洞岗位",
        summaryEn: "A role covered only through role discovery candidates.",
        summaryZh: "一个只通过岗位搜索补洞获得时间线覆盖的岗位。",
        riskLevel: "MEDIUM",
        replacementRate: 55,
        riskSummaryEn: "Discovery-covered fixture.",
        riskSummaryZh: "搜索补洞夹具。",
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
      },
      update: {
        nameEn: "Test Homepage Discovery Covered",
        nameZh: "测试首页搜索补洞岗位",
        riskLevel: "MEDIUM",
        replacementRate: 55,
        riskSummaryEn: "Discovery-covered fixture.",
        riskSummaryZh: "搜索补洞夹具。",
        ratingStatus: "RATED"
      }
    });

    await prisma.role.upsert({
      where: {
        slug: "test-homepage-uncovered-rated"
      },
      create: {
        slug: "test-homepage-uncovered-rated",
        socCode: null,
        nameEn: "Test Homepage Uncovered Rated",
        nameZh: "测试首页未覆盖已评分岗位",
        summaryEn: "A rated but currently uncovered homepage role.",
        summaryZh: "一个已评分但当前没有公开时间线覆盖的首页岗位。",
        riskLevel: "HIGH",
        replacementRate: 67,
        riskSummaryEn: "Rated risk summary.",
        riskSummaryZh: "已评分风险摘要。",
        riskReasons: [],
        riskModelProvider: "fallback",
        riskModelName: "role-profile",
        riskInferenceRaw: { fixture: true },
        ratingStatus: "RATED",
        lastRatedAt: new Date("2026-04-16T00:00:00.000Z"),
        repetitionScore: 4,
        ruleClarityScore: 4,
        transformationScore: 4,
        workflowAutomationScore: 4,
        interpersonalScore: 2,
        physicalityScore: 1,
        ambiguityScore: 2
      },
      update: {
        nameEn: "Test Homepage Uncovered Rated",
        nameZh: "测试首页未覆盖已评分岗位",
        riskLevel: "HIGH",
        replacementRate: 67,
        riskSummaryEn: "Rated risk summary.",
        riskSummaryZh: "已评分风险摘要。",
        ratingStatus: "RATED"
      }
    });

    await prisma.roleEvidenceCandidate.create({
      data: {
        roleSlug: "test-homepage-discovery-covered",
        sourceUrl: "https://news.role-radar.local/discovery-covered-role",
        title: "AI tooling shifts work for a discovery-covered fixture role",
        snippet: "Timeline-eligible discovery candidate for homepage ordering coverage.",
        sourceLabel: "Role Search",
        evidenceKind: "role_search",
        timelineEligible: true,
        scoreEligible: false
      }
    });

    const homepageRoles = await listHomepageRoles(2000);
    const discoveryCoveredIndex = homepageRoles.findIndex(
      (role) => role.slug === "test-homepage-discovery-covered"
    );
    const uncoveredIndex = homepageRoles.findIndex(
      (role) => role.slug === "test-homepage-uncovered-rated"
    );

    expect(discoveryCoveredIndex).toBeGreaterThanOrEqual(0);
    expect(uncoveredIndex).toBeGreaterThanOrEqual(0);
    expect(discoveryCoveredIndex).toBeLessThan(uncoveredIndex);
  });

  it("keeps rated roles ahead of dictionary-only roles when public coverage is comparable", () => {
    const merged = mergeHomepageRoles(
      [
        {
          id: "1",
          slug: "customer-service-representative",
          riskLevel: "HIGH",
          ratingStatus: "RATED",
          nameEn: "Customer Service Representatives",
          nameZh: "客户服务专员",
          publicTimelineCount: 1
        }
      ],
      [
        {
          id: "2",
          slug: "actors",
          riskLevel: "LOW",
          ratingStatus: "INSUFFICIENT_SIGNAL",
          nameEn: "Actors",
          nameZh: "演员",
          publicTimelineCount: 1
        }
      ],
      2
    );

    expect(merged.map((role) => role.slug)).toEqual([
      "customer-service-representative",
      "actors"
    ]);
  });
});

describe("sortDictionaryRolesForDisplay", () => {
  it("prefers common translated roles before untranslated or rare entries", () => {
    const roles: SortableRole[] = [
      {
        id: "1",
        slug: "zoologists",
        riskLevel: "LOW",
        ratingStatus: "INSUFFICIENT_SIGNAL",
        nameEn: "Zoologists",
        nameZh: "Zoologists"
      },
      {
        id: "2",
        slug: "technical-writers",
        riskLevel: "LOW",
        ratingStatus: "INSUFFICIENT_SIGNAL",
        nameEn: "Technical Writers",
        nameZh: "技术写作专员"
      },
      {
        id: "3",
        slug: "customer-service-representative",
        riskLevel: "LOW",
        ratingStatus: "INSUFFICIENT_SIGNAL",
        nameEn: "Customer Service Representatives",
        nameZh: "客户服务专员"
      }
    ];

    const sorted = sortDictionaryRolesForDisplay(roles);

    expect(sorted.map((role) => role.slug)).toEqual([
      "customer-service-representative",
      "technical-writers",
      "zoologists"
    ]);
  });
});

describe("listTrackedRoleSlugs", () => {
  it("returns tracked role slugs in stable ascending slug order", async () => {
    await prisma.role.createMany({
      data: [
        {
          slug: "test-tracked-role-zulu",
          socCode: null,
          nameEn: "Test Tracked Role Zulu",
          nameZh: "测试跟踪岗位 Zulu",
          summaryEn: "Fixture role.",
          summaryZh: "测试岗位。",
          riskLevel: "LOW",
          replacementRate: null,
          riskSummaryEn: null,
          riskSummaryZh: null,
          riskReasons: [],
          riskModelProvider: "fallback",
          riskModelName: "role-profile",
          riskInferenceRaw: { fixture: true },
          ratingStatus: "INSUFFICIENT_SIGNAL",
          lastRatedAt: null,
          repetitionScore: 0,
          ruleClarityScore: 0,
          transformationScore: 0,
          workflowAutomationScore: 0,
          interpersonalScore: 0,
          physicalityScore: 0,
          ambiguityScore: 0
        },
        {
          slug: "test-tracked-role-alpha",
          socCode: null,
          nameEn: "Test Tracked Role Alpha",
          nameZh: "测试跟踪岗位 Alpha",
          summaryEn: "Fixture role.",
          summaryZh: "测试岗位。",
          riskLevel: "LOW",
          replacementRate: null,
          riskSummaryEn: null,
          riskSummaryZh: null,
          riskReasons: [],
          riskModelProvider: "fallback",
          riskModelName: "role-profile",
          riskInferenceRaw: { fixture: true },
          ratingStatus: "INSUFFICIENT_SIGNAL",
          lastRatedAt: null,
          repetitionScore: 0,
          ruleClarityScore: 0,
          transformationScore: 0,
          workflowAutomationScore: 0,
          interpersonalScore: 0,
          physicalityScore: 0,
          ambiguityScore: 0
        }
      ]
    });

    const slugs = await listTrackedRoleSlugs();
    const alphaIndex = slugs.indexOf("test-tracked-role-alpha");
    const zuluIndex = slugs.indexOf("test-tracked-role-zulu");

    expect(slugs).toEqual([...slugs].sort((left, right) => left.localeCompare(right)));
    expect(alphaIndex).toBeGreaterThanOrEqual(0);
    expect(zuluIndex).toBeGreaterThanOrEqual(0);
    expect(alphaIndex).toBeLessThan(zuluIndex);
  });
});

describe("listTopicRoles", () => {
  it("lists top replacement-rate roles for ranking topics", async () => {
    await prisma.industryDictionary.upsert({
      where: {
        code: "test-topic-industry"
      },
      create: {
        source: "test",
        code: "test-topic-industry",
        nameEn: "Test Topic Industry",
        nameZh: "测试专题行业",
        level: 1,
        sortOrder: 999
      },
      update: {
        source: "test",
        nameEn: "Test Topic Industry",
        nameZh: "测试专题行业",
        level: 1,
        sortOrder: 999
      }
    });

    await prisma.roleDictionary.createMany({
      data: [
        {
          source: "test",
          sourceCode: "test-topic-role-ranking-high",
          socCode: null,
          slug: "test-topic-role-ranking-high",
          nameEn: "Test Topic Role Ranking High",
          nameZh: "测试专题高替代率岗位",
          industryCode: "test-topic-industry",
          keywords: ["billing", "invoice", "automation"],
          isActive: true
        },
        {
          source: "test",
          sourceCode: "test-topic-role-ranking-mid",
          socCode: null,
          slug: "test-topic-role-ranking-mid",
          nameEn: "Test Topic Role Ranking Mid",
          nameZh: "测试专题中替代率岗位",
          industryCode: "test-topic-industry",
          keywords: ["invoice", "review", "workflow"],
          isActive: true
        },
        {
          source: "test",
          sourceCode: "test-topic-role-ranking-low",
          socCode: null,
          slug: "test-topic-role-ranking-low",
          nameEn: "Test Topic Role Ranking Low",
          nameZh: "测试专题低替代率岗位",
          industryCode: "test-topic-industry",
          keywords: ["support", "routing", "calls"],
          isActive: true
        }
      ]
    });

    await prisma.role.createMany({
      data: [
        {
          slug: "test-topic-role-ranking-high",
          socCode: null,
          nameEn: "Test Topic Role Ranking High",
          nameZh: "测试专题高替代率岗位",
          summaryEn: "High ranking topic fixture.",
          summaryZh: "高排名专题测试夹具。",
          riskLevel: "HIGH",
          replacementRate: 72,
          riskSummaryEn: "High ranking fixture.",
          riskSummaryZh: "高排名夹具。",
          riskReasons: [],
          riskModelProvider: "fallback",
          riskModelName: "role-profile",
          riskInferenceRaw: { fixture: "high" },
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
          slug: "test-topic-role-ranking-mid",
          socCode: null,
          nameEn: "Test Topic Role Ranking Mid",
          nameZh: "测试专题中替代率岗位",
          summaryEn: "Mid ranking topic fixture.",
          summaryZh: "中排名专题测试夹具。",
          riskLevel: "MEDIUM",
          replacementRate: 60,
          riskSummaryEn: "Mid ranking fixture.",
          riskSummaryZh: "中排名夹具。",
          riskReasons: [],
          riskModelProvider: "fallback",
          riskModelName: "role-profile",
          riskInferenceRaw: { fixture: "mid" },
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
          slug: "test-topic-role-ranking-low",
          socCode: null,
          nameEn: "Test Topic Role Ranking Low",
          nameZh: "测试专题低替代率岗位",
          summaryEn: "Low ranking topic fixture.",
          summaryZh: "低排名专题测试夹具。",
          riskLevel: "LOW",
          replacementRate: 52,
          riskSummaryEn: "Low ranking fixture.",
          riskSummaryZh: "低排名夹具。",
          riskReasons: [],
          riskModelProvider: "fallback",
          riskModelName: "role-profile",
          riskInferenceRaw: { fixture: "low" },
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

    const roles = await listTopicRoles({
      limit: 5,
      includeSlugs: [
        "test-topic-role-ranking-high",
        "test-topic-role-ranking-mid",
        "test-topic-role-ranking-low"
      ],
      minReplacementRate: 55
    });

    expect(roles.map((role) => role.slug)).toEqual([
      "test-topic-role-ranking-high",
      "test-topic-role-ranking-mid"
    ]);
    for (let index = 1; index < roles.length; index += 1) {
      expect(roles[index - 1]?.replacementRate ?? 0).toBeGreaterThanOrEqual(
        roles[index]?.replacementRate ?? 0
      );
    }
  });

  it("filters topic roles by keywords for cluster topics", async () => {
    await prisma.industryDictionary.upsert({
      where: {
        code: "test-topic-industry"
      },
      create: {
        source: "test",
        code: "test-topic-industry",
        nameEn: "Test Topic Industry",
        nameZh: "测试专题行业",
        level: 1,
        sortOrder: 999
      },
      update: {
        source: "test",
        nameEn: "Test Topic Industry",
        nameZh: "测试专题行业",
        level: 1,
        sortOrder: 999
      }
    });

    await prisma.roleDictionary.createMany({
      data: [
        {
          source: "test",
          sourceCode: "test-topic-role-cluster-match",
          socCode: null,
          slug: "test-topic-role-cluster-match",
          nameEn: "Test Topic Role Cluster Match",
          nameZh: "测试专题匹配岗位",
          industryCode: "test-topic-industry",
          keywords: ["billing", "invoice", "administrative"],
          isActive: true
        },
        {
          source: "test",
          sourceCode: "test-topic-role-cluster-unrelated",
          socCode: null,
          slug: "test-topic-role-cluster-unrelated",
          nameEn: "Test Topic Role Cluster Unrelated",
          nameZh: "测试专题无关岗位",
          industryCode: "test-topic-industry",
          keywords: ["maintenance", "field", "operations"],
          isActive: true
        }
      ]
    });

    await prisma.role.createMany({
      data: [
        {
          slug: "test-topic-role-cluster-match",
          socCode: null,
          nameEn: "Test Topic Role Cluster Match",
          nameZh: "测试专题匹配岗位",
          summaryEn: "Matching cluster topic fixture.",
          summaryZh: "匹配专题测试夹具。",
          riskLevel: "HIGH",
          replacementRate: 66,
          riskSummaryEn: "Matching cluster fixture.",
          riskSummaryZh: "匹配专题夹具。",
          riskReasons: [],
          riskModelProvider: "fallback",
          riskModelName: "role-profile",
          riskInferenceRaw: { fixture: "match" },
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
          slug: "test-topic-role-cluster-unrelated",
          socCode: null,
          nameEn: "Test Topic Role Cluster Unrelated",
          nameZh: "测试专题无关岗位",
          summaryEn: "Unrelated cluster topic fixture.",
          summaryZh: "无关专题测试夹具。",
          riskLevel: "LOW",
          replacementRate: 41,
          riskSummaryEn: "Unrelated cluster fixture.",
          riskSummaryZh: "无关专题夹具。",
          riskReasons: [],
          riskModelProvider: "fallback",
          riskModelName: "role-profile",
          riskInferenceRaw: { fixture: "unrelated" },
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

    const roles = await listTopicRoles({
      limit: 20,
      includeSlugs: ["test-topic-role-cluster-match", "test-topic-role-cluster-unrelated"],
      includeKeywords: ["billing", "invoice", "administrative"]
    });

    expect(roles.map((role) => role.slug)).toEqual(["test-topic-role-cluster-match"]);
  });

  it("matches cluster topic keywords across close lexical variants", async () => {
    await prisma.industryDictionary.upsert({
      where: {
        code: "test-topic-industry"
      },
      create: {
        source: "test",
        code: "test-topic-industry",
        nameEn: "Test Topic Industry",
        nameZh: "测试专题行业",
        level: 1,
        sortOrder: 999
      },
      update: {
        source: "test",
        nameEn: "Test Topic Industry",
        nameZh: "测试专题行业",
        level: 1,
        sortOrder: 999
      }
    });

    await prisma.roleDictionary.createMany({
      data: [
        {
          source: "test",
          sourceCode: "test-topic-role-cluster-financial",
          socCode: null,
          slug: "test-topic-role-cluster-financial",
          nameEn: "Test Topic Role Cluster Financial",
          nameZh: "测试专题财务岗位",
          industryCode: "test-topic-industry",
          keywords: ["financial", "reporting", "analysis"],
          isActive: true
        },
        {
          source: "test",
          sourceCode: "test-topic-role-cluster-lawyers",
          socCode: null,
          slug: "test-topic-role-cluster-lawyers",
          nameEn: "Test Topic Role Cluster Lawyers",
          nameZh: "测试专题法律岗位",
          industryCode: "test-topic-industry",
          keywords: ["lawyers", "contracts", "review"],
          isActive: true
        }
      ]
    });

    await prisma.role.createMany({
      data: [
        {
          slug: "test-topic-role-cluster-financial",
          socCode: null,
          nameEn: "Test Topic Role Cluster Financial",
          nameZh: "测试专题财务岗位",
          summaryEn: "Financial topic fixture.",
          summaryZh: "财务专题测试夹具。",
          riskLevel: "HIGH",
          replacementRate: 66,
          riskSummaryEn: "Financial cluster fixture.",
          riskSummaryZh: "财务专题夹具。",
          riskReasons: [],
          riskModelProvider: "fallback",
          riskModelName: "role-profile",
          riskInferenceRaw: { fixture: "financial" },
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
          slug: "test-topic-role-cluster-lawyers",
          socCode: null,
          nameEn: "Test Topic Role Cluster Lawyers",
          nameZh: "测试专题法律岗位",
          summaryEn: "Legal topic fixture.",
          summaryZh: "法律专题测试夹具。",
          riskLevel: "MEDIUM",
          replacementRate: 58,
          riskSummaryEn: "Legal cluster fixture.",
          riskSummaryZh: "法律专题夹具。",
          riskReasons: [],
          riskModelProvider: "fallback",
          riskModelName: "role-profile",
          riskInferenceRaw: { fixture: "lawyers" },
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

    const roles = await listTopicRoles({
      limit: 20,
      includeSlugs: ["test-topic-role-cluster-financial", "test-topic-role-cluster-lawyers"],
      includeKeywords: ["finance", "lawyer"]
    });

    expect(roles.map((role) => role.slug)).toEqual([
      "test-topic-role-cluster-financial",
      "test-topic-role-cluster-lawyers"
    ]);
  });
});

describe("getRoleBySlug", () => {
  it("returns stored gemini replacement-rate artifacts for rated roles", async () => {
    const dictionaryRole = await prisma.roleDictionary.findUniqueOrThrow({
      where: { slug: "actuaries" },
      select: { id: true }
    });

    await prisma.role.upsert({
      where: { slug: "actuaries" },
      create: {
        dictionaryRoleId: dictionaryRole.id,
        slug: "actuaries",
        socCode: null,
        nameEn: "Actuaries",
        nameZh: "精算师",
        summaryEn: "A test-only rated role fixture.",
        summaryZh: "仅用于测试的已评分岗位。",
        riskLevel: "HIGH",
        replacementRate: 68,
        riskSummaryEn:
          "Support triage and resolution workflows are increasingly routed through AI-first systems.",
        riskSummaryZh: "客户支持分诊和处理流程正越来越多地被导向 AI 优先系统。",
        riskReasons: [
          {
            kind: "test",
            titleEn: "Stored fixture",
            titleZh: "测试夹具",
            detailEn: "This role exists only to verify stored replacement-rate artifacts.",
            detailZh: "该岗位仅用于验证持久化的替代率结果。"
          }
        ],
        riskModelProvider: "google",
        riskModelName: "gemini-2.5-flash",
        riskInferenceRaw: {
          replacementRate: 68,
          summaryEn:
            "Support triage and resolution workflows are increasingly routed through AI-first systems."
        },
        ratingStatus: "RATED",
        lastRatedAt: new Date("2026-01-01T00:00:00.000Z"),
        repetitionScore: 3,
        ruleClarityScore: 3,
        transformationScore: 3,
        workflowAutomationScore: 3,
        interpersonalScore: 2,
        physicalityScore: 1,
        ambiguityScore: 2
      },
      update: {
        replacementRate: 68,
        riskSummaryEn:
          "Support triage and resolution workflows are increasingly routed through AI-first systems.",
        riskSummaryZh: "客户支持分诊和处理流程正越来越多地被导向 AI 优先系统。",
        riskLevel: "HIGH",
        ratingStatus: "RATED",
        riskModelProvider: "google",
        riskModelName: "gemini-2.5-flash",
        riskInferenceRaw: {
          replacementRate: 68,
          summaryEn:
            "Support triage and resolution workflows are increasingly routed through AI-first systems."
        }
      }
    });

    const role = await getRoleBySlug("actuaries");

    expect(role).toMatchObject({
      slug: "actuaries",
      replacementRate: 68,
      riskSummaryEn:
        "Support triage and resolution workflows are increasingly routed through AI-first systems."
    });
    expect(role?.riskModelProvider).toBe("google");
    expect(role?.riskModelName).toBe("gemini-2.5-flash");
  });

  it("bootstraps dictionary-only roles with a profile-based replacement estimate", async () => {
    process.env.GEMINI_ENABLED = "0";
    process.env.MINIMAX_ENABLED = "0";

    const role = await getRoleBySlug("actors");

    expect(role?.slug).toBe("actors");
    expect(role?.ratingStatus).toBe("RATED");
    expect(role?.replacementRate).not.toBeNull();
    expect(role?.riskSummaryEn).toContain("role profile");
  });

  it("bootstraps dictionary-only roles idempotently under concurrent reads", async () => {
    process.env.GEMINI_ENABLED = "0";
    process.env.MINIMAX_ENABLED = "0";

    await prisma.role.deleteMany({
      where: {
        slug: "media-programming-directors"
      }
    });

    const [first, second] = await Promise.all([
      getRoleBySlug("media-programming-directors"),
      getRoleBySlug("media-programming-directors")
    ]);
    const count = await prisma.role.count({
      where: {
        slug: "media-programming-directors"
      }
    });

    expect(first?.slug).toBe("media-programming-directors");
    expect(second?.slug).toBe("media-programming-directors");
    expect(count).toBe(1);
  });
});

describe("listHomepageReplacementRanking", () => {
  it("sorts by replacement rate and includes fallback-scored roles", async () => {
    await prisma.role.deleteMany({
      where: {
        slug: {
          startsWith: "test-homepage-ranking-"
        }
      }
    });

    await prisma.role.createMany({
      data: [
        {
          slug: "test-homepage-ranking-alpha",
          socCode: null,
          nameEn: "Test Homepage Ranking Alpha",
          nameZh: "测试首页排行甲",
          summaryEn: "Ranking fixture alpha.",
          summaryZh: "排行夹具甲。",
          riskLevel: "HIGH",
          replacementRate: 2997,
          riskSummaryEn: "Alpha fixture.",
          riskSummaryZh: "甲夹具。",
          riskReasons: [],
          riskModelProvider: "google",
          riskModelName: "gemini-2.5-flash",
          riskInferenceRaw: { fixture: "alpha" },
          ratingStatus: "RATED",
          lastRatedAt: new Date("2026-04-16T00:00:00.000Z"),
          repetitionScore: 4,
          ruleClarityScore: 4,
          transformationScore: 4,
          workflowAutomationScore: 4,
          interpersonalScore: 2,
          physicalityScore: 1,
          ambiguityScore: 2
        },
        {
          slug: "test-homepage-ranking-beta",
          socCode: null,
          nameEn: "Test Homepage Ranking Beta",
          nameZh: "测试首页排行乙",
          summaryEn: "Ranking fixture beta.",
          summaryZh: "排行夹具乙。",
          riskLevel: "SEVERE",
          replacementRate: 2999,
          riskSummaryEn: "Beta fixture.",
          riskSummaryZh: "乙夹具。",
          riskReasons: [],
          riskModelProvider: "fallback",
          riskModelName: "role-profile",
          riskInferenceRaw: { fixture: "beta" },
          ratingStatus: "RATED",
          lastRatedAt: new Date("2026-04-16T00:00:00.000Z"),
          repetitionScore: 4,
          ruleClarityScore: 4,
          transformationScore: 4,
          workflowAutomationScore: 4,
          interpersonalScore: 2,
          physicalityScore: 1,
          ambiguityScore: 2
        },
        {
          slug: "test-homepage-ranking-gamma",
          socCode: null,
          nameEn: "Test Homepage Ranking Gamma",
          nameZh: "测试首页排行丙",
          summaryEn: "Ranking fixture gamma.",
          summaryZh: "排行夹具丙。",
          riskLevel: "MEDIUM",
          replacementRate: 2998,
          riskSummaryEn: "Gamma fixture.",
          riskSummaryZh: "丙夹具。",
          riskReasons: [],
          riskModelProvider: "google",
          riskModelName: "gemini-2.5-flash",
          riskInferenceRaw: { fixture: "gamma" },
          ratingStatus: "RATED",
          lastRatedAt: new Date("2026-04-16T00:00:00.000Z"),
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

    const ranking = await listHomepageReplacementRanking(3);

    expect(ranking.map((role) => role.slug)).toEqual([
      "test-homepage-ranking-beta",
      "test-homepage-ranking-gamma",
      "test-homepage-ranking-alpha"
    ]);
    expect(ranking[0].replacementRate).toBe(2999);
    expect(ranking.some((role) => role.slug === "test-homepage-ranking-beta")).toBe(true);
  });
});

describe("listRelatedRoles", () => {
  it("returns same-industry related roles ordered by keyword overlap", async () => {
    await prisma.industryDictionary.create({
      data: {
        source: "test",
        code: "test-related-industry",
        nameEn: "Test Related Industry",
        nameZh: "测试相关行业",
        level: 1,
        sortOrder: 999
      }
    });

    await prisma.roleDictionary.createMany({
      data: [
        {
          source: "test",
          sourceCode: "test-related-role-primary",
          socCode: null,
          slug: "test-related-role-primary",
          nameEn: "Test Related Role Primary",
          nameZh: "测试主岗位",
          industryCode: "test-related-industry",
          keywords: ["invoice", "billing", "ledger", "support"],
          isActive: true
        },
        {
          source: "test",
          sourceCode: "test-related-role-billing",
          socCode: null,
          slug: "test-related-role-billing",
          nameEn: "Test Related Role Billing",
          nameZh: "测试账单岗位",
          industryCode: "test-related-industry",
          keywords: ["invoice", "billing", "collections"],
          isActive: true
        },
        {
          source: "test",
          sourceCode: "test-related-role-ledger",
          socCode: null,
          slug: "test-related-role-ledger",
          nameEn: "Test Related Role Ledger",
          nameZh: "测试总账岗位",
          industryCode: "test-related-industry",
          keywords: ["ledger", "accounts", "finance"],
          isActive: true
        },
        {
          source: "test",
          sourceCode: "test-related-role-field",
          socCode: null,
          slug: "test-related-role-field",
          nameEn: "Test Related Role Field",
          nameZh: "测试现场岗位",
          industryCode: "test-related-industry",
          keywords: ["field", "maintenance", "technician"],
          isActive: true
        }
      ]
    });

    const relatedDictionaryRole = await prisma.roleDictionary.findUniqueOrThrow({
      where: { slug: "test-related-role-billing" },
      select: { id: true }
    });

    await prisma.role.create({
      data: {
        dictionaryRoleId: relatedDictionaryRole.id,
        slug: "test-related-role-billing",
        socCode: null,
        nameEn: "Test Related Role Billing",
        nameZh: "测试账单岗位",
        summaryEn: "Stored related role fixture.",
        summaryZh: "已持久化的相关岗位夹具。",
        riskLevel: "HIGH",
        replacementRate: 77,
        riskSummaryEn: "Stored related role fixture.",
        riskSummaryZh: "已持久化的相关岗位夹具。",
        riskReasons: [],
        riskModelProvider: "fallback",
        riskModelName: "role-profile",
        riskInferenceRaw: { fixture: true },
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
    });

    const related = await listRelatedRoles("test-related-role-primary", 3);

    expect(related.map((role) => role.slug)).toEqual([
      "test-related-role-billing",
      "test-related-role-ledger",
      "test-related-role-field"
    ]);
    expect(related[0]).toMatchObject({
      slug: "test-related-role-billing",
      nameZh: "测试账单岗位",
      replacementRate: 77
    });
  });
});
