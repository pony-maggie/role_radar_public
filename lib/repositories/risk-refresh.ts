import { prisma } from "@/lib/db/prisma";
import { getGeminiSettings } from "@/lib/ai/gemini-client";
import { getMiniMaxSettings } from "@/lib/ai/minimax-client";
import { scoreRoleRisk } from "@/lib/ai/score-role-risk";
import {
  buildRoleRiskInputHash,
  ROLE_RISK_PROMPT_VERSION
} from "@/lib/ai/cache-keys";
import { normalizeRoleRiskInference } from "@/lib/domain/replacement-rate";
import { inferRoleProfileFromDictionary } from "@/lib/domain/role-profile";

type ScoreRoleRiskFn = typeof scoreRoleRisk;
type SourceKind = "official" | "media" | "jobs";
type PolicySignalType = "ADOPTION" | "HIRING_SHIFT" | "TOOLING";
type StoredInferenceEvidence = {
  sourceItem: {
    title: string;
    sourceType: string;
    sourceCatalogId?: string;
    publishedAt: Date;
    summaryEn: string;
  };
  inferenceSummaryEn: string;
  impactDirection: "INCREASE" | "MAINTAIN" | "DECREASE";
  relevance: "LOW" | "MEDIUM" | "HIGH";
  signalWeight: number;
  rawJson: unknown;
};

const DEFAULT_RISK_MODEL = "gemini-2.5-flash";
export const FALLBACK_RISK_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RISK_EVIDENCE_FETCH_WINDOW = 24;
const RISK_EVIDENCE_BACKSTOP_WINDOW = 64;

function toSourceKind(sourceType: string) {
  switch (sourceType) {
    case "COMPANY_UPDATE":
    case "BLOG":
      return "official";
    case "JOB_POSTING":
      return "jobs";
    default:
      return "media";
  }
}

function toPolicySignalType(value: unknown): PolicySignalType | null {
  if (typeof value !== "string") return null;

  switch (value.trim().toUpperCase()) {
    case "ADOPTION":
    case "ADOPTION_CASE":
    case "CAPABILITY_UPDATE":
    case "WORKFLOW_RESTRUCTURE":
      return "ADOPTION";
    case "HIRING_SHIFT":
      return "HIRING_SHIFT";
    case "TOOLING":
    case "ECOSYSTEM_CONTEXT":
      return "TOOLING";
    default:
      return null;
  }
}

function getRawSignalType(rawJson: unknown) {
  if (!rawJson || typeof rawJson !== "object" || Array.isArray(rawJson)) return null;

  const candidate = rawJson as Record<string, unknown>;
  return (
    toPolicySignalType(candidate.signalType) ??
    toPolicySignalType(candidate.sourceValue) ??
    toPolicySignalType(candidate.value) ??
    toPolicySignalType(candidate.policySignalType) ??
    null
  );
}

function getRawStrategyMetadata(rawJson: unknown) {
  if (!rawJson || typeof rawJson !== "object" || Array.isArray(rawJson)) {
    return {
      canAffectReplacementRate: null
    };
  }

  const candidate = rawJson as Record<string, unknown>;
  return {
    canAffectReplacementRate:
      typeof candidate.strategyCanAffectReplacementRate === "boolean"
        ? candidate.strategyCanAffectReplacementRate
        : null
  };
}

export function inferPolicySignalType(item: StoredInferenceEvidence): PolicySignalType {
  const rawSignalType = getRawSignalType(item.rawJson);
  if (rawSignalType) return rawSignalType;
  if (item.sourceItem.sourceType === "JOB_POSTING") return "HIRING_SHIFT";
  if (item.sourceItem.sourceType === "COMPANY_UPDATE") return "ADOPTION";
  return "TOOLING";
}

function toSourceMultiplier(sourceKind: SourceKind) {
  switch (sourceKind) {
    case "official":
      return 1;
    case "jobs":
      return 0.45;
    default:
      return 0.65;
  }
}

function toSignalTypeMultiplier(signalType: PolicySignalType) {
  switch (signalType) {
    case "ADOPTION":
      return 1;
    case "HIRING_SHIFT":
      return 0.65;
    default:
      return 0.35;
  }
}

function toRelevanceMultiplier(relevance: StoredInferenceEvidence["relevance"]) {
  switch (relevance) {
    case "HIGH":
      return 1;
    case "MEDIUM":
      return 0.8;
    default:
      return 0.45;
  }
}

function toImpactMultiplier(impactDirection: StoredInferenceEvidence["impactDirection"]) {
  switch (impactDirection) {
    case "INCREASE":
      return 1;
    case "DECREASE":
      return 0.7;
    default:
      return 0.55;
  }
}

