import { DEFAULT_GEMINI_MODEL, generateStructuredJson } from "./gemini-client";
import { getMiniMaxSettings } from "./minimax-client";
import {
  sourceItemClassificationSchema,
  type SourceItemClassification
} from "./gemini-schemas";
import type { StructuredGenerationResult } from "./provider-types";
import { buildSourceItemClassificationPrompt } from "./prompts/classify-source-item";
import { ROLE_ALIASES } from "@/lib/ingest/role-aliases";
import { selectRoleCandidates } from "@/lib/ingest/select-role-candidates";
import {
  buildSourceClassificationInputHash,
  SOURCE_ITEM_PROMPT_VERSION
} from "./cache-keys";
import { generateStructuredJsonForTask } from "./task-routing";

type RoleContext = {
  slug: string;
  nameEn: string;
  nameZh: string;
  keywords: string[];
};

type SourceItemContext = {
  sourceCatalogId?: string;
  sourceUrl?: string;
  sourceLabel: string;
  sourceType: string;
  title: string;
  summary: string;
  topicHints?: string[];
};

type StoredClassificationCache = {
  classificationInputHash: string | null;
  classificationPromptVersion: string | null;
  classificationModelName: string | null;
  inference: {
    modelProvider: string;
    modelName: string;
    assignedRoleSlug: string;
    impactDirection: "INCREASE" | "MAINTAIN" | "DECREASE";
    relevance: "LOW" | "MEDIUM" | "HIGH";
    inferenceSummaryEn: string;
    inferenceSummaryZh: string;
    signalWeight: number;
    rawJson: unknown;
  } | null;
  decisions: Array<{
    decisionStatus: "ACCEPTED" | "AMBIGUOUS" | "UNMATCHED";
    reason: string;
  }>;
};

type SourceClassificationContext = {
  candidates: ReturnType<typeof selectRoleCandidates>;
  inputHash: string;
  inputHashes: string[];
  modelName: string;
  modelNames: string[];
  promptVersion: string;
};

type ClassifySourceItemOptions = {
  cachedEntry?: StoredClassificationCache | null;
  context?: SourceClassificationContext;
  modelName?: string;
};

type SourceItemClassificationResult = SourceItemClassification & {
  modelProvider: string | null;
  modelName: string | null;
};

export type ClassifiedSourceItem = SourceItemClassificationResult;

export function buildSourceClassificationCacheModelName(provider: string, model: string) {
  return `${provider}:${model}`;
}

const BROAD_ECOSYSTEM_TERMS = /\b(funding|fundraise|raised|valuation|benchmark|model launch|model family|ecosystem|partnership|policy|regulation|infrastructure|infra|gpu|data center|sponsorship|sponsor|brand|community program|awards?|summit|conference)\b/i;
const CONCRETE_WORKFLOW_TERMS = /\b(workflow|task|tasks|review|triage|reconciliation|coding|operations|ticket|invoice|analysis|release|response|close)\b/i;

function hasBroadEcosystemNoise(sourceItem: SourceItemContext) {
  return BROAD_ECOSYSTEM_TERMS.test(`${sourceItem.title} ${sourceItem.summary}`);
}

function hasConcreteWorkflowLanguage(sourceItem: SourceItemContext) {
  return CONCRETE_WORKFLOW_TERMS.test(`${sourceItem.title} ${sourceItem.summary}`);
}

function getSourceClassificationCacheModelNames(
  primaryModelName: string,
  env: NodeJS.ProcessEnv = process.env
) {
  const modelNames = new Set<string>([
    primaryModelName,
    buildSourceClassificationCacheModelName("gemini", primaryModelName)
  ]);
  const minimax = getMiniMaxSettings(env);
  if (minimax.enabled && minimax.apiKey) {
    modelNames.add(buildSourceClassificationCacheModelName("minimax", minimax.model));
  }

  return [...modelNames];
}

