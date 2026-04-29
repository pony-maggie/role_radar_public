import { describe, expect, it } from "vitest";
import { mapSourceItemToRoleDecision } from "@/lib/ingest/map-source-item";

describe("mapSourceItemToRoleDecision", () => {
  it("accepts a unique high-confidence support match", () => {
    const decision = mapSourceItemToRoleDecision({
      title: "AI triage helps customer support teams deflect ticket volume",
      summary: "Support agents and help desk operators are automating ticket routing."
    });

    expect(decision).toMatchObject({
      status: "accepted",
      primaryRoleSlug: "customer-service-representative",
      reason: "Unique high-confidence candidate",
      confidence: "high",
      candidateSlugs: ["customer-service-representative"],
      matchedKeywords: expect.arrayContaining(["triage"])
    });
  });

  it("marks weak or competing signals as ambiguous", () => {
    const decision = mapSourceItemToRoleDecision({
      title: "Support and accounting operations both test AI copilots",
      summary: "Help desk routing and invoice review both change in the same workflow rollout."
    });

    expect(decision.status).toBe("ambiguous");
    expect(decision.primaryRoleSlug).toBeNull();
    expect(decision.candidates.length).toBeGreaterThan(0);
    expect(decision.candidateSlugs.length).toBeGreaterThan(1);
    expect(decision.matchedKeywords.length).toBeGreaterThan(1);
  });

  it("marks unrelated stories as unmatched", () => {
    const decision = mapSourceItemToRoleDecision({
      title: "AI chip spending rises across cloud infrastructure",
      summary: "Investors expect more data-center hardware demand."
    });

    expect(decision).toMatchObject({
      status: "unmatched",
      primaryRoleSlug: null,
      reason: "No role keywords matched",
      confidence: null,
      candidateSlugs: [],
      matchedKeywords: []
    });
  });
});
