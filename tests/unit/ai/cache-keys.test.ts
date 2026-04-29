import { describe, expect, it } from "vitest";
import {
  ROLE_RISK_PROMPT_VERSION,
  SOURCE_ITEM_PROMPT_VERSION,
  buildRoleRiskInputHash,
  buildSourceClassificationInputHash
} from "@/lib/ai/cache-keys";

describe("cache key builders", () => {
  it("returns the same source classification hash for the same logical input", () => {
    const first = buildSourceClassificationInputHash({
      sourceCatalogId: "official-openai-news",
      sourceUrl: "https://example.com/a",
      sourceType: "COMPANY_UPDATE",
      title: "Support workflow moves to AI-first triage",
      summaryEn: "AI triage is absorbing first-line support work.",
      topicHints: ["customer support", "workflow automation"],
      candidateSlugs: ["customer-service-representative", "computer-systems-analysts"],
      promptVersion: SOURCE_ITEM_PROMPT_VERSION,
      modelName: "gemini-2.5-flash"
    });

    const second = buildSourceClassificationInputHash({
      sourceCatalogId: "official-openai-news",
      sourceUrl: "https://example.com/a",
      sourceType: "COMPANY_UPDATE",
      title: "Support workflow moves to AI-first triage",
      summaryEn: "AI triage is absorbing first-line support work.",
      topicHints: ["customer support", "workflow automation"],
      candidateSlugs: ["customer-service-representative", "computer-systems-analysts"],
      promptVersion: SOURCE_ITEM_PROMPT_VERSION,
      modelName: "gemini-2.5-flash"
    });

    expect(first).toBe(second);
  });

  it("changes the source classification hash when candidate roles change", () => {
    const first = buildSourceClassificationInputHash({
      sourceCatalogId: "official-openai-news",
      sourceUrl: "https://example.com/a",
      sourceType: "COMPANY_UPDATE",
      title: "Support workflow moves to AI-first triage",
      summaryEn: "AI triage is absorbing first-line support work.",
      topicHints: ["customer support"],
      candidateSlugs: ["customer-service-representative"],
      promptVersion: SOURCE_ITEM_PROMPT_VERSION,
      modelName: "gemini-2.5-flash"
    });

    const second = buildSourceClassificationInputHash({
      sourceCatalogId: "official-openai-news",
      sourceUrl: "https://example.com/a",
      sourceType: "COMPANY_UPDATE",
      title: "Support workflow moves to AI-first triage",
      summaryEn: "AI triage is absorbing first-line support work.",
      topicHints: ["customer support"],
      candidateSlugs: ["customer-service-representative", "computer-systems-analysts"],
      promptVersion: SOURCE_ITEM_PROMPT_VERSION,
      modelName: "gemini-2.5-flash"
    });

    expect(first).not.toBe(second);
  });

  it("changes the role risk hash when prepared evidence changes", () => {
    const first = buildRoleRiskInputHash({
      role: {
        slug: "customer-service-representative",
        nameEn: "Customer Service Representative",
        nameZh: "客户服务专员",
        summaryEn: "Handle support workflows.",
        summaryZh: "处理客服流程。",
        keywords: ["support", "tickets"],
        repetitionScore: 78,
        ruleClarityScore: 74,
        transformationScore: 71,
        workflowAutomationScore: 81,
        interpersonalScore: 42,
        physicalityScore: 12,
        ambiguityScore: 31
      },
      evidence: [
        {
          title: "A",
          sourceType: "official",
          signalType: "ADOPTION",
          publishedAt: "2026-04-15",
          summaryEn: "A",
          inferenceSummaryEn: "A",
          impactDirection: "INCREASE",
          relevance: "HIGH",
          signalWeight: 0.6
        }
      ],
      promptVersion: ROLE_RISK_PROMPT_VERSION,
      modelName: "gemini-2.5-flash"
    });

    const second = buildRoleRiskInputHash({
      role: {
        slug: "customer-service-representative",
        nameEn: "Customer Service Representative",
        nameZh: "客户服务专员",
        summaryEn: "Handle support workflows.",
        summaryZh: "处理客服流程。",
        keywords: ["support", "tickets"],
        repetitionScore: 78,
        ruleClarityScore: 74,
        transformationScore: 71,
        workflowAutomationScore: 81,
        interpersonalScore: 42,
        physicalityScore: 12,
        ambiguityScore: 31
      },
      evidence: [
        {
          title: "B",
          sourceType: "official",
          signalType: "ADOPTION",
          publishedAt: "2026-04-15",
          summaryEn: "B",
          inferenceSummaryEn: "B",
          impactDirection: "INCREASE",
          relevance: "HIGH",
          signalWeight: 0.6
        }
      ],
      promptVersion: ROLE_RISK_PROMPT_VERSION,
      modelName: "gemini-2.5-flash"
    });

    expect(first).not.toBe(second);
  });

  it("changes the source classification hash when topic hints change", () => {
    const first = buildSourceClassificationInputHash({
      sourceCatalogId: "official-openai-news",
      sourceUrl: "https://example.com/a",
      sourceType: "COMPANY_UPDATE",
      title: "Support workflow moves to AI-first triage",
      summaryEn: "AI triage is absorbing first-line support work.",
      topicHints: ["customer support"],
      candidateSlugs: ["customer-service-representative", "computer-systems-analysts"],
      promptVersion: SOURCE_ITEM_PROMPT_VERSION,
      modelName: "gemini-2.5-flash"
    });

    const second = buildSourceClassificationInputHash({
      sourceCatalogId: "official-openai-news",
      sourceUrl: "https://example.com/a",
      sourceType: "COMPANY_UPDATE",
      title: "Support workflow moves to AI-first triage",
      summaryEn: "AI triage is absorbing first-line support work.",
      topicHints: ["developer tools"],
      candidateSlugs: ["customer-service-representative", "computer-systems-analysts"],
      promptVersion: SOURCE_ITEM_PROMPT_VERSION,
      modelName: "gemini-2.5-flash"
    });

    expect(first).not.toBe(second);
  });
});
