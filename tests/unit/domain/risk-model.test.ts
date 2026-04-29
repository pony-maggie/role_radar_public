import { describe, expect, it } from "vitest";
import { computeRoleRisk } from "@/lib/domain/risk-model";

describe("computeRoleRisk", () => {
  it("keeps a strong structural role in HIGH when only one medium signal arrives", () => {
    const result = computeRoleRisk({
      structural: {
        repetitionScore: 4,
        ruleClarityScore: 4,
        transformationScore: 5,
        workflowAutomationScore: 4,
        interpersonalScore: 2,
        physicalityScore: 1,
        ambiguityScore: 2
      },
      signals: [{ strength: "MEDIUM", publishedAt: new Date("2026-04-01") }]
    });

    expect(result.status).toBe("RATED");
    if (result.status !== "RATED") {
      throw new Error("Expected a rated result");
    }
    expect(result.level).toBe("HIGH");
    expect(result.trend).toBe("RISING");
  });

  it("returns insufficient signal when the structural base is weak and no strong signals exist", () => {
    const result = computeRoleRisk({
      structural: {
        repetitionScore: 2,
        ruleClarityScore: 2,
        transformationScore: 2,
        workflowAutomationScore: 2,
        interpersonalScore: 4,
        physicalityScore: 4,
        ambiguityScore: 4
      },
      signals: []
    });

    expect(result.status).toBe("INSUFFICIENT_SIGNAL");
    expect(result).toMatchObject({
      status: "INSUFFICIENT_SIGNAL",
      persistedLevel: "LOW",
      trend: "STABLE"
    });
  });
});
