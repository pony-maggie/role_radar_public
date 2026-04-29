import { createHash } from "node:crypto";

export const SOURCE_ITEM_PROMPT_VERSION = "2026-04-16-v7";
export const ROLE_RISK_PROMPT_VERSION = "2026-04-16-v2";

type SourceClassificationHashInput = {
  sourceCatalogId: string;
  sourceUrl: string;
  sourceType: string;
  title: string;
  summaryEn: string;
  topicHints: string[];
  candidateSlugs: string[];
  promptVersion: string;
  modelName: string;
};

type RoleRiskHashInput = {
  role: {
    slug: string;
    nameEn: string;
    nameZh: string;
    summaryEn: string;
    summaryZh: string;
    keywords?: string[];
    repetitionScore: number;
    ruleClarityScore: number;
    transformationScore: number;
    workflowAutomationScore: number;
    interpersonalScore: number;
    physicalityScore: number;
    ambiguityScore: number;
  };
  evidence: Array<{
    title: string;
    sourceType: string;
    signalType: string;
    publishedAt: string;
    summaryEn: string;
    inferenceSummaryEn: string;
    impactDirection: string;
    relevance: string;
    signalWeight: number;
  }>;
  promptVersion: string;
  modelName: string;
};

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function buildSourceClassificationInputHash(input: SourceClassificationHashInput) {
  return stableHash({
    sourceCatalogId: input.sourceCatalogId,
    sourceUrl: input.sourceUrl,
    sourceType: input.sourceType,
    title: normalizeText(input.title),
    summaryEn: normalizeText(input.summaryEn),
    topicHints: input.topicHints.map((hint) => normalizeText(hint)),
    candidateSlugs: [...input.candidateSlugs],
    promptVersion: input.promptVersion,
    modelName: input.modelName
  });
}

export function buildRoleRiskInputHash(input: RoleRiskHashInput) {
  return stableHash({
    role: {
      slug: input.role.slug,
      nameEn: input.role.nameEn,
      nameZh: input.role.nameZh,
      summaryEn: normalizeText(input.role.summaryEn),
      summaryZh: normalizeText(input.role.summaryZh),
      keywords: [...(input.role.keywords ?? [])],
      repetitionScore: input.role.repetitionScore,
      ruleClarityScore: input.role.ruleClarityScore,
      transformationScore: input.role.transformationScore,
      workflowAutomationScore: input.role.workflowAutomationScore,
      interpersonalScore: input.role.interpersonalScore,
      physicalityScore: input.role.physicalityScore,
      ambiguityScore: input.role.ambiguityScore
    },
    evidence: input.evidence.map((item) => ({
      title: normalizeText(item.title),
      sourceType: item.sourceType,
      signalType: item.signalType,
      publishedAt: item.publishedAt,
      summaryEn: normalizeText(item.summaryEn),
      inferenceSummaryEn: normalizeText(item.inferenceSummaryEn),
      impactDirection: item.impactDirection,
      relevance: item.relevance,
      signalWeight: item.signalWeight
    })),
    promptVersion: input.promptVersion,
    modelName: input.modelName
  });
}
