import type { RawSourceItem } from "./adapter";
import type { SourceItemClassification } from "@/lib/ai/gemini-schemas";
import type { SourceClass } from "./source-types";
import { deriveItemStrategy } from "./item-strategy";
import {
  normalizeSignalClassification as normalizeSignalClassificationImpl,
  type NormalizedSignalClassification
} from "./signal-policy";

function inferSourceClass(sourceType: string): SourceClass {
  if (sourceType === "JOB_POSTING") return "jobs";
  if (sourceType === "COMPANY_UPDATE" || sourceType === "BLOG") return "official";
  return "media";
}

function classifyLegacyStrength(
  item: Pick<RawSourceItem, "sourceType" | "title"> & {
    signalType: "ADOPTION" | "HIRING_SHIFT" | "TOOLING";
  }
) {
  if (item.sourceType === "COMPANY_UPDATE" && item.signalType === "ADOPTION") return "HIGH";
  if (item.sourceType === "JOB_POSTING") return "MEDIUM";
  return "LOW";
}

export function classifySignalStrength(
  item: Pick<RawSourceItem, "sourceType" | "title"> & {
    signalType: "ADOPTION" | "HIRING_SHIFT" | "TOOLING";
    sourceClass?: SourceClass;
    classification?: Pick<
      SourceItemClassification,
      "relevance" | "signalWeight" | "sourceKind" | "signalType"
    > | null;
  }
) {
  if (!item.classification) {
    return classifyLegacyStrength(item);
  }

  const normalized = normalizeSignalClassificationImpl({
    sourceClass: item.sourceClass ?? inferSourceClass(item.sourceType),
    sourceType: item.sourceType,
    assignedRoleSlug: null,
    strategy: deriveItemStrategy({
      sourceClass: item.sourceClass ?? inferSourceClass(item.sourceType),
      sourceType: item.sourceType,
      classification: item.classification ?? null
    }),
    classification: {
      ...item.classification,
      signalType: item.classification.signalType ?? "ecosystem_context"
    }
  });

  return normalized.signalStrength;
}

export function normalizeSignalPolicy(
  input: Parameters<typeof normalizeSignalClassificationImpl>[0]
): NormalizedSignalClassification {
  return normalizeSignalClassificationImpl(input);
}

export { normalizeSignalClassificationImpl as normalizeSignalClassification };

export function dedupeBySourceUrl<T extends { sourceUrl: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.sourceUrl, item])).values()];
}
