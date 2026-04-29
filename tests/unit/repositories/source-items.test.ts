import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  persistDiscoveryScoringEvidence,
  findStoredSourceItemByCatalogUrl,
  listApprovedSourceItemsForRole,
  listRecentApprovedSourceItems,
  listPendingReviewDecisions,
  persistSourceItemDecision,
  persistSourceItemInference,
  persistSourceItemSignalIfEligible
} from "@/lib/repositories/source-items";
import { approveReviewDecision } from "@/lib/repositories/review-decisions";

describe("source item repositories", () => {
  afterEach(async () => {
    await prisma.sourceItemInference.deleteMany({
      where: {
        sourceItem: {
          sourceCatalogId: {
            in: [
              "discovery-role-search:customer-service-representative",
              "discovery-role-search:bookkeeping-clerk",
              "discovery-role-search:computer-systems-analysts",
              "test-media-fintech-ops",
              "test-observe-only-regression",
              "test-gemini-classification",
              "test-public-timeline-inference",
              "test-signal-policy-gated",
              "test-weight-normalization"
            ]
          }
        }
      }
    });

    await prisma.sourceItemRoleDecision.deleteMany({
      where: {
        sourceItem: {
          sourceCatalogId: {
            in: [
              "test-media-fintech-ops",
              "test-observe-only-regression",
              "test-gemini-classification",
              "test-public-timeline-inference",
              "test-signal-policy-gated",
              "test-weight-normalization"
            ]
          }
        }
      }
    });

    await prisma.sourceItem.deleteMany({
      where: {
        sourceCatalogId: {
          in: [
            "discovery-role-search:customer-service-representative",
            "discovery-role-search:bookkeeping-clerk",
            "discovery-role-search:computer-systems-analysts",
            "test-media-fintech-ops",
            "test-observe-only-regression",
            "test-gemini-classification",
            "test-public-timeline-inference",
            "test-signal-policy-gated",
            "test-weight-normalization"
          ]
        }
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reads only approved raw source items for a role timeline", async () => {
    const timeline = await listApprovedSourceItemsForRole("customer-service-representative");

    expect(timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Support operations automation specialist",
          roleSlug: "customer-service-representative",
          reviewStatus: "PENDING",
          sourceLabel: "OpenAI Careers",
          sourceHost: "openai.com"
        })
      ])
    );
    expect(
      timeline.some((item) => item.title === "Bookkeeping AI rollout needs manual review")
    ).toBe(false);
  });

  it("returns pending review decisions with source item context", async () => {
    await persistSourceItemDecision(
      {
        sourceCatalogId: "test-media-fintech-ops",
        sourceLabel: "Fintech Ops Review",
        sourceUrl: "https://example.com/bookkeeping-ai-rollout-review-test",
        sourceType: "NEWS",
        title: "Bookkeeping AI rollout needs manual review",
        summaryEn: "Finance teams test AI copilots for reconciliation and invoice handling.",
        summaryZh: "财务团队正在测试用于对账和发票处理的 AI 助手。",
        publishedAt: new Date("2026-04-08T00:00:00.000Z"),
        mappingMode: "observe_only"
      },
      {
        status: "accepted",
        primaryRoleSlug: "bookkeeping-clerk",
        reason: "Unique high-confidence candidate",
        confidence: "high",
        candidateSlugs: ["bookkeeping-clerk"],
        matchedKeywords: ["reconciliation", "invoice"]
      }
    );

    const queue = await listPendingReviewDecisions();

    expect(queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceTitle: "Bookkeeping AI rollout needs manual review",
          sourceCatalogId: "test-media-fintech-ops",
          reviewStatus: "PENDING",
          candidateSlugs: expect.arrayContaining(["bookkeeping-clerk"])
        })
      ])
    );
  });

  it("preserves approved review status when the same source item is ingested again", async () => {
    const sourceUrl = "https://example.com/observe-only-review-preserved";

    const created = await persistSourceItemDecision(
      {
        sourceCatalogId: "test-observe-only-regression",
        sourceLabel: "Observe Only Regression",
        sourceUrl,
        sourceType: "NEWS",
        title: "Support team pilots AI ticket deflection",
        summaryEn: "Help desk teams test automated triage for common service tickets.",
        summaryZh: null,
        publishedAt: new Date("2026-04-10T00:00:00.000Z"),
        mappingMode: "observe_only"
      },
      {
        status: "accepted",
        primaryRoleSlug: "customer-service-representative",
        reason: "Unique high-confidence candidate",
        confidence: "high",
        candidateSlugs: ["customer-service-representative"],
        matchedKeywords: ["help desk", "triage", "ticket"]
      }
    );

    await approveReviewDecision(created.decision.id);

    await persistSourceItemDecision(
      {
        sourceCatalogId: "test-observe-only-regression",
        sourceLabel: "Observe Only Regression",
        sourceUrl,
        sourceType: "NEWS",
        title: "Support team pilots AI ticket deflection",
        summaryEn: "Help desk teams test automated triage for common service tickets.",
        summaryZh: null,
        publishedAt: new Date("2026-04-10T00:00:00.000Z"),
        mappingMode: "observe_only"
      },
      {
        status: "accepted",
        primaryRoleSlug: "customer-service-representative",
        reason: "Unique high-confidence candidate",
        confidence: "high",
        candidateSlugs: ["customer-service-representative"],
        matchedKeywords: ["help desk", "triage", "ticket"]
      }
    );

    const updated = await prisma.sourceItemRoleDecision.findUniqueOrThrow({
      where: { id: created.decision.id }
    });

    expect(updated.reviewStatus).toBe("APPROVED");
    expect(updated.reviewedAt).not.toBeNull();
  });

  it("queues observe-only items for review without creating role-facing signals", async () => {
    const signalCountBefore = await prisma.signal.count();

    await persistSourceItemDecision(
      {
        sourceCatalogId: "test-observe-only-regression",
        sourceLabel: "Observe Only Regression",
        sourceUrl: "https://example.com/observe-only-regression",
        sourceType: "NEWS",
        title: "Support team pilots AI ticket deflection",
        summaryEn: "Help desk teams test automated triage for common service tickets.",
        summaryZh: null,
        publishedAt: new Date("2026-04-10T00:00:00.000Z"),
        mappingMode: "observe_only"
      },
      {
        status: "accepted",
        primaryRoleSlug: "customer-service-representative",
        reason: "Unique high-confidence candidate",
        confidence: "high",
        candidateSlugs: ["customer-service-representative"],
        matchedKeywords: ["help desk", "triage", "ticket"]
      }
    );

    const queue = await listPendingReviewDecisions();
    const signalCountAfter = await prisma.signal.count();

    expect(
      queue.find((item) => item.sourceCatalogId === "test-observe-only-regression")
    ).toMatchObject({
      sourceTitle: "Support team pilots AI ticket deflection",
      reviewStatus: "PENDING",
      sourceLabel: "Observe Only Regression",
      sourceHost: "example.com"
    });
    expect(signalCountAfter).toBe(signalCountBefore);
  });

  it("lists recent approved source items for the homepage feed", async () => {
    await persistSourceItemDecision(
      {
        sourceCatalogId: "test-public-timeline-inference",
        sourceLabel: "Homepage Feed Test",
        sourceUrl: "https://news.role-radar.local/homepage-feed-test",
        sourceType: "COMPANY_UPDATE",
        title: "Homepage feed picks up support workflow automation",
        summaryEn: "A fresh support automation rollout should surface in the homepage feed.",
        summaryZh: null,
        publishedAt: new Date("2099-04-15T23:59:59.000Z"),
        mappingMode: "observe_only"
      },
      {
        status: "accepted",
        primaryRoleSlug: "customer-service-representative",
        reason: "Fresh high-confidence source for the homepage feed.",
        confidence: "high",
        candidateSlugs: ["customer-service-representative"],
        matchedKeywords: ["support", "automation"],
        inference: {
          modelProvider: "google",
          modelName: "gemini-2.5-flash",
          assignedRoleSlug: "customer-service-representative",
          inferenceSummaryEn: "This rollout belongs on the customer support feed.",
          inferenceSummaryZh: null,
          impactDirection: "increase",
          relevance: "high",
          signalWeight: 0.9,
          rawJson: {
            roleSlug: "customer-service-representative",
            impactDirection: "increase"
          }
        }
      }
    );

    const items = await listRecentApprovedSourceItems();

    expect(
      items.some(
        (item) =>
          item.roleSlug === "customer-service-representative" &&
          item.sourceTitle === "Homepage feed picks up support workflow automation"
      )
    ).toBe(true);
  });

  it("persists gemini inference metadata on a source item decision", async () => {
    const created = await persistSourceItemDecision(
      {
        sourceCatalogId: "test-gemini-classification",
        sourceLabel: "Gemini Classification",
        sourceUrl: "https://example.com/customer-support-gemini",
        sourceType: "COMPANY_UPDATE",
        title: "Gemini maps a support automation launch",
        summaryEn: "A model inferred that the update affects customer support automation.",
        summaryZh: null,
        publishedAt: new Date("2026-04-11T00:00:00.000Z"),
        mappingMode: "observe_only",
        classificationInputHash: "hash-1",
        classificationPromptVersion: "prompt-v1",
        classificationModelName: "gemini-2.5-flash"
      },
      {
        status: "accepted",
        primaryRoleSlug: "customer-service-representative",
        reason: "Gemini inferred a direct customer support workflow impact.",
        confidence: "high",
        candidateSlugs: ["customer-service-representative"],
        matchedKeywords: ["support", "triage"],
        inference: {
          modelProvider: "google",
          modelName: "gemini-2.5-flash",
          assignedRoleSlug: "customer-service-representative",
          inferenceSummaryEn: "The article describes AI-first customer support triage.",
          inferenceSummaryZh: null,
          impactDirection: "increase",
          relevance: "high",
          signalWeight: 0.9,
          rawJson: {
            roleSlug: "customer-service-representative",
            impactDirection: "increase"
          }
        }
      }
    );

    expect(created.inference).toMatchObject({
      assignedRoleSlug: "customer-service-representative",
      modelProvider: "google",
      modelName: "gemini-2.5-flash",
      inferenceSummaryEn: "The article describes AI-first customer support triage.",
      inferenceSummaryZh: "The article describes AI-first customer support triage.",
      impactDirection: "INCREASE",
      relevance: "HIGH"
    });
    expect(created.sourceItem).toMatchObject({
      classificationInputHash: "hash-1",
      classificationPromptVersion: "prompt-v1",
      classificationModelName: "gemini-2.5-flash"
    });
  });

  it("upserts discovery scoring evidence idempotently for a role/url pair", async () => {
    const sourceUrl = "https://test-role-discovery.local/support-ai-score";

    const first = await persistDiscoveryScoringEvidence({
      roleSlug: "customer-service-representative",
      sourceUrl,
      title: "AI shifts customer support workflows",
      summaryEn: "Enterprises are routing repetitive support work through AI systems.",
      publishedAt: "2026-04-19T00:00:00.000Z",
      sourceLabel: "Role Search",
      relevance: "medium",
      signalWeight: 0.42,
      modelProvider: "brave",
      modelName: "role-discovery",
      rawJson: {
        evidenceKind: "role_search",
        provider: "brave",
        discoveryScore: 42
      }
    });

    const second = await persistDiscoveryScoringEvidence({
      roleSlug: "customer-service-representative",
      sourceUrl,
      title: "AI shifts customer support workflows, rerun",
      summaryEn: "The rerun should update the same discovery-backed rows.",
      publishedAt: "2026-04-20T00:00:00.000Z",
      sourceLabel: "Role Search",
      relevance: "high",
      signalWeight: 0.88,
      modelProvider: "google",
      modelName: "gemini-2.5-flash",
      rawJson: {
        evidenceKind: "role_search",
        provider: "google",
        discoveryScore: 88
      }
    });

    const stored = await findStoredSourceItemByCatalogUrl(
      "discovery-role-search:customer-service-representative",
      sourceUrl
    );

    expect(stored).toMatchObject({
      title: "AI shifts customer support workflows, rerun",
      summaryEn: "The rerun should update the same discovery-backed rows.",
      publishedAt: new Date("2026-04-20T00:00:00.000Z"),
      sourceLabel: "Role Search",
      sourceType: "NEWS",
      mappingMode: "DIRECT_MAPPED",
      decisions: expect.arrayContaining([
        expect.objectContaining({
          decisionStatus: "ACCEPTED",
          reviewStatus: "APPROVED"
        })
      ]),
      inference: expect.objectContaining({
        assignedRoleSlug: "customer-service-representative",
        modelProvider: "google",
        modelName: "gemini-2.5-flash",
        inferenceSummaryEn: "The rerun should update the same discovery-backed rows.",
        relevance: "HIGH",
        signalWeight: 0.88
      })
    });

    expect(
      await prisma.sourceItem.count({
        where: {
          sourceCatalogId: "discovery-role-search:customer-service-representative",
          sourceUrl
        }
      })
    ).toBe(1);
    expect(
      await prisma.sourceItemRoleDecision.count({
        where: {
          sourceItem: {
            sourceCatalogId: "discovery-role-search:customer-service-representative",
            sourceUrl
          }
        }
      })
    ).toBe(1);
    expect(
      await prisma.sourceItemInference.count({
        where: {
          sourceItem: {
            sourceCatalogId: "discovery-role-search:customer-service-representative",
            sourceUrl
          }
        }
      })
    ).toBe(1);

    expect(first.sourceItem.id).toBe(second.sourceItem.id);
    expect(first.decision.id).toBe(second.decision.id);
    expect(first.inference.id).toBe(second.inference.id);
  });

  it("finds stored source items with reusable classification artifacts", async () => {
    await persistSourceItemDecision(
      {
        sourceCatalogId: "test-gemini-classification",
        sourceLabel: "Gemini Classification",
        sourceUrl: "https://example.com/customer-support-gemini-cache",
        sourceType: "COMPANY_UPDATE",
        title: "Gemini maps a support automation launch",
        summaryEn: "A model inferred that the update affects customer support automation.",
        summaryZh: null,
        publishedAt: new Date("2026-04-11T00:00:00.000Z"),
        mappingMode: "observe_only",
        classificationInputHash: "hash-cache",
        classificationPromptVersion: "prompt-v1",
        classificationModelName: "gemini-2.5-flash"
      },
      {
        status: "accepted",
        primaryRoleSlug: "customer-service-representative",
        reason: "Gemini inferred a direct customer support workflow impact.",
        confidence: "high",
        candidateSlugs: ["customer-service-representative"],
        matchedKeywords: ["support", "triage"],
        inference: {
          modelProvider: "google",
          modelName: "gemini-2.5-flash",
          assignedRoleSlug: "customer-service-representative",
          inferenceSummaryEn: "The article describes AI-first customer support triage.",
          inferenceSummaryZh: null,
          impactDirection: "increase",
          relevance: "high",
          signalWeight: 0.9,
          rawJson: {
            roleSlug: "customer-service-representative",
            impactDirection: "increase"
          }
        }
      }
    );

    const stored = await findStoredSourceItemByCatalogUrl(
      "test-gemini-classification",
      "https://example.com/customer-support-gemini-cache"
    );

    expect(stored).toMatchObject({
      classificationInputHash: "hash-cache",
      classificationPromptVersion: "prompt-v1",
      classificationModelName: "gemini-2.5-flash",
      inference: expect.objectContaining({
        assignedRoleSlug: "customer-service-representative"
      }),
      decisions: expect.arrayContaining([
        expect.objectContaining({
          decisionStatus: "ACCEPTED"
        })
      ])
    });
  });

  it("bounds inference signal weight before storing it", async () => {
    const persisted = await persistSourceItemDecision(
      {
        sourceCatalogId: "test-weight-normalization",
        sourceLabel: "Weight Normalization",
        sourceUrl: "https://example.com/weight-normalization",
        sourceType: "COMPANY_UPDATE",
        title: "Support workflow moves to AI-first triage",
        summaryEn: "AI triage is absorbing first-line support work.",
        summaryZh: null,
        publishedAt: new Date("2026-04-13T00:00:00.000Z"),
        mappingMode: "observe_only"
      },
      {
        status: "accepted",
        primaryRoleSlug: "customer-service-representative",
        reason: "Unique high-confidence candidate",
        confidence: "high",
        candidateSlugs: ["customer-service-representative"],
        matchedKeywords: ["support", "triage"]
      }
    );

    const inference = await persistSourceItemInference({
      sourceItemId: persisted.sourceItem.id,
      assignedRoleSlug: "customer-service-representative",
      modelProvider: "google",
      modelName: "gemini-2.5-flash",
      inferenceSummaryEn: "The item directly affects customer support triage workflows.",
      inferenceSummaryZh: null,
      impactDirection: "increase",
      relevance: "high",
      signalWeight: 1.8,
      rawJson: {
        roleSlug: "customer-service-representative",
        impactDirection: "increase"
      }
    });

    expect(inference.signalWeight).toBe(1);
  });

  it("skips signal persistence for weak or unmatched items", async () => {
    const signalCountBefore = await prisma.signal.count();
    const role = await prisma.role.findUniqueOrThrow({
      where: { slug: "customer-service-representative" },
      select: { id: true }
    });

    const result = await persistSourceItemSignalIfEligible({
      shouldPersistSignal: false,
      roleId: role.id,
      sourceUrl: "https://example.com/weak-ecosystem-context",
      sourceTitle: "General AI ecosystem commentary",
      sourceType: "NEWS",
      signalType: "TOOLING",
      strength: "LOW",
      publishedAt: new Date("2026-04-13T00:00:00.000Z"),
      summaryEn: "Broad commentary without a specific occupational workflow impact.",
      summaryZh: "没有具体岗位工作流影响的泛化评论。",
      rationaleEn: "Weak ecosystem context should not produce a signal row.",
      rationaleZh: "弱生态上下文不应生成信号行。"
    });

    expect(result).toBeNull();
    expect(await prisma.signal.count()).toBe(signalCountBefore);
  });

  it("reads accepted classified items into the public timeline without waiting for manual approval", async () => {
    await persistSourceItemDecision(
      {
        sourceCatalogId: "test-public-timeline-inference",
        sourceLabel: "Public Timeline Inference",
        sourceUrl: "https://news.role-radar.local/public-timeline-inference",
        sourceType: "NEWS",
        title: "Media report says support teams shift to AI triage",
        summaryEn: "A report links support automation to large-scale triage changes.",
        summaryZh: null,
        publishedAt: new Date("2026-04-12T00:00:00.000Z"),
        mappingMode: "observe_only"
      },
      {
        status: "accepted",
        primaryRoleSlug: "customer-service-representative",
        reason: "Gemini inferred direct customer support replacement pressure.",
        confidence: "high",
        candidateSlugs: ["customer-service-representative"],
        matchedKeywords: ["support", "triage"],
        inference: {
          modelProvider: "google",
          modelName: "gemini-2.5-flash",
          assignedRoleSlug: "customer-service-representative",
          inferenceSummaryEn: "The report directly affects customer-service workflow exposure.",
          inferenceSummaryZh: null,
          impactDirection: "increase",
          relevance: "high",
          signalWeight: 0.7,
          rawJson: {
            roleSlug: "customer-service-representative",
            impactDirection: "increase"
          }
        }
      }
    );

    const timeline = await listApprovedSourceItemsForRole("customer-service-representative");

    expect(timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Media report says support teams shift to AI triage",
          sourceCatalogId: "test-public-timeline-inference",
          roleSlug: "customer-service-representative",
          reviewStatus: "PENDING"
        })
      ])
    );
  });

  it("persists gemini classification artifacts on source items", async () => {
    const persisted = await persistSourceItemDecision(
      {
        sourceCatalogId: "test-gemini-classification",
        sourceLabel: "Inference Test",
        sourceUrl: "https://example.com/gemini-inference",
        sourceType: "NEWS",
        title: "AI copilots expand into support queues",
        summaryEn: "Support teams are routing more tickets through AI agents.",
        summaryZh: null,
        publishedAt: new Date("2026-04-11T00:00:00.000Z"),
        mappingMode: "observe_only"
      },
      {
        status: "accepted",
        primaryRoleSlug: "customer-service-representative",
        reason: "Unique high-confidence candidate",
        confidence: "high",
        candidateSlugs: ["customer-service-representative"],
        matchedKeywords: ["support", "ticket"]
      }
    );

    const inference = await persistSourceItemInference({
      sourceItemId: persisted.sourceItem.id,
      assignedRoleSlug: "customer-service-representative",
      modelProvider: "gemini",
      modelName: "gemini-2.5-flash",
      inferenceSummaryEn: "The article maps directly to customer support workflow substitution.",
      inferenceSummaryZh: null,
      impactDirection: "increase",
      relevance: "high",
      signalWeight: 0.75,
      rawJson: {
        roleSlug: "customer-service-representative",
        impactDirection: "increase"
      }
    });

    expect(inference).toMatchObject({
      assignedRoleSlug: "customer-service-representative",
      modelProvider: "gemini",
      modelName: "gemini-2.5-flash",
      inferenceSummaryZh: "The article maps directly to customer support workflow substitution.",
      impactDirection: "INCREASE",
      relevance: "HIGH"
    });
  });

  it("reads classified items for a role timeline even when review status is still pending", async () => {
    const persisted = await persistSourceItemDecision(
      {
        sourceCatalogId: "test-public-timeline-inference",
        sourceLabel: "Inference Test",
        sourceUrl: "https://news.role-radar.local/gemini-pending-public",
        sourceType: "NEWS",
        title: "Support queues adopt AI assistants",
        summaryEn: "Service teams push more customer tickets through AI-first routing.",
        summaryZh: null,
        publishedAt: new Date("2026-04-12T00:00:00.000Z"),
        mappingMode: "observe_only"
      },
      {
        status: "accepted",
        primaryRoleSlug: "customer-service-representative",
        reason: "Unique high-confidence candidate",
        confidence: "high",
        candidateSlugs: ["customer-service-representative"],
        matchedKeywords: ["support", "routing"]
      }
    );

    await persistSourceItemInference({
      sourceItemId: persisted.sourceItem.id,
      assignedRoleSlug: "customer-service-representative",
      modelProvider: "gemini",
      modelName: "gemini-2.5-flash",
      inferenceSummaryEn: "The item belongs on the customer support role timeline.",
      inferenceSummaryZh: "这条内容应进入客户服务岗位时间线。",
      impactDirection: "increase",
      relevance: "high",
      signalWeight: 0.8,
      rawJson: {
        roleSlug: "customer-service-representative",
        relevance: "high"
      }
    });

    const timeline = await listApprovedSourceItemsForRole("customer-service-representative");

    expect(
      timeline.find((item) => item.title === "Support queues adopt AI assistants")
    ).toMatchObject({
      roleSlug: "customer-service-representative",
      sourceCatalogId: "test-public-timeline-inference"
    });
  });
});
