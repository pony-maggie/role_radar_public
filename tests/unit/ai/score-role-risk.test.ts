import { describe, expect, it, vi } from "vitest";
import { buildRoleRiskPrompt } from "@/lib/ai/prompts/score-role-risk";
import { scoreRoleRisk } from "@/lib/ai/score-role-risk";

const role = {
  nameEn: "Customer Service Representative",
  nameZh: "客户服务专员",
  summaryEn: "Language-heavy support role with rising automation pressure.",
  summaryZh: "以语言处理为主的支持岗位，自动化压力正在上升。",
  repetitionScore: 4,
  ruleClarityScore: 4,
  transformationScore: 5,
  workflowAutomationScore: 4,
  interpersonalScore: 2,
  physicalityScore: 1,
  ambiguityScore: 2
};

const items = [
  {
    title: "Support workflow moves to AI-first triage",
    sourceType: "official",
    signalType: "ADOPTION",
    publishedAt: "2026-04-01",
    summaryEn: "AI triage is absorbing first-line support work.",
    inferenceSummaryEn: "The official update directly affects support triage workflows.",
    impactDirection: "INCREASE",
    relevance: "HIGH",
    signalWeight: 1
  }
];

describe("buildRoleRiskPrompt", () => {
  it("includes role context and recent classified items", () => {
    const prompt = buildRoleRiskPrompt({ role, items });

    expect(prompt).toContain("Customer Service Representative");
    expect(prompt).toContain("客户服务专员");
    expect(prompt).toContain("Support workflow moves to AI-first triage");
    expect(prompt).toContain("workflow_automation=4");
    expect(prompt).toContain("today's AI replacement rate");
    expect(prompt).toContain("official/company workflow or product updates > high-quality AI media reporting > jobs postings");
    expect(prompt).toContain("Start from the role itself even if evidence is sparse");
    expect(prompt).toContain("Recent item count: 1");
    expect(prompt).toContain("signal=ADOPTION");
    expect(prompt).toContain("Broad company news, partnerships, funding, benchmark chatter, infra news, or ecosystem context");
  });
});

describe("scoreRoleRisk", () => {
  it("returns provider metadata from structured generation", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      provider: "minimax",
      model: "MiniMax-Text-01",
      data: {
        replacementRate: 71,
        riskBand: "high",
        summaryEn: "Recent adoption signals indicate rising automation pressure.",
        summaryZh: null,
        reasons: [
          {
            kind: "official",
            titleEn: "Production rollout",
            titleZh: null,
            detailEn: "Official updates show AI-first support triage in production.",
            detailZh: null
          }
        ]
      }
    });

    const result = await scoreRoleRisk(role, items, generateStructuredJson);

    expect(generateStructuredJson).toHaveBeenCalledOnce();
    expect(result).toEqual({
      provider: "minimax",
      model: "MiniMax-Text-01",
      data: expect.objectContaining({
        replacementRate: 71,
        riskBand: "high"
      })
    });
  });

  it("fails when the generator returns malformed structured output", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      provider: "gemini",
      model: "gemini-2.5-flash",
      data: {
        replacementRate: 140,
        riskBand: "extreme",
        summaryEn: "",
        reasons: []
      }
    });

    await expect(scoreRoleRisk(role, items, generateStructuredJson)).rejects.toThrow();
  });
});
