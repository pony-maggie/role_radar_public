import type { SourceItemClassification } from "@/lib/ai/gemini-schemas";
import type { SourceType } from "@prisma/client";

import type { ItemStrategy } from "./item-strategy";
import type { SourceClass } from "./source-types";

export type CanonicalSignalType = "ADOPTION" | "HIRING_SHIFT" | "TOOLING";
export type CanonicalSignalStrength = "LOW" | "MEDIUM" | "HIGH";
export type SignalWeightLabel = "primary" | "secondary" | "supporting";

export type NormalizedSignalClassification = {
  signalType: CanonicalSignalType;
  signalStrength: CanonicalSignalStrength;
  signalWeight: number;
  shouldPersistSignal: boolean;
};

export type SignalPolicyInput = {
  sourceClass: SourceClass;
  sourceType: SourceType;
  sourceCatalogId?: string | null;
  assignedRoleSlug: string | null;
  strategy: ItemStrategy;
  classification: Pick<
    SourceItemClassification,
    "relevance" | "signalWeight" | "sourceKind" | "signalType"
  > | null;
};

const SOURCE_CLASS_MULTIPLIER: Record<SourceClass, number> = {
  official: 1,
  media: 0.8,
  jobs: 0.6
};

const SIGNAL_WEIGHT_MULTIPLIER: Record<SignalWeightLabel, number> = {
  primary: 1,
  secondary: 0.7,
  supporting: 0.45
};

const RELEVANCE_MULTIPLIER: Record<SourceItemClassification["relevance"], number> = {
  high: 1,
  medium: 0.8,
  low: 0.55,
  none: 0
};

function isDiscoveryLaneSource(sourceCatalogId?: string | null) {
  return typeof sourceCatalogId === "string" && sourceCatalogId.startsWith("discovery-");
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function clampSignalWeight(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, roundToTwoDecimals(value)));
}

function toCanonicalSignalType(signalType: ItemStrategy["defaultSignalType"]): CanonicalSignalType {
  switch (signalType) {
    case "hiring_shift":
      return "HIRING_SHIFT";
    case "ecosystem_context":
      return "TOOLING";
    default:
      return "ADOPTION";
  }
}

function toSignalType(
  strategy: ItemStrategy,
  classification: SignalPolicyInput["classification"]
): CanonicalSignalType {
  switch (classification?.signalType) {
    case "capability_update":
    case "adoption_case":
    case "workflow_restructure":
      return "ADOPTION";
    case "hiring_shift":
      return "HIRING_SHIFT";
    case "ecosystem_context":
      return "TOOLING";
    default:
      break;
  }

  return toCanonicalSignalType(strategy.defaultSignalType);
}

function toSignalStrength(signalWeight: number): CanonicalSignalStrength {
  if (signalWeight >= 0.85) return "HIGH";
  if (signalWeight >= 0.5) return "MEDIUM";
  return "LOW";
}

function isScoreImpactEligibleClassification(input: SignalPolicyInput, signalWeight: number) {
  if (!input.assignedRoleSlug) return false;
  if (!input.classification || input.classification.sourceKind === "other") return false;
  if (input.classification.relevance === "none") return false;
  if (input.classification.signalType === "ecosystem_context") return false;
  if (input.strategy.canAffectReplacementRate === false) return false;

  switch (input.sourceClass) {
    case "jobs":
      return input.classification.signalType === "hiring_shift";
    case "official":
      return input.classification.relevance !== "low" && signalWeight >= 0.5;
    case "media":
      return input.classification.relevance === "high" && signalWeight >= 0.5;
  }
}

function shouldPersistSignal(input: SignalPolicyInput, eligibilityWeight: number) {
  return isScoreImpactEligibleClassification(input, eligibilityWeight);
}

export function normalizeSignalClassification(input: SignalPolicyInput): NormalizedSignalClassification {
  const signalType = toSignalType(input.strategy, input.classification);
  const relevance = input.classification?.relevance ?? "none";
  const weightLabel = input.classification?.signalWeight ?? "supporting";
  const baseSignalWeight = clampSignalWeight(
    SOURCE_CLASS_MULTIPLIER[input.sourceClass] *
      SIGNAL_WEIGHT_MULTIPLIER[weightLabel] *
      RELEVANCE_MULTIPLIER[relevance]
  );
  const signalWeight = clampSignalWeight(
    baseSignalWeight * (isDiscoveryLaneSource(input.sourceCatalogId) ? 0.72 : 1)
  );

  return {
    signalType,
    signalStrength: toSignalStrength(signalWeight),
    signalWeight,
    shouldPersistSignal: shouldPersistSignal(input, baseSignalWeight)
  };
}

export function normalizeStoredSignalWeight(value: number) {
  return clampSignalWeight(value);
}
