import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getRoleDetail } from "@/lib/application/roles/get-role-detail";
import { upsertRoleEvidenceCandidate } from "@/lib/repositories/role-discovery";

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.roleRiskSnapshot.deleteMany({
    where: {
      source: "test_role_detail_trend"
    }
  });

  await prisma.roleEvidenceCandidate.deleteMany({
    where: {
      sourceUrl: {
        startsWith: "https://test-role-discovery.local/detail-"
      }
    }
  });

  await prisma.role.deleteMany({
    where: {
      slug: {
        startsWith: "test-role-detail-related-"
      }
    }
  });

  await prisma.roleDictionary.deleteMany({
    where: {
      slug: {
        startsWith: "test-role-detail-related-"
      }
    }
  });

  await prisma.industryDictionary.deleteMany({
    where: {
      code: "test-role-detail-related-industry"
    }
  });
});

describe("getRoleDetail", () => {
  it("returns the role detail read model for a known role slug", async () => {
    const role = await getRoleDetail("actors");

    expect(role).not.toBeNull();
    expect(role?.slug).toBe("actors");
    expect(Array.isArray(role?.timelineItems)).toBe(true);
  });

  it("merges timeline-eligible role discovery evidence into the read model", async () => {
    const sourceUrl = `https://test-role-discovery.local/detail-${Date.now()}`;

    await upsertRoleEvidenceCandidate({
      roleSlug: "actors",
      sourceUrl,
      title: "Studios use AI doubles in actor workflows",
      snippet: "AI doubles are compressing some actor-facing production tasks.",
      sourceLabel: "Role Search",
      evidenceKind: "role_search",
      timelineEligible: true,
      scoreEligible: false,
      rawJson: {
        publishedAt: "2026-04-19T00:00:00.000Z"
      }
    });

    const role = await getRoleDetail("actors");

    expect(role?.timelineItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceUrl,
          sourceLabel: "Role Search",
          sourceType: "ROLE_SEARCH"
        })
      ])
    );
  });

  it("replaces no-source fallback copy once timeline items exist", async () => {
    const sourceUrl = `https://test-role-discovery.local/detail-summary-${Date.now()}`;

    await upsertRoleEvidenceCandidate({
      roleSlug: "actors",
      sourceUrl,
      title: "Studios use AI doubles in actor workflows",
      snippet: "AI doubles are compressing some actor-facing production tasks.",
      sourceLabel: "Role Search",
      evidenceKind: "role_search",
      timelineEligible: true,
      scoreEligible: false,
      rawJson: {
        publishedAt: "2026-04-19T00:00:00.000Z"
      }
    });

    const role = await getRoleDetail("actors");

    expect(role?.summaryEn).toContain("timeline item");
    expect(role?.summaryEn).not.toContain("No role-specific source items are attached yet");
    expect(role?.summaryZh).toContain("时间线资讯");
    expect(role?.summaryZh).not.toContain("暂时还没有挂接到足够的专属资讯");
  });

  it("returns seo metadata fields derived from merged timeline coverage", async () => {
    const sourceUrl = `https://test-role-discovery.local/detail-seo-${Date.now()}`;

    await upsertRoleEvidenceCandidate({
      roleSlug: "actors",
      sourceUrl,
      title: "Studios use AI doubles in actor workflows",
      snippet: "AI doubles are compressing some actor-facing production tasks.",
      sourceLabel: "Role Search",
      evidenceKind: "role_search",
      timelineEligible: true,
      scoreEligible: false,
      rawJson: {
        publishedAt: "2026-04-20T00:00:00.000Z"
      }
    });

    const role = await getRoleDetail("actors");

    expect(role?.seo.timelineCount).toBeGreaterThan(0);
    expect(role?.seo.latestPublishedAt).toBeInstanceOf(Date);
  });

  it("includes related roles for the detail page", async () => {
    await prisma.industryDictionary.create({
      data: {
        source: "test",
        code: "test-role-detail-related-industry",
        nameEn: "Test Role Detail Related Industry",
        nameZh: "测试详情相关行业",
        level: 1,
        sortOrder: 999
      }
    });

    await prisma.roleDictionary.createMany({
      data: [
        {
          source: "test",
          sourceCode: "test-role-detail-related-primary",
          socCode: null,
          slug: "test-role-detail-related-primary",
          nameEn: "Test Role Detail Related Primary",
          nameZh: "测试详情主岗位",
          industryCode: "test-role-detail-related-industry",
          keywords: ["invoice", "billing", "support"],
          isActive: true
        },
        {
          source: "test",
          sourceCode: "test-role-detail-related-peer",
          socCode: null,
          slug: "test-role-detail-related-peer",
          nameEn: "Test Role Detail Related Peer",
          nameZh: "测试详情相关岗位",
          industryCode: "test-role-detail-related-industry",
          keywords: ["invoice", "billing", "collections"],
          isActive: true
        }
      ]
    });

    const primaryDictionaryRole = await prisma.roleDictionary.findUniqueOrThrow({
      where: { slug: "test-role-detail-related-primary" },
      select: { id: true }
    });

    await prisma.role.create({
      data: {
        dictionaryRoleId: primaryDictionaryRole.id,
        slug: "test-role-detail-related-primary",
        socCode: null,
        nameEn: "Test Role Detail Related Primary",
        nameZh: "测试详情主岗位",
        summaryEn: "Primary role fixture.",
        summaryZh: "主岗位夹具。",
        riskLevel: "MEDIUM",
        replacementRate: 64,
        riskSummaryEn: "Primary role fixture.",
        riskSummaryZh: "主岗位夹具。",
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

    const role = await getRoleDetail("test-role-detail-related-primary");

    expect(role?.relatedRoles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "test-role-detail-related-peer",
          nameZh: "测试详情相关岗位"
        })
      ])
    );
  });

  it("returns week and month trend data for the role detail page", async () => {
    const roleRecord = await prisma.role.findUniqueOrThrow({
      where: { slug: "customer-service-representative" },
      select: { id: true }
    });

    await prisma.roleRiskSnapshot.createMany({
      data: [
        {
          roleId: roleRecord.id,
          snapshotAt: new Date("2030-04-01T00:30:00+08:00"),
          replacementRate: 60,
          riskLevel: "HIGH",
          ratingStatus: "RATED",
          wasRecomputed: true,
          source: "test_role_detail_trend"
        },
        {
          roleId: roleRecord.id,
          snapshotAt: new Date("2030-04-08T00:00:00+08:00"),
          replacementRate: 64,
          riskLevel: "HIGH",
          ratingStatus: "RATED",
          wasRecomputed: true,
          source: "test_role_detail_trend"
        },
        {
          roleId: roleRecord.id,
          snapshotAt: new Date("2030-05-01T00:00:00+08:00"),
          replacementRate: 68,
          riskLevel: "HIGH",
          ratingStatus: "RATED",
          wasRecomputed: true,
          source: "test_role_detail_trend"
        }
      ]
    });

    const role = await getRoleDetail("customer-service-representative");

    expect(role?.trend).toBeDefined();
    expect(role?.trend.week.slice(-3)).toEqual([
      { bucketLabel: "2030-04-01", averageReplacementRate: 60, pointCount: 1 },
      { bucketLabel: "2030-04-08", averageReplacementRate: 64, pointCount: 1 },
      { bucketLabel: "2030-04-29", averageReplacementRate: 68, pointCount: 1 }
    ]);
    expect(role?.trend.month.slice(-2)).toEqual([
      { bucketLabel: "2030-04", averageReplacementRate: 62, pointCount: 2 },
      { bucketLabel: "2030-05", averageReplacementRate: 68, pointCount: 1 }
    ]);
  });
});
