import { describe, expect, it } from "vitest";
import {
  clampReplacementRate,
  deriveRiskLevelFromReplacementRate,
  normalizeRoleRiskInference
} from "@/lib/domain/replacement-rate";

describe("replacement-rate domain helpers", () => {
  it("clamps the stored percentage to a bounded product range", () => {
    expect(clampReplacementRate(-5)).toBe(5);
    expect(clampReplacementRate(63.6)).toBe(64);
    expect(clampReplacementRate(120)).toBe(95);
  });

  it("derives consistent risk bands from the bounded percentage", () => {
    expect(deriveRiskLevelFromReplacementRate(18)).toBe("LOW");
    expect(deriveRiskLevelFromReplacementRate(43)).toBe("MEDIUM");
    expect(deriveRiskLevelFromReplacementRate(68)).toBe("HIGH");
    expect(deriveRiskLevelFromReplacementRate(86)).toBe("SEVERE");
  });

  it("normalizes zh fallbacks and structured reasons", () => {
    const normalized = normalizeRoleRiskInference({
      replacementRate: 82,
      riskBand: "severe",
      summaryEn: "AI-first systems can absorb a large share of this workflow.",
      summaryZh: null,
      reasons: [
        {
          kind: "official",
          titleEn: "Official deployments are scaling",
          titleZh: null,
          detailEn: "Multiple company updates show AI-led workflows in production.",
          detailZh: null
        }
      ]
    });

    expect(normalized).toMatchObject({
      replacementRate: 82,
      riskLevel: "SEVERE",
      summaryZh: "AI-first systems can absorb a large share of this workflow."
    });
    expect(normalized.reasons[0]).toMatchObject({
      titleZh: "Official deployments are scaling",
      detailZh: "Multiple company updates show AI-led workflows in production."
    });
  });
});
