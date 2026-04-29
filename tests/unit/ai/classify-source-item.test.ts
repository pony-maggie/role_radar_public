import { describe, expect, it, vi } from "vitest";
import { buildSourceItemClassificationPrompt } from "@/lib/ai/prompts/classify-source-item";
import { buildSourceClassificationInputHash } from "@/lib/ai/cache-keys";
import {
  buildSourceClassificationCacheModelName,
  buildSourceClassificationContext,
  hasUsableSourceClassificationCache,
  classifySourceItem
} from "@/lib/ai/classify-source-item";
import { fetchRssItems } from "@/lib/ingest/fetch-rss";
import { selectRoleCandidates } from "@/lib/ingest/select-role-candidates";

const roles = [
  {
    slug: "customer-service-representative",
    nameEn: "Customer Service Representative",
    nameZh: "客户服务专员",
    keywords: ["customer support", "ticket triage", "help desk"]
  },
  {
    slug: "bookkeeping-clerk",
    nameEn: "Bookkeeping Clerk",
    nameZh: "记账员",
    keywords: ["bookkeeping", "reconciliation", "invoice"]
  }
];

describe("buildSourceItemClassificationPrompt", () => {
  it("includes role dictionary context and source item details", () => {
    const prompt = buildSourceItemClassificationPrompt({
      sourceItem: {
        sourceLabel: "OpenAI Newsroom",
        sourceType: "COMPANY_UPDATE",
        title: "Support workflow moves to AI-first triage",
        summary: "AI triage is absorbing first-line support work.",
        topicHints: ["customer support", "workflow automation"]
      },
      roles: roles.map((role) => ({ ...role, matchedKeywords: role.keywords.slice(0, 1), score: 12 }))
    });

    expect(prompt).toContain("OpenAI Newsroom");
    expect(prompt).toContain("Support workflow moves to AI-first triage");
    expect(prompt).toContain("customer-service-representative");
    expect(prompt).toContain("客户服务专员");
    expect(prompt).toContain("ticket triage");
    expect(prompt).toContain("Balanced attribution");
    expect(prompt).toContain("return assignedRoleSlug as null");
    expect(prompt).toContain("occupational workflow test");
    expect(prompt).toContain("capability_update, adoption_case, workflow_restructure, hiring_shift, and ecosystem_context");
    expect(prompt).toContain("Only the first four can justify a role attachment");
    expect(prompt).toContain("Always return signalType");
    expect(prompt).toContain("official > media > jobs for trust");
    expect(prompt).toContain("prefer the best reasonable occupation match");
    expect(prompt).toContain("do not require a perfect or overwhelming margin");
    expect(prompt).toContain("similar or adjacent role");
    expect(prompt).toContain("adjacent workflow or task cluster");
    expect(prompt).toContain("Timeline attachment can be broader than scoring");
    expect(prompt).toContain("funding news, model launches, or broad ecosystem commentary");
    expect(prompt).toContain("Source topic hints: customer support, workflow automation");
  });
});