function isDiscoveryLaneSource(sourceCatalogId: string) {
  return sourceCatalogId.startsWith("discovery-");
}

function roundWeight(value: number) {
  return Math.round(value * 100) / 100;
}

function shouldIncludeEvidence(item: StoredInferenceEvidence, sourceKind: SourceKind, signalType: PolicySignalType) {
  const strategy = getRawStrategyMetadata(item.rawJson);
  if (strategy.canAffectReplacementRate === false) return false;
  if (sourceKind === "media" && signalType === "TOOLING") return false;
  if (sourceKind === "jobs" && signalType !== "HIRING_SHIFT") return false;
  if (sourceKind === "jobs" && signalType === "HIRING_SHIFT" && item.signalWeight < 0.3) return false;
  if (sourceKind === "media" && item.relevance === "MEDIUM" && item.signalWeight < 0.6) return false;
  if (item.relevance === "LOW" && sourceKind !== "official") return false;
  if (item.impactDirection === "MAINTAIN" && signalType === "TOOLING") return false;
  return true;
}

export function prepareEvidenceForRiskScoring(items: StoredInferenceEvidence[]) {
  return items
    .map((item) => {
      const sourceKind = toSourceKind(item.sourceItem.sourceType);
      const signalType = inferPolicySignalType(item);
      const isDiscoveryLane = Boolean(
        sourceKind === "media" &&
          item.sourceItem.sourceCatalogId &&
          isDiscoveryLaneSource(item.sourceItem.sourceCatalogId)
      );
      const minimumAdjustedWeight = isDiscoveryLane
        ? 0.2
        : sourceKind === "official"
          ? 0.25
          : sourceKind === "jobs"
            ? 0.28
            : item.relevance === "MEDIUM"
              ? 0.3
              : 0.4;
      const adjustedWeight = roundWeight(
        item.signalWeight *
          (item.sourceItem.sourceCatalogId && isDiscoveryLaneSource(item.sourceItem.sourceCatalogId)
            ? 0.75
            : 1) *
          toSourceMultiplier(sourceKind) *
          toSignalTypeMultiplier(signalType) *
          toRelevanceMultiplier(item.relevance) *
          toImpactMultiplier(item.impactDirection)
      );

      return {
        title: item.sourceItem.title,
        sourceType: sourceKind,
        signalType,
        publishedAt: item.sourceItem.publishedAt.toISOString().slice(0, 10),
        summaryEn: item.sourceItem.summaryEn,
        inferenceSummaryEn: item.inferenceSummaryEn,
        impactDirection: item.impactDirection,
        relevance: item.relevance,
        signalWeight: adjustedWeight,
        include:
          shouldIncludeEvidence(item, sourceKind, signalType) &&
          adjustedWeight >= minimumAdjustedWeight
      };
    })
    .filter((item) => item.include)
    .sort((left, right) => {
      if (right.signalWeight !== left.signalWeight) return right.signalWeight - left.signalWeight;
      const publishedAtDelta = right.publishedAt.localeCompare(left.publishedAt);
      if (publishedAtDelta !== 0) return publishedAtDelta;
      return left.title.localeCompare(right.title);
    })
    .slice(0, 8)
    .map(({ include: _include, ...item }) => item);
}

function getPreferredRiskModelName(env: NodeJS.ProcessEnv = process.env) {
  const gemini = getGeminiSettings(env);
  if (gemini.enabled && gemini.apiKey) {
    return gemini.model;
  }

  const minimax = getMiniMaxSettings(env);
  if (minimax.enabled && minimax.apiKey) {
    return minimax.model;
  }

  return env.GEMINI_MODEL || DEFAULT_RISK_MODEL;
}

function shouldReuseFallbackRiskCache(role: {
  riskModelProvider: string | null;
  riskModelName: string | null;
  riskCachedAt: Date | null;
}, now = Date.now()) {
  if (!role.riskModelName) return false;
  if (role.riskModelProvider !== "minimax" && role.riskModelProvider !== "fallback") {
    return false;
  }
  if (!role.riskCachedAt || Number.isNaN(role.riskCachedAt.getTime())) {
    return false;
  }

  return now - role.riskCachedAt.getTime() <= FALLBACK_RISK_CACHE_TTL_MS;
}

function getRiskCacheModelName(role: {
  riskModelProvider: string | null;
  riskModelName: string | null;
  riskCachedAt: Date | null;
}) {
  if (shouldReuseFallbackRiskCache(role)) {
    return role.riskModelName!;
  }

  return getPreferredRiskModelName();
}

