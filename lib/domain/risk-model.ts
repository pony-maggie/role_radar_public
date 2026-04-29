import type { RiskInput, RiskResult } from "./risk-types";

export function computeRoleRisk(input: RiskInput): RiskResult {
  const baseScore =
    input.structural.repetitionScore +
    input.structural.ruleClarityScore +
    input.structural.transformationScore +
    input.structural.workflowAutomationScore -
    input.structural.interpersonalScore -
    input.structural.physicalityScore -
    input.structural.ambiguityScore;

  const signalBoost = input.signals.reduce((total, signal) => {
    if (signal.strength === "HIGH") return total + 2;
    if (signal.strength === "MEDIUM") return total + 1;
    return total;
  }, 0);

  const total = baseScore + signalBoost;

  if (total < 2 && input.signals.length === 0) {
    return { status: "INSUFFICIENT_SIGNAL", persistedLevel: "LOW", trend: "STABLE" };
  }

  if (total >= 14) return { status: "RATED", level: "SEVERE", trend: "RISING" };
  if (total >= 7) return { status: "RATED", level: "HIGH", trend: signalBoost > 0 ? "RISING" : "STABLE" };
  if (total >= 4) return { status: "RATED", level: "MEDIUM", trend: signalBoost > 0 ? "RISING" : "STABLE" };
  return { status: "RATED", level: "LOW", trend: "STABLE" };
}
