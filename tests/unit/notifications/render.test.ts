import { describe, expect, it } from "vitest";
import { renderNotification } from "@/lib/notifications/render";

describe("renderNotification", () => {
  it("renders a bilingual weekly digest", () => {
    const rendered = renderNotification({
      kind: "weekly_digest",
      email: "analyst@example.com",
      windowStart: "2026-04-06T00:00:00.000Z",
      windowEnd: "2026-04-13T00:00:00.000Z",
      roles: [
        {
          slug: "customer-service-representative",
          nameEn: "Customer Service Representative",
          nameZh: "客户服务专员",
          replacementRate: 68,
          riskLevel: "HIGH",
          riskSummaryEn: "AI triage continues to absorb first-line work.",
          riskSummaryZh: "AI 分诊继续吸收一线工作。",
          recentItems: [
            {
              title: "Support workflow moves to AI-first triage",
              summaryEn: "AI triage is absorbing first-line support work.",
              summaryZh: "AI 分诊正在吸收一线支持工作。",
              publishedAt: "2026-04-10T00:00:00.000Z",
              sourceUrl: "https://example.com/support"
            }
          ]
        }
      ]
    });

    expect(rendered.subjectEn).toContain("weekly digest");
    expect(rendered.subjectZh).toContain("周报");
    expect(rendered.text).toContain("Customer Service Representative / 客户服务专员");
    expect(rendered.html).toContain("Support workflow moves to AI-first triage");
  });

  it("renders a significant-change alert", () => {
    const rendered = renderNotification({
      kind: "significant_change",
      email: "analyst@example.com",
      roleSlug: "bookkeeping-clerk",
      roleNameEn: "Bookkeeping Clerk",
      roleNameZh: "记账员",
      previousReplacementRate: 51,
      currentReplacementRate: 62,
      delta: 11,
      riskLevel: "HIGH",
      riskSummaryEn: "Reconciliation work is being compressed further.",
      riskSummaryZh: "对账工作正在进一步被压缩。",
      recentItems: []
    });

    expect(rendered.subjectEn).toContain("Bookkeeping Clerk");
    expect(rendered.subjectZh).toContain("记账员");
    expect(rendered.text).toContain("51% -> 62%");
    expect(rendered.html).toContain("进一步被压缩");
  });
});