export async function loadRoleRiskEvidenceCandidates(roleSlug: string) {
  const recentSourceItemInferences = await prisma.sourceItemInference.findMany({
    where: {
      assignedRoleSlug: roleSlug
    },
    include: {
      sourceItem: true
    },
    orderBy: {
      sourceItem: {
        publishedAt: "desc"
      }
    },
    take: RISK_EVIDENCE_FETCH_WINDOW
  });

  const backstopSourceItemInferences = await prisma.sourceItemInference.findMany({
    where: {
      assignedRoleSlug: roleSlug,
      NOT: {
        sourceItem: {
          sourceCatalogId: {
            startsWith: "discovery-"
          }
        }
      }
    },
    include: {
      sourceItem: true
    },
    orderBy: {
      sourceItem: {
        publishedAt: "desc"
      }
    },
    take: RISK_EVIDENCE_BACKSTOP_WINDOW
  });

  return [...recentSourceItemInferences, ...backstopSourceItemInferences].filter(
    (item, index, items) =>
      index === items.findIndex((candidate) => candidate.sourceItemId === item.sourceItemId)
  );
}

export async function refreshRoleRisk(roleSlug: string, scoreFn: ScoreRoleRiskFn = scoreRoleRisk) {
  const role = await prisma.role.findUnique({
    where: { slug: roleSlug },
    include: { dictionaryRole: true }
  });

  if (!role) {
    throw new Error(`Unknown role: ${roleSlug}`);
  }

  const sourceItemInferences = await loadRoleRiskEvidenceCandidates(roleSlug);
  const preparedEvidence = prepareEvidenceForRiskScoring(sourceItemInferences);
  const modelName = getRiskCacheModelName(role);
  const roleRiskContext = {
    slug: role.slug,
    nameEn: role.nameEn,
    nameZh: role.nameZh,
    summaryEn: role.summaryEn,
    summaryZh: role.summaryZh,
    keywords:
      role.dictionaryRole && Array.isArray(role.dictionaryRole.keywords)
        ? role.dictionaryRole.keywords.filter((value): value is string => typeof value === "string")
        : [],
    repetitionScore: role.repetitionScore,
    ruleClarityScore: role.ruleClarityScore,
    transformationScore: role.transformationScore,
    workflowAutomationScore: role.workflowAutomationScore,
    interpersonalScore: role.interpersonalScore,
    physicalityScore: role.physicalityScore,
    ambiguityScore: role.ambiguityScore
  };
  const riskInputHash = buildRoleRiskInputHash({
    role: roleRiskContext,
    evidence: preparedEvidence,
    promptVersion: ROLE_RISK_PROMPT_VERSION,
    modelName
  });

  if (
    role.riskInputHash === riskInputHash &&
    role.riskPromptVersion === ROLE_RISK_PROMPT_VERSION &&
    role.riskModelName === modelName
  ) {
    return role;
  }

  let normalized;
  let persistedProvider = "fallback";
  let persistedModelName = "role-profile";
  try {
    const inference = await scoreFn(roleRiskContext, preparedEvidence);
    normalized = normalizeRoleRiskInference(inference.data);
    persistedProvider = inference.provider;
    persistedModelName = inference.model;
  } catch {
    const fallback = inferRoleProfileFromDictionary(
      {
        slug: role.slug,
        nameEn: role.nameEn,
        nameZh: role.nameZh,
        keywords:
          role.dictionaryRole && Array.isArray(role.dictionaryRole.keywords)
            ? role.dictionaryRole.keywords.filter((value): value is string => typeof value === "string")
            : []
      },
      sourceItemInferences.length
    );
    normalized = {
      replacementRate: fallback.replacementRate,
      riskLevel: fallback.riskLevel,
      summaryEn: fallback.summaryEn,
      summaryZh: fallback.summaryZh,
      reasons: fallback.reasons,
      raw: {
        fallback: true,
        sourceCount: sourceItemInferences.length,
        preparedEvidenceCount: preparedEvidence.length
      }
    };
  }

  return prisma.role.update({
    where: { id: role.id },
    data: {
      replacementRate: normalized.replacementRate,
      riskLevel: normalized.riskLevel,
      riskSummaryEn: normalized.summaryEn,
      riskSummaryZh: normalized.summaryZh,
      riskReasons: normalized.reasons,
      riskModelProvider: persistedProvider,
      riskModelName: persistedModelName,
      riskInputHash,
      riskPromptVersion: ROLE_RISK_PROMPT_VERSION,
      riskCachedAt: new Date(),
      riskInferenceRaw: normalized.raw,
      ratingStatus: "RATED",
      lastRatedAt: new Date()
    }
  });
}