function shouldPromoteTopCandidate(
  sourceItem: SourceItemContext,
  parsed: SourceItemClassification,
  topCandidate: SourceClassificationContext["candidates"][number] | undefined
) {
  if (!topCandidate) return false;
  if (parsed.assignedRoleSlug) return false;

  const normalizedHints = new Set(
    (sourceItem.topicHints ?? []).map((hint) => hint.trim().toLowerCase()).filter(Boolean)
  );
  const hasHintBackedMatch = topCandidate.matchedKeywords.some((keyword) =>
    normalizedHints.has(keyword.trim().toLowerCase())
  );
  const hasBroadEcosystemAngle = hasBroadEcosystemNoise(sourceItem);
  const hasConcreteWorkflowAngle = hasConcreteWorkflowLanguage(sourceItem);
  const allowsEasierTimelineAttachment =
    sourceItem.sourceType === "COMPANY_UPDATE" ||
    sourceItem.sourceType === "BLOG" ||
    sourceItem.sourceType === "JOB_POSTING";

  if (hasBroadEcosystemAngle && !hasConcreteWorkflowAngle) {
    return false;
  }

  if (!hasConcreteWorkflowAngle) {
    return false;
  }

  const hasAliasBackedCandidate = Boolean(ROLE_ALIASES[topCandidate.slug]);
  const hasSingleKeywordOverlap = topCandidate.matchedKeywords.length >= 1;
  const hasConcreteKeywordOverlap = topCandidate.matchedKeywords.length >= 2;
  const hasStrongSingleWorkflowMatch =
    hasConcreteWorkflowAngle &&
    topCandidate.matchedKeywords.length >= 1 &&
    topCandidate.score >= (allowsEasierTimelineAttachment ? 6 : 9);
  const hasBroadAdjacentWorkflowMatch =
    hasConcreteWorkflowAngle &&
    hasSingleKeywordOverlap &&
    topCandidate.score >= (allowsEasierTimelineAttachment ? 3.5 : 5.5);

  if (hasAliasBackedCandidate) {
    return (
      (hasHintBackedMatch && topCandidate.score >= 3) ||
      hasConcreteKeywordOverlap ||
      hasStrongSingleWorkflowMatch
    );
  }

  return (
    hasBroadAdjacentWorkflowMatch ||
    (hasHintBackedMatch && topCandidate.score >= (allowsEasierTimelineAttachment ? 4 : 5)) ||
    hasConcreteKeywordOverlap
  );
}

function promoteTopCandidateFallback(
  sourceItem: SourceItemContext,
  parsed: SourceItemClassificationResult,
  topCandidate: SourceClassificationContext["candidates"][number] | undefined
): SourceItemClassificationResult {
  if (!shouldPromoteTopCandidate(sourceItem, parsed, topCandidate) || !topCandidate) {
    return parsed;
  }

  return {
    ...parsed,
    assignedRoleSlug: topCandidate.slug,
    relevance: parsed.relevance === "none" ? "low" : parsed.relevance,
    explanation: `${parsed.explanation} The item was attached to the closest matching role candidate (${topCandidate.slug}) because Role Radar allows broader, adjacent-role linkage when keyword overlap is concrete.`,
    summaryEn: parsed.summaryEn,
    summaryZh: parsed.summaryZh ?? null
  };
}

function buildClassifierErrorFallback(
  sourceItem: SourceItemContext,
  message: string,
  topCandidate: SourceClassificationContext["candidates"][number] | undefined
): SourceItemClassificationResult {
  const fallback: SourceItemClassificationResult = {
    assignedRoleSlug: null,
    sourceKind: inferSourceKind(sourceItem.sourceType),
    signalType: "ecosystem_context",
    relevance: "none",
    impactDirection: "neutral",
    explanation: `Classification fallback used because Gemini was unavailable or returned an error: ${message}`,
    summaryEn:
      "The source was fetched successfully, but model classification was temporarily unavailable, so the item was handled with a broader fallback.",
    summaryZh: "来源已抓取成功，但模型分类暂时不可用，因此该条目使用了更宽松的回退处理。",
    signalWeight: "supporting",
    modelProvider: "fallback",
    modelName: "classification-fallback"
  };

  if (!shouldPromoteTopCandidate(sourceItem, fallback, topCandidate) || !topCandidate) {
    return fallback;
  }

  return {
    ...fallback,
    assignedRoleSlug: topCandidate.slug,
    relevance: "low",
    explanation: `${fallback.explanation} The item was attached to the closest matching role candidate (${topCandidate.slug}) because Role Radar allows broader timeline linkage when the model is unavailable but keyword overlap is concrete.`,
    summaryEn:
      "The source was attached to the closest matching role candidate while Gemini was unavailable, so it can still appear in the role timeline.",
    summaryZh: "由于 Gemini 暂时不可用，该来源被挂到最接近的岗位上，以便先出现在岗位时间线中。"
  };
}

