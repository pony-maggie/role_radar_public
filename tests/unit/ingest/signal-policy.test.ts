import { describe, expect, it } from "vitest";
import { normalizeSignalClassification as normalizeSignalPolicy } from "@/lib/ingest/signal-policy";

describe("signal policy", () => {
  it("keeps discovery-lane media items eligible but downweights them", () => {
    const normalized = normalizeSignalPolicy({
      sourceClass: "media",
      sourceType: "NEWS",
      sourceCatalogId: "discovery-qbitai",
      assignedRoleSlug: "customer-service-representative",
      strategy: {
        strategyId: "media_adoption_case",
        defaultSignalType: "adoption_case",
        canAffectReplacementRate: true,
        attributionBias: "conservative"
      },
      classification: {
        sourceKind: "media",
        signalType: "workflow_restructure",
        relevance: "high",
        impactDirection: "increase",
        explanation: "Discovery-lane media item",
        summaryEn: "Discovery-lane evidence should remain eligible.",
        summaryZh: null,
        signalWeight: "secondary"
      }
    });

    expect(normalized.shouldPersistSignal).toBe(true);
    expect(normalized.signalWeight).toBeLessThan(0.7);
  });

  it("ranks primary-lane evidence ahead of discovery-lane evidence at equal relevance", () => {
    const primary = normalizeSignalPolicy({
      sourceClass: "media",
      sourceType: "NEWS",
      sourceCatalogId: "media-qbitai-ai",
      assignedRoleSlug: "customer-service-representative",
      strategy: {
        strategyId: "media_adoption_case",
        defaultSignalType: "adoption_case",
        canAffectReplacementRate: true,
        attributionBias: "conservative"
      },
      classification: {
        sourceKind: "media",
        signalType: "workflow_restructure",
        relevance: "high",
        impactDirection: "increase",
        explanation: "Primary lane media item",
        summaryEn: "Primary lane evidence should score higher.",
        summaryZh: null,
        signalWeight: "primary"
      }
    });

    const discovery = normalizeSignalPolicy({
      sourceClass: "media",
      sourceType: "NEWS",
      sourceCatalogId: "discovery-qbitai",
      assignedRoleSlug: "customer-service-representative",
      strategy: {
        strategyId: "media_adoption_case",
        defaultSignalType: "adoption_case",
        canAffectReplacementRate: true,
        attributionBias: "conservative"
      },
      classification: {
        sourceKind: "media",
        signalType: "workflow_restructure",
        relevance: "high",
        impactDirection: "increase",
        explanation: "Discovery lane media item",
        summaryEn: "Discovery lane evidence should score lower.",
        summaryZh: null,
        signalWeight: "primary"
      }
    });

    expect(primary.signalWeight).toBeGreaterThan(discovery.signalWeight);
    expect(primary.signalStrength).toBe("MEDIUM");
  });
});
