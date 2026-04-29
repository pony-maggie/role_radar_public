import { describe, expect, it } from "vitest";
import {
  inferPolicySignalType,
  prepareEvidenceForRiskScoring
} from "@/lib/repositories/risk-refresh";

describe("risk refresh policy enforcement", () => {
  it("maps policy-style raw signal types into persisted scoring categories", () => {
    expect(
      inferPolicySignalType({
        sourceItem: {
          title: "OpenAI ships coding agents for software teams",
          sourceType: "COMPANY_UPDATE",
          publishedAt: new Date("2026-04-12T00:00:00.000Z"),
          summaryEn: "Capability update for coding workflows."
        },
        inferenceSummaryEn: "This expands realistic AI coding automation scope.",
        impactDirection: "INCREASE",
        relevance: "HIGH",
        signalWeight: 1,
        rawJson: {
          signalType: "capability_update"
        }
      })
    ).toBe("ADOPTION");

    expect(
      inferPolicySignalType({
        sourceItem: {
          title: "Company lists AI operations roles",
          sourceType: "JOB_POSTING",
          publishedAt: new Date("2026-04-12T00:00:00.000Z"),
          summaryEn: "Hiring shift for AI operations."
        },
        inferenceSummaryEn: "This is a hiring shift signal.",
        impactDirection: "INCREASE",
        relevance: "MEDIUM",
        signalWeight: 0.7,
        rawJson: {}
      })
    ).toBe("HIRING_SHIFT");
  });

  it("keeps strong official evidence while dropping weak ecosystem chatter", () => {
    const prepared = prepareEvidenceForRiskScoring([
      {
        sourceItem: {
          title: "OpenAI launches support workflow agent",
          sourceType: "COMPANY_UPDATE",
          publishedAt: new Date("2026-04-12T00:00:00.000Z"),
          summaryEn: "Official workflow launch."
        },
        inferenceSummaryEn: "Direct support workflow automation signal.",
        impactDirection: "INCREASE",
        relevance: "HIGH",
        signalWeight: 1,
        rawJson: {
          signalType: "workflow_restructure"
        }
      },
      {
        sourceItem: {
          title: "Analysts debate the future of AI",
          sourceType: "NEWS",
          publishedAt: new Date("2026-04-11T00:00:00.000Z"),
          summaryEn: "General ecosystem discussion."
        },
        inferenceSummaryEn: "Broad ecosystem chatter with no direct role impact.",
        impactDirection: "MAINTAIN",
        relevance: "LOW",
        signalWeight: 0.9,
        rawJson: {
          signalType: "ecosystem_context"
        }
      }
    ]);

    expect(prepared).toHaveLength(1);
    expect(prepared[0]).toMatchObject({
      title: "OpenAI launches support workflow agent",
      sourceType: "official",
      signalType: "ADOPTION",
      signalWeight: 1
    });
  });

  it("downweights jobs behind official signals and keeps only policy-compliant items", () => {
    const prepared = prepareEvidenceForRiskScoring([
      {
        sourceItem: {
          title: "Official support automation rollout",
          sourceType: "COMPANY_UPDATE",
          publishedAt: new Date("2026-04-12T00:00:00.000Z"),
          summaryEn: "Official rollout."
        },
        inferenceSummaryEn: "Official evidence.",
        impactDirection: "INCREASE",
        relevance: "HIGH",
        signalWeight: 1,
        rawJson: {
          signalType: "adoption_case"
        }
      },
      {
        sourceItem: {
          title: "Vendor blog about generalized AI trends",
          sourceType: "BLOG",
          publishedAt: new Date("2026-04-11T00:00:00.000Z"),
          summaryEn: "Broad trend piece."
        },
        inferenceSummaryEn: "Weakly relevant commentary.",
        impactDirection: "MAINTAIN",
        relevance: "LOW",
        signalWeight: 0.8,
        rawJson: {
          signalType: "ecosystem_context"
        }
      },
      {
        sourceItem: {
          title: "Company hires AI operations specialist",
          sourceType: "JOB_POSTING",
          publishedAt: new Date("2026-04-10T00:00:00.000Z"),
          summaryEn: "Hiring shift."
        },
        inferenceSummaryEn: "Supporting jobs evidence.",
        impactDirection: "INCREASE",
        relevance: "HIGH",
        signalWeight: 1,
        rawJson: {
          signalType: "hiring_shift"
        }
      }
    ]);

    expect(prepared).toHaveLength(2);
    expect(prepared[0]).toMatchObject({
      title: "Official support automation rollout",
      sourceType: "official",
      signalType: "ADOPTION",
      signalWeight: 1
    });
    expect(prepared[1]).toMatchObject({
      title: "Company hires AI operations specialist",
      sourceType: "jobs",
      signalType: "HIRING_SHIFT",
      signalWeight: 0.29
    });
  });

  it("requires jobs hiring-shift evidence to clear the explicit raw signal floor", () => {
    const prepared = prepareEvidenceForRiskScoring([
      {
        sourceItem: {
          title: "Company posts an AI operations role",
          sourceType: "JOB_POSTING",
          publishedAt: new Date("2026-04-12T00:00:00.000Z"),
          summaryEn: "Hiring shift."
        },
        inferenceSummaryEn: "Low-signal jobs evidence.",
        impactDirection: "INCREASE",
        relevance: "HIGH",
        signalWeight: 0.29,
        rawJson: {
          signalType: "hiring_shift"
        }
      }
    ]);

    expect(prepared).toEqual([]);
  });

  it("excludes evidence that cannot affect replacement rate", () => {
    const prepared = prepareEvidenceForRiskScoring([
      {
        sourceItem: {
          title: "Company blog about general AI platform direction",
          sourceType: "COMPANY_UPDATE",
          publishedAt: new Date("2026-04-12T00:00:00.000Z"),
          summaryEn: "Direct-mapped official source with broad ecosystem context."
        },
        inferenceSummaryEn: "Broad ecosystem context without direct workflow impact.",
        impactDirection: "INCREASE",
        relevance: "MEDIUM",
        signalWeight: 0.45,
        rawJson: {
          sourceKind: "other",
          signalType: "ecosystem_context",
          strategyId: "broad_ecosystem_context",
          strategyCanAffectReplacementRate: false
        }
      }
    ]);

    expect(prepared).toHaveLength(0);
  });

  it("keeps weaker adjacent medium-relevance media items out of scoring inputs", () => {
    const prepared = prepareEvidenceForRiskScoring([
      {
        sourceItem: {
          title: "AI copilots speed finance reconciliation review",
          sourceType: "NEWS",
          publishedAt: new Date("2026-04-12T00:00:00.000Z"),
          summaryEn: "Media report about adjacent finance workflow overlap."
        },
        inferenceSummaryEn: "Concrete adjacent workflow overlap, but still lighter media evidence.",
        impactDirection: "INCREASE",
        relevance: "MEDIUM",
        signalWeight: 0.45,
        rawJson: {
          signalType: "adoption_case"
        }
      }
    ]);

    expect(prepared).toEqual([]);
  });

  it("allows stronger medium-relevance media evidence into scoring inputs", () => {
    const prepared = prepareEvidenceForRiskScoring([
      {
        sourceItem: {
          title: "Auditors shift core review work to AI copilots",
          sourceType: "NEWS",
          publishedAt: new Date("2026-04-12T00:00:00.000Z"),
          summaryEn: "Media report describing a concrete workflow shift."
        },
        inferenceSummaryEn: "Concrete workflow restructuring with unusually strong supporting evidence.",
        impactDirection: "INCREASE",
        relevance: "MEDIUM",
        signalWeight: 0.64,
        rawJson: {
          signalType: "workflow_restructure"
        }
      }
    ]);

    expect(prepared).toHaveLength(1);
    expect(prepared[0]).toMatchObject({
      title: "Auditors shift core review work to AI copilots",
      sourceType: "media",
      signalType: "ADOPTION",
      signalWeight: 0.33
    });
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
        signalWeight: 1,
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
});