function inferSourceKind(sourceType: string) {
  switch (sourceType) {
    case "COMPANY_UPDATE":
    case "BLOG":
      return "official" as const;
    case "JOB_POSTING":
      return "jobs" as const;
    default:
      return "media" as const;
  }
}

function normalizeCachedClassification(
  sourceType: string,
  cachedEntry: NonNullable<StoredClassificationCache>
): SourceItemClassificationResult | null {
  const parsed = sourceItemClassificationSchema.safeParse(cachedEntry.inference?.rawJson);
  if (parsed.success) {
    return {
      ...parsed.data,
      modelProvider: cachedEntry.inference?.modelProvider ?? null,
      modelName: cachedEntry.inference?.modelName ?? null
    };
  }

  const inference = cachedEntry.inference;
  const decision = cachedEntry.decisions[0];
  if (!inference || !decision) {
    return null;
  }

  const assignedRoleSlug =
    decision.decisionStatus === "UNMATCHED" || inference.assignedRoleSlug === "unmapped"
      ? null
      : inference.assignedRoleSlug;

  return {
    assignedRoleSlug,
    sourceKind: inferSourceKind(sourceType),
    signalType: "ecosystem_context",
    relevance:
      inference.relevance === "HIGH"
        ? "high"
        : inference.relevance === "MEDIUM"
          ? "medium"
          : assignedRoleSlug
            ? "low"
            : "none",
    impactDirection:
      inference.impactDirection === "INCREASE"
        ? "increase"
        : inference.impactDirection === "DECREASE"
          ? "decrease"
          : "neutral",
    explanation: decision.reason,
    summaryEn: inference.inferenceSummaryEn,
    summaryZh: inference.inferenceSummaryZh || null,
    signalWeight:
      inference.signalWeight >= 0.75 ? "primary" : inference.signalWeight >= 0.45 ? "secondary" : "supporting",
    modelProvider: inference.modelProvider,
    modelName: inference.modelName
  };
}

function normalizeGeneratedClassification(
  result: Awaited<ReturnType<typeof generateStructuredJson>> | SourceItemClassification
): SourceItemClassificationResult {
  if (
    result &&
    typeof result === "object" &&
    "data" in result &&
    "provider" in result &&
    "model" in result
  ) {
    const structured = result as StructuredGenerationResult<SourceItemClassification>;
    return {
      ...sourceItemClassificationSchema.parse(structured.data),
      modelProvider: structured.provider,
      modelName: structured.model
    };
  }

  return {
    ...sourceItemClassificationSchema.parse(result),
    modelProvider: null,
    modelName: null
  };
}

export function buildSourceClassificationContext(
  sourceItem: SourceItemContext,
  roles: RoleContext[],
  modelName = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
  env: NodeJS.ProcessEnv = process.env
): SourceClassificationContext {
  const candidates = selectRoleCandidates(sourceItem, roles);
  const modelNames = getSourceClassificationCacheModelNames(modelName, env);
  const buildInputHash = (cacheModelName: string) =>
    buildSourceClassificationInputHash({
      sourceCatalogId: sourceItem.sourceCatalogId ?? sourceItem.sourceLabel,
      sourceUrl: sourceItem.sourceUrl ?? sourceItem.title,
      sourceType: sourceItem.sourceType,
      title: sourceItem.title,
      summaryEn: sourceItem.summary,
      topicHints: sourceItem.topicHints ?? [],
      candidateSlugs: candidates.map((candidate) => candidate.slug),
      promptVersion: SOURCE_ITEM_PROMPT_VERSION,
      modelName: cacheModelName
    });
  const inputHashes = modelNames.map(buildInputHash);

  return {
    candidates,
    inputHash: inputHashes[0]!,
    inputHashes,
    modelName,
    modelNames,
    promptVersion: SOURCE_ITEM_PROMPT_VERSION
  };
}

