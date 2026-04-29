import { describe, expect, it } from "vitest";
import {
  classifySignalStrength,
  dedupeBySourceUrl,
  normalizeSignalClassification
} from "@/lib/ingest/classify-signal";
import { deriveItemStrategy } from "@/lib/ingest/item-strategy";
import { normalizeSignalClassification as normalizeStrategyAwareSignalClassification } from "@/lib/ingest/signal-policy";

describe("signal classification", () => {
  it("treats direct company workflow announcements as HIGH strength", () => {
    expect(
      classifySignalStrength({
        sourceType: "COMPANY_UPDATE",
        signalType: "ADOPTION",
        title: "Company replaces first-line support queue with AI assistant"
      })
    ).toBe("HIGH");
  });

  it("normalizes official adoption items into persistent ADOPTION signals", () => {
    const normalized = normalizeSignalClassification({
      sourceClass: "official",
      sourceType: "COMPANY_UPDATE",
      assignedRoleSlug: "customer-service-representative",
      strategy: deriveItemStrategy({
        sourceClass: "official",
        sourceType: "COMPANY_UPDATE"
      }),
      classification: {
        sourceKind: "official",
        signalType: "workflow_restructure",
        relevance: "high",
        impactDirection: "increase",
        explanation: "Official workflow update",
        summaryEn: "The company update changes a specific workflow.",
        summaryZh: null,
        signalWeight: "primary"
      }
    });

    expect(normalized).toMatchObject({
      signalType: "ADOPTION",
      signalStrength: "HIGH",
      shouldPersistSignal: true
    });
    expect(normalized.signalWeight).toBe(1);
  });

  it("normalizes job postings into lower-strength hiring signals", () => {
    const normalized = normalizeSignalClassification({
      sourceClass: "jobs",
      sourceType: "JOB_POSTING",
      assignedRoleSlug: "customer-service-representative",
      strategy: deriveItemStrategy({
        sourceClass: "jobs",
        sourceType: "JOB_POSTING"
      }),
      classification: {
        sourceKind: "jobs",
        signalType: "hiring_shift",
        relevance: "high",
        impactDirection: "increase",
        explanation: "Job posting describes workflow ownership.",
        summaryEn: "The role adds automation responsibilities.",
        summaryZh: null,
        signalWeight: "primary"
      }
    });

    expect(normalized).toMatchObject({
      signalType: "HIRING_SHIFT",
      signalStrength: "MEDIUM",
      shouldPersistSignal: true
    });
    expect(normalized.signalWeight).toBeCloseTo(0.6, 2);
  });

  it("uses the strategy default signal type before source-class heuristics", () => {
    const normalized = normalizeStrategyAwareSignalClassification({
      sourceClass: "media",
      sourceType: "NEWS",
      assignedRoleSlug: "customer-service-representative",
      strategy: {
        strategyId: "jobs_hiring_shift",
        defaultSignalType: "hiring_shift",
        canAffectReplacementRate: true,
        attributionBias: "balanced"
      },
      classification: null
    });

    expect(normalized.signalType).toBe("HIRING_SHIFT");
  });

  it("treats broad official ecosystem context as non-rate-affecting in the real ingest path", () => {
    const classification = {
      sourceKind: "other" as const,
      signalType: "ecosystem_context" as const,
      relevance: "medium" as const,
      signalWeight: "supporting" as const
    };
    const strategy = deriveItemStrategy({
      sourceClass: "official",
      sourceType: "COMPANY_UPDATE",
      classification
    });
    const normalized = normalizeStrategyAwareSignalClassification({
      sourceClass: "official",
      sourceType: "COMPANY_UPDATE",
      assignedRoleSlug: "customer-service-representative",
      strategy,
      classification
    });

    expect(strategy).toMatchObject({
      strategyId: "broad_ecosystem_context",
      canAffectReplacementRate: false
    });
    expect(normalized.signalType).toBe("TOOLING");
    expect(normalized.shouldPersistSignal).toBe(false);
  });

  it("suppresses weak ecosystem context from creating signal rows", () => {
    const normalized = normalizeSignalClassification({
      sourceClass: "media",
      sourceType: "NEWS",
      assignedRoleSlug: "customer-service-representative",
      strategy: deriveItemStrategy({
        sourceClass: "media",
        sourceType: "NEWS"
      }),
      classification: {
        sourceKind: "other",
        signalType: "ecosystem_context",
        relevance: "none",
        impactDirection: "neutral",
        explanation: "Broad ecosystem commentary",
        summaryEn: "This item is too generic to influence a role timeline.",
        summaryZh: null,
        signalWeight: "supporting"
      }
    });

    expect(normalized).toMatchObject({
      signalType: "TOOLING",
      signalStrength: "LOW",
      shouldPersistSignal: false
    });
    expect(normalized.signalWeight).toBe(0);
  });

  it("deduplicates repeated source URLs", () => {
    const deduped = dedupeBySourceUrl([
      { sourceUrl: "https://example.com/a" },
      { sourceUrl: "https://example.com/a" }
    ]);

    expect(deduped).toHaveLength(1);
  });
});