describe("classifySourceItem", () => {
  it("preserves fetched source topic hints into downstream candidates, prompt context, and cache context", async () => {
    const source = {
      id: "official-openai-news",
      label: "OpenAI Newsroom",
      class: "official",
      transport: "rss",
      tier: "structured",
      enabledByDefault: true,
      locale: "en",
      url: "https://example.com/openai-news.xml",
      mappingMode: "observe_only",
      sourceType: "COMPANY_UPDATE",
      topicHints: ["customer support", "ticket triage"]
    } as const;
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<?xml version="1.0"?>
        <rss>
          <channel>
            <item>
              <title>OpenAI expands internal operations playbooks</title>
              <link>https://example.com/support-playbook</link>
              <pubDate>Tue, 01 Apr 2026 00:00:00 GMT</pubDate>
              <description>Rollout plans, coordination changes, and adoption milestones for internal teams.</description>
            </item>
          </channel>
        </rss>`
    });
    const generateStructuredJson = vi.fn().mockResolvedValue({
      assignedRoleSlug: "customer-service-representative",
      sourceKind: "official",
      signalType: "workflow_restructure",
      relevance: "medium",
      impactDirection: "increase",
      explanation: "The hinted workflow maps to customer support operations.",
      summaryEn: "Hints narrow the source toward customer support workflow changes.",
      summaryZh: null,
      signalWeight: "secondary"
    });

    const [fetchedItem] = await fetchRssItems(source, fetchFn as typeof fetch);

    expect(fetchedItem?.topicHints).toEqual(["customer support", "ticket triage"]);

    const context = buildSourceClassificationContext(fetchedItem!, roles, "gemini-2.5-flash");
    const withoutHintsContext = buildSourceClassificationContext(
      { ...fetchedItem!, topicHints: undefined },
      roles,
      "gemini-2.5-flash"
    );

    expect(context.candidates.map((candidate) => candidate.slug)).toContain(
      "customer-service-representative"
    );
    expect(withoutHintsContext.candidates.map((candidate) => candidate.slug)).not.toContain(
      "customer-service-representative"
    );
    expect(context.inputHash).not.toBe(withoutHintsContext.inputHash);

    await classifySourceItem(fetchedItem!, roles, generateStructuredJson, { context });

    const prompt = generateStructuredJson.mock.calls[0][0]?.prompt as string;
    expect(prompt).toContain("Source topic hints: customer support, ticket triage");
    expect(prompt).toContain("customer-service-representative");
    expect(prompt).not.toContain("bookkeeping-clerk | en: Bookkeeping Clerk | zh: 记账员 | score: 0");
  });

  it("narrows candidates before invoking the generator", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      assignedRoleSlug: "customer-service-representative",
      sourceKind: "official",
      signalType: "workflow_restructure",
      relevance: "high",
      impactDirection: "increase",
      explanation: "The source describes AI replacing first-line customer support triage.",
      summaryEn: "The source maps to customer support automation.",
      summaryZh: null,
      signalWeight: "primary"
    });

    await classifySourceItem(
      {
        sourceLabel: "OpenAI Newsroom",
        sourceType: "COMPANY_UPDATE",
        title: "Support workflow moves to AI-first triage",
        summary: "AI triage is absorbing first-line support work.",
        topicHints: ["customer support", "workflow automation"]
      },
      roles,
      generateStructuredJson
    );

    const prompt = generateStructuredJson.mock.calls[0][0]?.prompt as string;
    expect(prompt).toContain("customer-service-representative");
    expect(prompt).not.toContain("bookkeeping-clerk | en: Bookkeeping Clerk | zh: 记账员 | score: 0");
    expect(prompt).toContain("Source topic hints: customer support, workflow automation");
  });

  it("returns normalized structured output from the generator", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      assignedRoleSlug: "customer-service-representative",
      sourceKind: "official",
      signalType: "workflow_restructure",
      relevance: "high",
      impactDirection: "increase",
      explanation: "The source describes AI replacing first-line customer support triage.",
      summaryEn: "The source maps to customer support automation.",
      summaryZh: null,
      signalWeight: "primary"
    });

    const result = await classifySourceItem(
      {
        sourceLabel: "OpenAI Newsroom",
        sourceType: "COMPANY_UPDATE",
        title: "Support workflow moves to AI-first triage",
        summary: "AI triage is absorbing first-line support work."
      },
      roles,
      generateStructuredJson
    );

    expect(generateStructuredJson).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      assignedRoleSlug: "customer-service-representative",
      relevance: "high",
      impactDirection: "increase"
    });
  });

  it("preserves provider metadata from structured generation results", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      provider: "minimax",
      model: "MiniMax-Text-01",
      data: {
        assignedRoleSlug: "customer-service-representative",
        sourceKind: "official",
        signalType: "workflow_restructure",
        relevance: "high",
        impactDirection: "increase",
        explanation: "The source describes AI replacing first-line customer support triage.",
        summaryEn: "The source maps to customer support automation.",
        summaryZh: null,
        signalWeight: "primary"
      }
    });

    const result = await classifySourceItem(
      {
        sourceLabel: "OpenAI Newsroom",
        sourceType: "COMPANY_UPDATE",
        title: "Support workflow moves to AI-first triage",
        summary: "AI triage is absorbing first-line support work."
      },
      roles,
      generateStructuredJson
    );

    expect(result).toMatchObject({
      assignedRoleSlug: "customer-service-representative",
      modelProvider: "minimax",
      modelName: "MiniMax-Text-01"
    });
  });

  it("falls back to the top candidate when the model returns null for a still-concrete role-like item", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      assignedRoleSlug: null,
      sourceKind: "media",
      signalType: "ecosystem_context",
      relevance: "medium",
      impactDirection: "neutral",
      explanation: "The article is broad but clearly discusses coding workflow changes caused by AI assistants.",
      summaryEn: "AI coding assistants are changing developer release and review workflows.",
      summaryZh: null,
      signalWeight: "supporting"
    });

    const result = await classifySourceItem(
      {
        sourceLabel: "VentureBeat AI",
        sourceType: "NEWS",
        title: "AI copilots are reshaping software team release workflow",
        summary:
          "Teams use copilots to review pull requests, summarize changes, and route release work faster.",
        topicHints: ["developer tooling", "software engineering", "release workflow"]
      },
      [
        ...roles,
        {
          slug: "computer-occupations-all-other",
          nameEn: "Computer Occupations, All Other",
          nameZh: "其他计算机职业",
          keywords: ["developer tooling", "technical workflows", "engineering systems"]
        }
      ],
      generateStructuredJson
    );

    expect(result).toMatchObject({
      assignedRoleSlug: "computer-occupations-all-other"
    });
    expect(result.explanation).toContain("closest matching role candidate");
  });

  it("promotes official adjacent workflow coverage into timeline attachment when the model returns null", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      assignedRoleSlug: null,
      sourceKind: "official",
      signalType: "ecosystem_context",
      relevance: "low",
      impactDirection: "neutral",
      explanation: "The update is broad product news but it does mention reconciliation review work.",
      summaryEn: "AI support is showing up in reconciliation review workflows.",
      summaryZh: null,
      signalWeight: "supporting"
    });

    const result = await classifySourceItem(
      {
        sourceLabel: "Finance Platform Blog",
        sourceType: "COMPANY_UPDATE",
        title: "AI reconciliation review expands across finance operations teams",
        summary:
          "The company says teams now use AI to speed reconciliation checks and finance workflow review."
      },
      roles,
      generateStructuredJson
    );

    expect(result.assignedRoleSlug).toBe("bookkeeping-clerk");
    expect(result.explanation).toContain("closest matching role candidate");
  });

  it("promotes adjacent workflow media coverage into timeline attachment when the model returns null", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      assignedRoleSlug: null,
      sourceKind: "media",
      signalType: "ecosystem_context",
      relevance: "medium",
      impactDirection: "neutral",
      explanation:
        "The article is about finance workflow changes and reconciliation review tools used by operations teams.",
      summaryEn: "AI is changing reconciliation review workflows in finance operations.",
      summaryZh: null,
      signalWeight: "supporting"
    });

    const result = await classifySourceItem(
      {
        sourceLabel: "The Decoder",
        sourceType: "NEWS",
        title: "AI changes reconciliation review workflows for finance teams",
        summary:
          "Teams use AI to speed up reconciliation review and other finance operations workflows."
      },
      [
        ...roles,
        {
          slug: "bookkeeping-clerk",
          nameEn: "Bookkeeping Clerk",
          nameZh: "记账员",
          keywords: ["bookkeeping", "reconciliation", "invoice"]
        }
      ],
      generateStructuredJson
    );

    expect(result).toMatchObject({
      assignedRoleSlug: "bookkeeping-clerk",
      relevance: "medium"
    });
    expect(result.explanation).toContain("closest matching role candidate");
  });

  it("promotes concrete adjacent workflow coverage into timeline attachment even without an alias-backed role", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      assignedRoleSlug: null,
      sourceKind: "media",
      signalType: "ecosystem_context",
      relevance: "medium",
      impactDirection: "neutral",
      explanation:
        "The article is about AI changing survey analysis and research review workflows for research teams.",
      summaryEn: "AI is changing survey analysis workflows in research operations.",
      summaryZh: null,
      signalWeight: "supporting"
    });

    const result = await classifySourceItem(
      {
        sourceLabel: "Research Tech Media",
        sourceType: "NEWS",
        title: "AI survey analysis workflows reshape research teams",
        summary:
          "Teams use AI to speed up survey analysis, research review, and report synthesis."
      },
      [
        ...roles,
        {
          slug: "market-research-analyst",
          nameEn: "Market Research Analyst",
          nameZh: "市场研究分析师",
          keywords: ["survey analysis", "research review", "report synthesis"]
        }
      ],
      generateStructuredJson
    );

    expect(result.assignedRoleSlug).toBe("market-research-analyst");
    expect(result.explanation).toContain("closest matching role candidate");
  });

  it("does not promote generic sponsorship or brand news when the model returns null", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      assignedRoleSlug: null,
      sourceKind: "official",
      signalType: "ecosystem_context",
      relevance: "low",
      impactDirection: "neutral",
      explanation: "The post is brand news for customer support leaders, not workflow change.",
      summaryEn: "The company expanded a customer support sponsorship program.",
      summaryZh: null,
      signalWeight: "supporting"
    });

    const result = await classifySourceItem(
      {
        sourceLabel: "Vendor Blog",
        sourceType: "COMPANY_UPDATE",
        title: "Vendor expands customer support sponsorship program",
        summary: "The company announced a broader sponsorship and brand program for customer support leaders."
      },
      roles,
      generateStructuredJson
    );

    expect(result.assignedRoleSlug).toBeNull();
  });

  it("keeps generic ecosystem funding news unmatched", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      assignedRoleSlug: null,
      sourceKind: "media",
      signalType: "ecosystem_context",
      relevance: "none",
      impactDirection: "neutral",
      explanation: "This is broad funding and ecosystem commentary without a concrete workflow angle.",
      summaryEn: "The article is generic funding coverage.",
      summaryZh: null,
      signalWeight: "supporting"
    });

    const result = await classifySourceItem(
      {
        sourceLabel: "VentureBeat AI",
        sourceType: "NEWS",
        title: "AI startup raises funding to expand its platform",
        summary: "The piece covers funding, valuation, and broader ecosystem momentum."
      },
      roles,
      generateStructuredJson
    );

    expect(result).toMatchObject({
      assignedRoleSlug: null,
      signalType: "ecosystem_context",
      relevance: "none"
    });
  });

  it("returns unmatched without calling the generator when no candidate is strong enough", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      assignedRoleSlug: null,
      sourceKind: "official",
      signalType: "ecosystem_context",
      relevance: "none",
      impactDirection: "neutral",
      explanation: "fallback",
      summaryEn: "fallback",
      summaryZh: null,
      signalWeight: "supporting"
    });

    const result = await classifySourceItem(
      {
        sourceLabel: "Anthropic News",
        sourceType: "COMPANY_UPDATE",
        title: "Anthropic expands compute infrastructure and energy procurement",
        summary: "The announcement covers data center capacity, electricity sourcing, and vendor relationships."
      },
      roles,
      generateStructuredJson
    );

    expect(generateStructuredJson).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      assignedRoleSlug: null,
      signalType: "ecosystem_context",
      relevance: "none",
      impactDirection: "neutral"
    });
  });

  it("fails cleanly when the generator returns invalid structured output", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      assignedRoleSlug: "",
      relevance: "extreme"
    });

    await expect(
      classifySourceItem(
        {
          sourceLabel: "OpenAI Newsroom",
          sourceType: "COMPANY_UPDATE",
          title: "Support workflow moves to AI-first triage",
          summary: "AI triage is absorbing first-line support work."
        },
        roles,
        generateStructuredJson
      )
    ).rejects.toThrow();
  });

  it("falls back to the closest candidate when the generator errors and overlap is strong enough", async () => {
    const generateStructuredJson = vi.fn().mockRejectedValue(new Error("Gemini unavailable"));

    const result = await classifySourceItem(
      {
        sourceLabel: "VentureBeat AI",
        sourceType: "NEWS",
        title: "AI copilots are reshaping software team release workflow",
        summary:
          "Teams use copilots to review pull requests, summarize changes, and route release work faster.",
        topicHints: ["developer tooling", "software engineering", "release workflow"]
      },
      [
        ...roles,
        {
          slug: "computer-occupations-all-other",
          nameEn: "Computer Occupations, All Other",
          nameZh: "其他计算机职业",
          keywords: ["developer tooling", "technical workflows", "engineering systems"]
        }
      ],
      generateStructuredJson
    );

    expect(result).toMatchObject({
      assignedRoleSlug: "computer-occupations-all-other",
      signalType: "ecosystem_context",
      relevance: "low",
      modelProvider: "fallback",
      modelName: "classification-fallback"
    });
    expect(result.explanation).toContain("Gemini unavailable");
  });

  it("falls back to unmatched when the model returns a slug outside the candidate set", async () => {
    const generateStructuredJson = vi.fn().mockResolvedValue({
      assignedRoleSlug: "models",
      sourceKind: "official",
      signalType: "capability_update",
      relevance: "high",
      impactDirection: "increase",
      explanation: "The source updates model-building workflows.",
      summaryEn: "The source is relevant to model work.",
      summaryZh: null,
      signalWeight: "primary"
    });

    const result = await classifySourceItem(
      {
        sourceLabel: "OpenAI Newsroom",
        sourceType: "COMPANY_UPDATE",
        title: "Support workflow moves to AI-first triage",
        summary: "AI triage is absorbing first-line support work."
      },
      roles,
      generateStructuredJson
    );

    expect(result).toMatchObject({
      assignedRoleSlug: null,
      signalType: "ecosystem_context",
      relevance: "none",
      impactDirection: "neutral"
    });
  });

  it("reuses cached classification when the input hash, prompt version, and model all match", async () => {
    const generateStructuredJson = vi.fn();
    const sourceItem = {
      sourceCatalogId: "official-openai-news",
      sourceUrl: "https://example.com/support-workflow",
      sourceLabel: "OpenAI Newsroom",
      sourceType: "COMPANY_UPDATE",
      title: "Support workflow moves to AI-first triage",
      summary: "AI triage is absorbing first-line support work."
    } as const;
    const context = buildSourceClassificationContext(sourceItem, roles, "gemini-2.5-flash");

    const result = await classifySourceItem(sourceItem, roles, generateStructuredJson, {
      context,
      cachedEntry: {
        classificationInputHash: context.inputHash,
        classificationPromptVersion: context.promptVersion,
        classificationModelName: context.modelName,
        inference: {
          modelProvider: "gemini",
          modelName: "gemini-2.5-flash",
          assignedRoleSlug: "customer-service-representative",
          impactDirection: "INCREASE",
          relevance: "HIGH",
          inferenceSummaryEn: "Cached support workflow match.",
          inferenceSummaryZh: "缓存的客服工作流匹配。",
          signalWeight: 0.9,
          rawJson: {
            assignedRoleSlug: "customer-service-representative",
            sourceKind: "official",
            signalType: "workflow_restructure",
            relevance: "high",
            impactDirection: "increase",
            explanation: "Cached support workflow match.",
            summaryEn: "Cached support workflow match.",
            summaryZh: "缓存的客服工作流匹配。",
            signalWeight: "primary"
          }
        },
        decisions: [
          {
            decisionStatus: "ACCEPTED",
            reason: "Cached support workflow match."
          }
        ]
      }
    });

    expect(generateStructuredJson).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      assignedRoleSlug: "customer-service-representative",
      signalType: "workflow_restructure",
      relevance: "high",
      impactDirection: "increase"
    });
    expect(
      hasUsableSourceClassificationCache(
        {
          classificationInputHash: context.inputHash,
          classificationPromptVersion: context.promptVersion,
          classificationModelName: context.modelName,
          inference: {
            modelProvider: "gemini",
            modelName: "gemini-2.5-flash",
            assignedRoleSlug: "customer-service-representative",
            impactDirection: "INCREASE",
            relevance: "HIGH",
            inferenceSummaryEn: "Cached support workflow match.",
            inferenceSummaryZh: "缓存的客服工作流匹配。",
            signalWeight: 0.9,
            rawJson: {
              assignedRoleSlug: "customer-service-representative",
              sourceKind: "official",
              signalType: "workflow_restructure",
              relevance: "high",
              impactDirection: "increase",
              explanation: "Cached support workflow match.",
              summaryEn: "Cached support workflow match.",
              summaryZh: "缓存的客服工作流匹配。",
              signalWeight: "primary"
            }
          },
          decisions: [{ decisionStatus: "ACCEPTED", reason: "Cached support workflow match." }]
        },
        context
      )
    ).toBe(true);
  });

  it("reuses cached minimax classification when cache metadata stores the actual provider-aware model key", async () => {
    const generateStructuredJson = vi.fn();
    const sourceItem = {
      sourceCatalogId: "official-openai-news",
      sourceUrl: "https://example.com/support-workflow-minimax",
      sourceLabel: "OpenAI Newsroom",
      sourceType: "COMPANY_UPDATE",
      title: "Support workflow moves to AI-first triage",
      summary: "AI triage is absorbing first-line support work."
    } as const;
    const context = buildSourceClassificationContext(
      sourceItem,
      roles,
      "gemini-2.5-flash",
      {
        GEMINI_MODEL: "gemini-2.5-flash",
        MINIMAX_API_KEY: "minimax-key",
        MINIMAX_MODEL: "MiniMax-Text-01"
      } as NodeJS.ProcessEnv
    );
    const minimaxModelName = buildSourceClassificationCacheModelName("minimax", "MiniMax-Text-01");
    const minimaxInputHash = buildSourceClassificationInputHash({
      sourceCatalogId: sourceItem.sourceCatalogId,
      sourceUrl: sourceItem.sourceUrl,
      sourceType: sourceItem.sourceType,
      title: sourceItem.title,
      summaryEn: sourceItem.summary,
      topicHints: [],
      candidateSlugs: context.candidates.map((candidate) => candidate.slug),
      promptVersion: context.promptVersion,
      modelName: minimaxModelName
    });

    const result = await classifySourceItem(sourceItem, roles, generateStructuredJson, {
      context,
      cachedEntry: {
        classificationInputHash: minimaxInputHash,
        classificationPromptVersion: context.promptVersion,
        classificationModelName: minimaxModelName,
        inference: {
          modelProvider: "minimax",
          modelName: "MiniMax-Text-01",
          assignedRoleSlug: "customer-service-representative",
          impactDirection: "INCREASE",
          relevance: "HIGH",
          inferenceSummaryEn: "Cached MiniMax support workflow match.",
          inferenceSummaryZh: "缓存的 MiniMax 客服工作流匹配。",
          signalWeight: 0.9,
          rawJson: {
            assignedRoleSlug: "customer-service-representative",
            sourceKind: "official",
            signalType: "workflow_restructure",
            relevance: "high",
            impactDirection: "increase",
            explanation: "Cached MiniMax support workflow match.",
            summaryEn: "Cached MiniMax support workflow match.",
            summaryZh: "缓存的 MiniMax 客服工作流匹配。",
            signalWeight: "primary"
          }
        },
        decisions: [{ decisionStatus: "ACCEPTED", reason: "Cached MiniMax support workflow match." }]
      }
    });

    expect(generateStructuredJson).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      assignedRoleSlug: "customer-service-representative",
      modelProvider: "minimax",
      modelName: "MiniMax-Text-01"
    });
    expect(
      hasUsableSourceClassificationCache(
        {
          classificationInputHash: minimaxInputHash,
          classificationPromptVersion: context.promptVersion,
          classificationModelName: minimaxModelName,
          inference: {
            modelProvider: "minimax",
            modelName: "MiniMax-Text-01",
            assignedRoleSlug: "customer-service-representative",
            impactDirection: "INCREASE",
            relevance: "HIGH",
            inferenceSummaryEn: "Cached MiniMax support workflow match.",
            inferenceSummaryZh: "缓存的 MiniMax 客服工作流匹配。",
            signalWeight: 0.9,
            rawJson: {
              assignedRoleSlug: "customer-service-representative",
              sourceKind: "official",
              signalType: "workflow_restructure",
              relevance: "high",
              impactDirection: "increase",
              explanation: "Cached MiniMax support workflow match.",
              summaryEn: "Cached MiniMax support workflow match.",
              summaryZh: "缓存的 MiniMax 客服工作流匹配。",
              signalWeight: "primary"
            }
          },
          decisions: [{ decisionStatus: "ACCEPTED", reason: "Cached MiniMax support workflow match." }]
        },
        context
      )
    ).toBe(true);
  });
});

describe("selectRoleCandidates", () => {
  it("prefers support roles when the source item is clearly about support workflows", () => {
    const candidates = selectRoleCandidates(
      {
        sourceLabel: "OpenAI",
        sourceType: "COMPANY_UPDATE",
        title: "Improving support with every interaction at OpenAI",
        summary: "Support reps build classifiers, close workflow gaps, and redesign ticket triage."
      },
      roles
    );

    expect(candidates[0]?.slug).toBe("customer-service-representative");
    expect(candidates[0]?.matchedKeywords).toContain("ticket triage");
  });

  it("keeps support roles in the candidate set when topic hints provide the strongest signal", () => {
    const candidates = selectRoleCandidates(
      {
        sourceLabel: "OpenAI",
        sourceType: "COMPANY_UPDATE",
        title: "OpenAI expands internal operations playbooks",
        summary:
          "The update covers rollout plans, coordination changes, and how teams will absorb the new process.",
        topicHints: ["customer support", "ticket triage"]
      },
      roles
    );

    expect(candidates.map((candidate) => candidate.slug)).toContain("customer-service-representative");
  });
});
