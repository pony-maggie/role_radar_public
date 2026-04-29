import type { SourceType } from "@prisma/client";
import type { SourceItemClassification } from "@/lib/ai/gemini-schemas";

import type { SourceClass } from "./source-types";

export type ItemStrategySourceClass = SourceClass | "ecosystem";
type ItemStrategyClassification = Pick<SourceItemClassification, "sourceKind" | "signalType"> | null;

export type ItemStrategy = {
  strategyId:
    | "official_capability_update"
    | "media_adoption_case"
    | "jobs_hiring_shift"
    | "broad_ecosystem_context";
  defaultSignalType:
    | "capability_update"
    | "adoption_case"
    | "workflow_restructure"
    | "hiring_shift"
    | "ecosystem_context";
  canAffectReplacementRate: boolean;
  attributionBias: "conservative" | "balanced";
};

export function deriveItemStrategy(input: {
  sourceClass: ItemStrategySourceClass;
  sourceType: SourceType;
  classification?: ItemStrategyClassification;
}): ItemStrategy {
  if (
    input.classification?.sourceKind === "other" ||
    input.classification?.signalType === "ecosystem_context"
  ) {
    return {
      strategyId: "broad_ecosystem_context",
      defaultSignalType: "ecosystem_context",
      canAffectReplacementRate: false,
      attributionBias: "conservative"
    };
  }

  if (input.sourceType === "JOB_POSTING" || input.sourceClass === "jobs") {
    return {
      strategyId: "jobs_hiring_shift",
      defaultSignalType: "hiring_shift",
      canAffectReplacementRate: true,
      attributionBias: "balanced"
    };
  }

  if (input.sourceClass === "official") {
    return {
      strategyId: "official_capability_update",
      defaultSignalType: "capability_update",
      canAffectReplacementRate: true,
      attributionBias: "balanced"
    };
  }

  if (input.sourceClass === "media") {
    return {
      strategyId: "media_adoption_case",
      defaultSignalType: "adoption_case",
      canAffectReplacementRate: true,
      attributionBias: "conservative"
    };
  }

  return {
    strategyId: "broad_ecosystem_context",
    defaultSignalType: "ecosystem_context",
    canAffectReplacementRate: false,
    attributionBias: "conservative"
  };
}
