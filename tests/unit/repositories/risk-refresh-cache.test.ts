import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  buildRoleRiskInputHash,
  ROLE_RISK_PROMPT_VERSION
} from "@/lib/ai/cache-keys";
import {
  FALLBACK_RISK_CACHE_TTL_MS,
  loadRoleRiskEvidenceCandidates,
  prepareEvidenceForRiskScoring,
  refreshRoleRisk
} from "@/lib/repositories/risk-refresh";
import { persistDiscoveryScoringEvidence } from "@/lib/repositories/source-items";

const TEST_SOURCE_ID = "test-risk-refresh-cache";
const DISCOVERY_TEST_SOURCE_ID = `discovery-${TEST_SOURCE_ID}`;
const TEST_ROLE_SLUG = "test-risk-refresh-cache-role";

describe("risk refresh cache", () => {
  afterEach(async () => {
    await prisma.sourceItemInference.deleteMany({
      where: {
        sourceItem: {
          sourceCatalogId: {
            in: [TEST_SOURCE_ID, DISCOVERY_TEST_SOURCE_ID]
          }
        }
      }
    });

    await prisma.sourceItemRoleDecision.deleteMany({
      where: {
        sourceItem: {
          sourceCatalogId: {
            in: [TEST_SOURCE_ID, DISCOVERY_TEST_SOURCE_ID]
          }
        }
      }
    });

    await prisma.sourceItem.deleteMany({
      where: {
        sourceCatalogId: {
          in: [TEST_SOURCE_ID, DISCOVERY_TEST_SOURCE_ID]
        }
      }
    });

    await prisma.role.update({
      where: { slug: "customer-service-representative" },
      data: {
        riskModelProvider: null,
        riskModelName: null,
        riskInferenceRaw: Prisma.JsonNull,
        riskInputHash: null,
        riskPromptVersion: null,
        riskCachedAt: null
      }
    });

    await prisma.role.deleteMany({
      where: { slug: TEST_ROLE_SLUG }
    });

    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_ENABLED;
    delete process.env.MINIMAX_API_KEY;
    delete process.env.MINIMAX_MODEL;
    delete process.env.MINIMAX_ENABLED;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("skips Gemini when the role risk input hash is unchanged", async () => {
    const baseRole = await prisma.role.findUniqueOrThrow({
      where: { slug: "customer-service-representative" },
      include: { dictionaryRole: true }
    });
    const role = await prisma.role.create({
      data: {
        slug: TEST_ROLE_SLUG,
        socCode: null,
        nameEn: "Test Risk Refresh Cache Role",
        nameZh: "风险缓存测试岗位",
        summaryEn: baseRole.summaryEn,
        summaryZh: baseRole.summaryZh,
        riskLevel: baseRole.riskLevel,
        replacementRate: baseRole.replacementRate,
        riskSummaryEn: baseRole.riskSummaryEn,
        riskSummaryZh: baseRole.riskSummaryZh,
        riskReasons: baseRole.riskReasons,
        riskModelProvider: null,
        riskModelName: null,
        riskInferenceRaw: Prisma.JsonNull,
        ratingStatus: "RATED",
        lastRatedAt: baseRole.lastRatedAt,
        repetitionScore: baseRole.repetitionScore,
        ruleClarityScore: baseRole.ruleClarityScore,
        transformationScore: baseRole.transformationScore,
        workflowAutomationScore: baseRole.workflowAutomationScore,
        interpersonalScore: baseRole.interpersonalScore,
        physicalityScore: baseRole.physicalityScore,
        ambiguityScore: baseRole.ambiguityScore
      },
      include: { dictionaryRole: true }
    });

    const sourceItem = await prisma.sourceItem.create({
      data: {
        sourceCatalogId: TEST_SOURCE_ID,
        sourceLabel: "Risk Refresh Cache",
        sourceUrl: "https://example.com/risk-cache-hit",
        sourceType: "COMPANY_UPDATE",
        title: "Support workflow automation expands",
        summaryEn: "Official support workflow automation update.",
        summaryZh: null,
        publishedAt: new Date("2026-04-15T00:00:00.000Z"),
        mappingMode: "OBSERVE_ONLY"
      }
    });

    await prisma.sourceItemInference.create({
      data: {
        sourceItemId: sourceItem.id,
        roleId: role.id,
        assignedRoleSlug: TEST_ROLE_SLUG,
        modelProvider: "google",
        modelName: "gemini-2.5-flash",
        inferenceSummaryEn: "Direct support workflow automation signal.",
        inferenceSummaryZh: "直接的客服工作流自动化信号。",
        impactDirection: "INCREASE",
        relevance: "HIGH",
        signalWeight: 1,
        rawJson: {
          signalType: "workflow_restructure"
        }
      }
    });

    const sourceItemInferences = await loadRoleRiskEvidenceCandidates(TEST_ROLE_SLUG);
    const preparedEvidence = prepareEvidenceForRiskScoring(sourceItemInferences);

    const riskInputHash = buildRoleRiskInputHash({
      role: {
        slug: role.slug,
        nameEn: role.nameEn,
        nameZh: role.nameZh,
        summaryEn: role.summaryEn,
        summaryZh: role.summaryZh,
        keywords:
          role.dictionaryRole && Array.isArray(role.dictionaryRole.keywords)
            ? role.dictionaryRole.keywords.filter((value): value is string => typeof value === "string")
            : [],
        repetitionScore: role.repetitionScore,
        ruleClarityScore: role.ruleClarityScore,
        transformationScore: role.transformationScore,
        workflowAutomationScore: role.workflowAutomationScore,
        interpersonalScore: role.interpersonalScore,
        physicalityScore: role.physicalityScore,
        ambiguityScore: role.ambiguityScore
      },
      evidence: preparedEvidence,
      promptVersion: ROLE_RISK_PROMPT_VERSION,
      modelName: "gemini-2.5-flash"
    });

    await prisma.role.update({
      where: { id: role.id },
      data: {
        riskInputHash,
        riskPromptVersion: ROLE_RISK_PROMPT_VERSION,
        riskModelName: "gemini-2.5-flash",
        riskCachedAt: new Date("2026-04-15T00:00:00.000Z")
      }
    });

    const scoreFn = vi.fn();
    const refreshed = await refreshRoleRisk(TEST_ROLE_SLUG, scoreFn as never);

    expect(scoreFn).not.toHaveBeenCalled();
    expect(refreshed.slug).toBe(TEST_ROLE_SLUG);
  });

  it("persists the actual provider and model returned by risk scoring", async () => {
    const refreshed = await refreshRoleRisk(
      "customer-service-representative",
      vi.fn().mockResolvedValue({
        provider: "minimax",
        model: "MiniMax-Text-01",
        data: {
          replacementRate: 61,
          riskBand: "high",
          summaryEn: "Recent official workflow updates raise automation risk.",
          summaryZh: "近期官方工作流更新提高了自动化风险。",
          reasons: [
            {
              kind: "structure",
              titleEn: "Structured exposure",
              titleZh: "结构性暴露",
              detailEn: "The role remains language-heavy and repetitive.",
              detailZh: "该岗位仍然高度依赖语言处理且重复性较强。"
            }
          ]
        }
      }) as never
    );

    expect(refreshed.riskModelProvider).toBe("minimax");
    expect(refreshed.riskModelName).toBe("MiniMax-Text-01");
    expect(refreshed.riskInferenceRaw).toMatchObject({
      replacementRate: 61,
      riskBand: "high"
    });
  });

  it("refreshes risk from discovery-materialized inference evidence", async () => {
    await persistDiscoveryScoringEvidence({
      roleSlug: "customer-service-representative",
      sourceUrl: "https://example.com/discovery-risk-refresh-hit",
      title: "Discovery lane support automation shift",
      summaryEn: "Search-backed evidence suggests support workflows are being automated further.",
      publishedAt: "2026-04-19T00:00:00.000Z",
      sourceLabel: "Role Search",
      relevance: "high",
      signalWeight: 0.75,
      modelProvider: "discovery",
      modelName: "brave-materialized",
      rawJson: {
        evidenceKind: "role_search",
        scoreEligible: true
      }
    });

    const before = await prisma.role.findUniqueOrThrow({
      where: { slug: "customer-service-representative" },
      select: { riskInputHash: true, riskCachedAt: true }
    });

    const refreshed = await refreshRoleRisk(
      "customer-service-representative",
      vi.fn().mockResolvedValue({
        provider: "google",
        model: "gemini-2.5-flash",
        data: {
          replacementRate: 64,
          riskBand: "high",
          summaryEn: "Discovery-backed evidence raises the support automation signal.",
          summaryZh: "搜索补洞证据提高了客服自动化信号。",
          reasons: [
            {
              kind: "signal",
              titleEn: "Discovery evidence included",
              titleZh: "纳入搜索证据",
              detailEn: "Search-backed reporting now contributes to the score.",
              detailZh: "搜索补洞报道现在参与分数计算。"
            }
          ]
        }
      }) as never
    );

    expect(refreshed.replacementRate).toBe(64);
    expect(refreshed.riskCachedAt).not.toBeNull();
    expect(refreshed.riskInputHash).not.toBeNull();
    expect(refreshed.riskInputHash).not.toBe(before.riskInputHash);
    expect(refreshed.riskCachedAt?.getTime()).toBeGreaterThan(before.riskCachedAt?.getTime() ?? 0);
  });

  it("downweights discovery-lane evidence without excluding it at equal relevance", () => {
    const prepared = prepareEvidenceForRiskScoring([
      {
        sourceItem: {
          title: "Primary lane workflow update",
          sourceType: "NEWS",
          sourceCatalogId: "media-qbitai-ai",
          publishedAt: new Date("2026-04-12T00:00:00.000Z"),
          summaryEn: "Primary lane media report about a workflow shift."
        },
        inferenceSummaryEn: "Primary lane evidence.",
        impactDirection: "INCREASE",
        relevance: "HIGH",
        signalWeight: 1,
        rawJson: {
          signalType: "workflow_restructure"
        }
      },
      {
        sourceItem: {
          title: "Discovery lane workflow update",
          sourceType: "NEWS",
          sourceCatalogId: "discovery-qbitai",
          publishedAt: new Date("2026-04-12T00:00:00.000Z"),
          summaryEn: "Discovery lane media report about the same workflow shift."
        },
        inferenceSummaryEn: "Discovery lane evidence.",
        impactDirection: "INCREASE",
        relevance: "HIGH",
        signalWeight: 0.4,
        rawJson: {
          signalType: "workflow_restructure"
        }
      }
    ]);

    expect(prepared).toHaveLength(2);
    expect(prepared[0]?.title).toBe("Primary lane workflow update");
    expect(prepared[0]?.signalWeight).toBeGreaterThan(prepared[1]?.signalWeight);
    expect(prepared[1]?.signalWeight).toBeLessThan(0.65);
  });

  it("keeps older primary evidence in the scoring pool when recent discovery items are abundant", async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { slug: "customer-service-representative" },
      include: { dictionaryRole: true }
    });

    for (let index = 0; index < 26; index += 1) {
      const publishedAt = new Date("2026-04-16T00:00:00.000Z");
      publishedAt.setUTCDate(publishedAt.getUTCDate() - index);
      const sourceItem = await prisma.sourceItem.create({
        data: {
          sourceCatalogId: DISCOVERY_TEST_SOURCE_ID,
          sourceLabel: "Discovery burst",
          sourceUrl: `https://example.com/discovery-${index}`,
          sourceType: "NEWS",
          title: `Discovery burst item ${index + 1}`,
          summaryEn: "Discovery lane item crowding the recent window.",
          summaryZh: null,
          publishedAt,
          mappingMode: "OBSERVE_ONLY"
        }
      });

      await prisma.sourceItemInference.create({
        data: {
          sourceItem: {
            connect: { id: sourceItem.id }
          },
          role: {
            connect: { id: role.id }
          },
          assignedRoleSlug: role.slug,
          modelProvider: "google",
          modelName: "gemini-2.5-flash",
          inferenceSummaryEn: "Recent discovery-lane evidence.",
          inferenceSummaryZh: "近期 discovery-lane 证据。",
          impactDirection: "INCREASE",
          relevance: "HIGH",
          signalWeight: 0.45,
          rawJson: {
            signalType: "workflow_restructure"
          }
        }
      });
    }

    const primarySourceItem = await prisma.sourceItem.create({
      data: {
        sourceCatalogId: TEST_SOURCE_ID,
        sourceLabel: "Primary lane source",
        sourceUrl: "https://example.com/primary-lane",
        sourceType: "NEWS",
        title: "Primary lane workflow update",
        summaryEn: "Older but stronger primary lane evidence.",
        summaryZh: null,
        publishedAt: new Date("2026-04-07T00:00:00.000Z"),
        mappingMode: "OBSERVE_ONLY"
      }
    });

    await prisma.sourceItemInference.create({
      data: {
        sourceItem: {
          connect: { id: primarySourceItem.id }
        },
        role: {
          connect: { id: role.id }
        },
        assignedRoleSlug: role.slug,
        modelProvider: "google",
        modelName: "gemini-2.5-flash",
        inferenceSummaryEn: "Primary lane evidence should survive the larger window.",
        inferenceSummaryZh: "主要通道证据应保留在更大的候选池中。",
        impactDirection: "INCREASE",
        relevance: "HIGH",
        signalWeight: 1,
        rawJson: {
          signalType: "workflow_restructure"
        }
      }
    });

    const scoreFn = vi.fn().mockResolvedValue({
      provider: "gemini",
      model: "gemini-2.5-flash",
      data: {
        replacementRate: 63,
        riskBand: "high",
        summaryEn: "Primary lane evidence remains in scope.",
        summaryZh: null,
        reasons: []
      }
    });

    await refreshRoleRisk(role.slug, scoreFn as never);

    const preparedEvidence = scoreFn.mock.calls[0]?.[1] ?? [];
    expect(preparedEvidence).toHaveLength(8);
    const primaryEntry = preparedEvidence.find(
      (item: { title: string }) => item.title === "Primary lane workflow update"
    );
    const discoveryEntry = preparedEvidence.find((item: { title: string }) =>
      item.title.startsWith("Discovery burst item")
    );

    expect(primaryEntry).toBeDefined();
    expect(discoveryEntry).toBeDefined();
    expect(primaryEntry?.signalWeight).toBeGreaterThan(discoveryEntry?.signalWeight ?? 0);
  });

  it("skips rescoring when the unchanged cache was produced by minimax fallback", async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { slug: "customer-service-representative" },
      include: { dictionaryRole: true }
    });
    const sourceItemInferences = await loadRoleRiskEvidenceCandidates(role.slug);
    const preparedEvidence = prepareEvidenceForRiskScoring(sourceItemInferences);

    const riskInputHash = buildRoleRiskInputHash({
      role: {
        slug: role.slug,
        nameEn: role.nameEn,
        nameZh: role.nameZh,
        summaryEn: role.summaryEn,
        summaryZh: role.summaryZh,
        keywords:
          role.dictionaryRole && Array.isArray(role.dictionaryRole.keywords)
            ? role.dictionaryRole.keywords.filter((value): value is string => typeof value === "string")
            : [],
        repetitionScore: role.repetitionScore,
        ruleClarityScore: role.ruleClarityScore,
        transformationScore: role.transformationScore,
        workflowAutomationScore: role.workflowAutomationScore,
        interpersonalScore: role.interpersonalScore,
        physicalityScore: role.physicalityScore,
        ambiguityScore: role.ambiguityScore
      },
      evidence: preparedEvidence,
      promptVersion: ROLE_RISK_PROMPT_VERSION,
      modelName: "MiniMax-Text-01"
    });

    await prisma.role.update({
      where: { id: role.id },
      data: {
        riskModelProvider: "minimax",
        riskModelName: "MiniMax-Text-01",
        riskInputHash,
        riskPromptVersion: ROLE_RISK_PROMPT_VERSION,
        riskCachedAt: new Date(Date.now() - FALLBACK_RISK_CACHE_TTL_MS + 60_000),
        riskInferenceRaw: {
          replacementRate: 61,
          riskBand: "high"
        }
      }
    });

    const scoreFn = vi.fn();
    const refreshed = await refreshRoleRisk(role.slug, scoreFn as never);

    expect(scoreFn).not.toHaveBeenCalled();
    expect(refreshed.riskModelProvider).toBe("minimax");
    expect(refreshed.riskModelName).toBe("MiniMax-Text-01");
  });

  it("retries the preferred path after the fallback cache ttl expires", async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { slug: "customer-service-representative" },
      include: { dictionaryRole: true }
    });
    const sourceItemInferences = await prisma.sourceItemInference.findMany({
      where: {
        assignedRoleSlug: role.slug
      },
      include: {
        sourceItem: true
      },
      orderBy: {
        sourceItem: {
          publishedAt: "desc"
        }
      },
      take: 8
    });
    const preparedEvidence = prepareEvidenceForRiskScoring(sourceItemInferences);

    const fallbackRiskInputHash = buildRoleRiskInputHash({
      role: {
        slug: role.slug,
        nameEn: role.nameEn,
        nameZh: role.nameZh,
        summaryEn: role.summaryEn,
        summaryZh: role.summaryZh,
        keywords:
          role.dictionaryRole && Array.isArray(role.dictionaryRole.keywords)
            ? role.dictionaryRole.keywords.filter((value): value is string => typeof value === "string")
            : [],
        repetitionScore: role.repetitionScore,
        ruleClarityScore: role.ruleClarityScore,
        transformationScore: role.transformationScore,
        workflowAutomationScore: role.workflowAutomationScore,
        interpersonalScore: role.interpersonalScore,
        physicalityScore: role.physicalityScore,
        ambiguityScore: role.ambiguityScore
      },
      evidence: preparedEvidence,
      promptVersion: ROLE_RISK_PROMPT_VERSION,
      modelName: "MiniMax-Text-01"
    });

    await prisma.role.update({
      where: { id: role.id },
      data: {
        riskModelProvider: "minimax",
        riskModelName: "MiniMax-Text-01",
        riskInputHash: fallbackRiskInputHash,
        riskPromptVersion: ROLE_RISK_PROMPT_VERSION,
        riskCachedAt: new Date(Date.now() - FALLBACK_RISK_CACHE_TTL_MS - 60_000),
        riskInferenceRaw: {
          replacementRate: 61,
          riskBand: "high"
        }
      }
    });

    const scoreFn = vi.fn().mockResolvedValue({
      provider: "gemini",
      model: "gemini-2.5-flash",
      data: {
        replacementRate: 64,
        riskBand: "high",
        summaryEn: "Gemini recovered and rescored the role.",
        summaryZh: "Gemini 已恢复并重新评分。",
        reasons: [
          {
            kind: "official",
            titleEn: "Recovered preferred path",
            titleZh: "首选路径恢复",
            detailEn: "Gemini is available again, so the role was rescored on the preferred path.",
            detailZh: "Gemini 已恢复可用，因此岗位重新走了首选评分路径。"
          }
        ]
      }
    });

    const refreshed = await refreshRoleRisk(role.slug, scoreFn as never);

    expect(scoreFn).toHaveBeenCalledOnce();
    expect(refreshed.riskModelProvider).toBe("gemini");
    expect(refreshed.riskModelName).toBe("gemini-2.5-flash");
  });

  it("uses minimax as the preferred cache model when gemini is unavailable", async () => {
    process.env.GEMINI_ENABLED = "0";
    process.env.MINIMAX_API_KEY = "minimax-key";
    process.env.MINIMAX_MODEL = "MiniMax-Text-01";

    const role = await prisma.role.findUniqueOrThrow({
      where: { slug: "customer-service-representative" },
      include: { dictionaryRole: true }
    });
    const sourceItemInferences = await prisma.sourceItemInference.findMany({
      where: {
        assignedRoleSlug: role.slug
      },
      include: {
        sourceItem: true
      },
      orderBy: {
        sourceItem: {
          publishedAt: "desc"
        }
      },
      take: 8
    });
    const preparedEvidence = prepareEvidenceForRiskScoring(sourceItemInferences);

    const minimaxRiskInputHash = buildRoleRiskInputHash({
      role: {
        slug: role.slug,
        nameEn: role.nameEn,
        nameZh: role.nameZh,
        summaryEn: role.summaryEn,
        summaryZh: role.summaryZh,
        keywords:
          role.dictionaryRole && Array.isArray(role.dictionaryRole.keywords)
            ? role.dictionaryRole.keywords.filter((value): value is string => typeof value === "string")
            : [],
        repetitionScore: role.repetitionScore,
        ruleClarityScore: role.ruleClarityScore,
        transformationScore: role.transformationScore,
        workflowAutomationScore: role.workflowAutomationScore,
        interpersonalScore: role.interpersonalScore,
        physicalityScore: role.physicalityScore,
        ambiguityScore: role.ambiguityScore
      },
      evidence: preparedEvidence,
      promptVersion: ROLE_RISK_PROMPT_VERSION,
      modelName: "MiniMax-Text-01"
    });

    await prisma.role.update({
      where: { id: role.id },
      data: {
        riskModelProvider: "minimax",
        riskModelName: "MiniMax-Text-01",
        riskInputHash: minimaxRiskInputHash,
        riskPromptVersion: ROLE_RISK_PROMPT_VERSION,
        riskCachedAt: new Date(Date.now() - FALLBACK_RISK_CACHE_TTL_MS - 60_000),
        riskInferenceRaw: {
          replacementRate: 61,
          riskBand: "high"
        }
      }
    });

    const scoreFn = vi.fn();
    const refreshed = await refreshRoleRisk(role.slug, scoreFn as never);

    expect(scoreFn).not.toHaveBeenCalled();
    expect(refreshed.riskModelProvider).toBe("minimax");
    expect(refreshed.riskModelName).toBe("MiniMax-Text-01");
  });
});