export function hasUsableSourceClassificationCache(
  cachedEntry: StoredClassificationCache | null | undefined,
  context: SourceClassificationContext
) {
  return Boolean(
    cachedEntry &&
      context.inputHashes.includes(cachedEntry.classificationInputHash ?? "") &&
      cachedEntry.classificationPromptVersion === context.promptVersion &&
      context.modelNames.includes(cachedEntry.classificationModelName ?? "") &&
      cachedEntry.inference &&
      cachedEntry.decisions.length > 0
  );
}

export async function classifySourceItem(
  sourceItem: SourceItemContext,
  roles: RoleContext[],
  structuredJsonGenerator: typeof generateStructuredJson = generateStructuredJson,
  options: ClassifySourceItemOptions = {}
): Promise<ClassifiedSourceItem> {
  const context =
    options.context ?? buildSourceClassificationContext(sourceItem, roles, options.modelName);
  const { candidates, inputHash, modelName, promptVersion } = context;

  if (candidates.length === 0) {
    return {
      assignedRoleSlug: null,
      sourceKind: inferSourceKind(sourceItem.sourceType),
      signalType: "ecosystem_context",
      relevance: "none",
      impactDirection: "neutral",
      explanation:
        "No role candidate matched the source title and summary strongly enough, so the item stays unmatched.",
      summaryEn:
        "The source item is too broad or indirect to attach to one occupation with high precision.",
      summaryZh: null,
      signalWeight: "supporting",
      modelProvider: null,
      modelName: null
    };
  }

  const cachedEntry = options.cachedEntry;
  if (cachedEntry && hasUsableSourceClassificationCache(cachedEntry, context)) {
    const cachedClassification = normalizeCachedClassification(sourceItem.sourceType, cachedEntry);
    if (cachedClassification) {
      return cachedClassification;
    }
  }

  const prompt = buildSourceItemClassificationPrompt({
    sourceItem,
    roles: candidates
  });

  let rawGeneration: Awaited<ReturnType<typeof generateStructuredJson>> | SourceItemClassification;
  try {
    const generatorArgs = {
      prompt,
      schema: sourceItemClassificationSchema,
      systemInstruction:
        "Return only structured JSON. Choose the single best-fit role from the provided candidates or null only when the item is clearly too broad, speculative, or unrelated to the candidate roles."
    } as const;

    rawGeneration =
      structuredJsonGenerator === generateStructuredJson
        ? await generateStructuredJsonForTask({
            task: "source_classification",
            ...generatorArgs
          })
        : await structuredJsonGenerator(generatorArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildClassifierErrorFallback(sourceItem, message, candidates[0]);
  }

  const generation = normalizeGeneratedClassification(rawGeneration);

  if (!generation.assignedRoleSlug) {
    return promoteTopCandidateFallback(sourceItem, generation, candidates[0]);
  }

  const validCandidateSlugs = new Set(candidates.map((candidate) => candidate.slug));
  if (validCandidateSlugs.has(generation.assignedRoleSlug)) {
    return generation;
  }

  return {
    assignedRoleSlug: null,
    sourceKind: generation.sourceKind,
    signalType: "ecosystem_context",
    relevance: "none",
    impactDirection: "neutral",
    explanation: `The model returned a role slug outside the allowed candidate set (${generation.assignedRoleSlug}), so the item was kept unmatched.`,
    summaryEn:
      "The source item could not be attached to one of the allowed occupation candidates with enough confidence.",
    summaryZh: null,
    signalWeight: "supporting",
    modelProvider: generation.modelProvider,
    modelName: generation.modelName
  } satisfies SourceItemClassificationResult;
}
