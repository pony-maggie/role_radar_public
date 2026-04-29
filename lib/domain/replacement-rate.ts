import type { RiskLevel } from "@prisma/client";
import type { RoleRiskInference, RoleRiskReason } from "@/lib/ai/gemini-schemas";

export const MIN_REPLACEMENT_RATE = 5;
export const MAX_REPLACEMENT_RATE = 95;

export function clampReplacementRate(value: number) {
  return Math.min(MAX_REPLACEMENT_RATE, Math.max(MIN_REPLACEMENT_RATE, Math.round(value)));
}

export function deriveRiskLevelFromReplacementRate(value: number): RiskLevel {
  if (value >= 80) return "SEVERE";
  if (value >= 55) return "HIGH";
  if (value >= 30) return "MEDIUM";
  return "LOW";
}

export function normalizeRiskReasons(reasons: RoleRiskReason[]) {
  return reasons.map((reason) => ({
    kind: reason.kind,
    titleEn: reason.titleEn,
    titleZh: reason.titleZh ?? reason.titleEn,
    detailEn: reason.detailEn,
    detailZh: reason.detailZh ?? reason.detailEn
  }));
}

export function normalizeRoleRiskInference(inference: RoleRiskInference) {
  const replacementRate = clampReplacementRate(inference.replacementRate);

  return {
    replacementRate,
    riskLevel: deriveRiskLevelFromReplacementRate(replacementRate),
    summaryEn: inference.summaryEn,
    summaryZh: inference.summaryZh ?? inference.summaryEn,
    reasons: normalizeRiskReasons(inference.reasons),
    raw: inference
  };
}
