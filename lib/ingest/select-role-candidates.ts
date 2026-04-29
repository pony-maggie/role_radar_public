import { ROLE_ALIASES } from "./role-aliases";

type RoleContext = {
  slug: string;
  nameEn: string;
  nameZh: string;
  keywords: string[];
};

type SourceItemContext = {
  sourceLabel: string;
  sourceType: string;
  title: string;
  summary: string;
  topicHints?: string[];
};

export type RoleCandidate = {
  slug: string;
  nameEn: string;
  nameZh: string;
  keywords: string[];
  matchedKeywords: string[];
  score: number;
};

const DEFAULT_MAX_CANDIDATES = 20;
const GENERAL_CANDIDATE_SCORE = 1;
const BROAD_TIMELINE_CANDIDATE_SCORE = 0.5;
const JOB_CANDIDATE_SCORE = 1.5;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with"
]);

const EXCLUDED_ROLE_SLUGS = new Set(["ai", "models"]);
const BROAD_ECOSYSTEM_TERMS = /\b(funding|fundraise|raised|valuation|benchmark|model launch|model family|ecosystem|partnership|policy|regulation|infrastructure|infra|gpu|data center|sponsorship|sponsor|brand|community program|awards?|summit|conference)\b/i;
const CONCRETE_WORKFLOW_TERMS = /\b(workflow|task|tasks|review|triage|reconciliation|coding|operations|ticket|invoice|analysis|release|response|close)\b/i;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function dedupe(values: string[]) {
  return [...new Set(values)];
}

function getRoleLexicon(role: RoleContext) {
  return dedupe([
    ...role.keywords,
    ...(ROLE_ALIASES[role.slug] ?? [])
  ]).filter(Boolean);
}

function hasBroadEcosystemNoise(sourceItem: SourceItemContext) {
  const normalizedText = `${sourceItem.title} ${sourceItem.summary}`.toLowerCase();
  return BROAD_ECOSYSTEM_TERMS.test(normalizedText);
}

function hasConcreteWorkflowLanguage(sourceItem: SourceItemContext) {
  const normalizedText = `${sourceItem.title} ${sourceItem.summary}`.toLowerCase();
  return CONCRETE_WORKFLOW_TERMS.test(normalizedText);
}

function scoreRoleCandidate(
  role: RoleContext,
  searchText: string,
  titleText: string,
  summaryText: string,
  hintText: string
) {
  const lexicon = getRoleLexicon(role);
  const normalizedPhrases = lexicon
    .map((phrase) => ({ phrase, normalized: normalizeText(phrase) }))
    .filter((entry) => entry.normalized.length > 0);
  const matchedKeywords = normalizedPhrases
    .filter((entry) => titleText.includes(entry.normalized) || summaryText.includes(entry.normalized))
    .map((entry) => entry.phrase);
  const titleMatches = normalizedPhrases
    .filter((entry) => titleText.includes(entry.normalized))
    .map((entry) => entry.phrase);
  const summaryMatches = normalizedPhrases
    .filter((entry) => summaryText.includes(entry.normalized))
    .map((entry) => entry.phrase);
  const hintMatches = normalizedPhrases
    .filter((entry) => hintText.includes(entry.normalized))
    .map((entry) => entry.phrase);
  const roleTokens = new Set(tokenize(lexicon.join(" ")));
  const textTokens = new Set(tokenize(searchText));
  const sharedTokens = [...roleTokens].filter((token) => textTokens.has(token));

  const score =
    matchedKeywords.length * 6 +
    titleMatches.length * 5 +
    summaryMatches.length * 3 +
    hintMatches.length * 2 +
    sharedTokens.length * 1.5;

  return {
    matchedKeywords: dedupe([...matchedKeywords, ...titleMatches, ...summaryMatches, ...hintMatches]).slice(0, 6),
    score
  };
}

export function selectRoleCandidates(
  sourceItem: SourceItemContext,
  roles: RoleContext[],
  maxCandidates = DEFAULT_MAX_CANDIDATES
) {
  if (sourceItem.sourceType !== "JOB_POSTING") {
    const hasWorkflowLanguage = hasConcreteWorkflowLanguage(sourceItem);
    if (hasBroadEcosystemNoise(sourceItem) && !hasWorkflowLanguage) {
      return [];
    }
  }

  const titleText = normalizeText(sourceItem.title);
  const summaryText = normalizeText(sourceItem.summary);
  const hintText = normalizeText((sourceItem.topicHints ?? []).join(" "));
  const text = `${titleText} ${summaryText} ${hintText}`.trim();
  const scoreFloor =
    sourceItem.sourceType === "JOB_POSTING"
      ? JOB_CANDIDATE_SCORE
      : hasConcreteWorkflowLanguage(sourceItem)
        ? BROAD_TIMELINE_CANDIDATE_SCORE
        : GENERAL_CANDIDATE_SCORE;

  const scored = roles
    .filter((role) => !EXCLUDED_ROLE_SLUGS.has(role.slug))
    .map((role) => {
      const { matchedKeywords, score } = scoreRoleCandidate(
        role,
        text,
        titleText,
        summaryText,
        hintText
      );

      return {
        ...role,
        matchedKeywords,
        score
      } satisfies RoleCandidate;
    })
    .filter(
      (candidate) =>
        candidate.score >= scoreFloor || candidate.matchedKeywords.length > 0
    )
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.slug.localeCompare(right.slug);
    })
    .slice(0, maxCandidates);

  if (sourceItem.sourceType === "JOB_POSTING") {
    return scored.filter(
      (candidate) => candidate.score >= JOB_CANDIDATE_SCORE || candidate.matchedKeywords.length >= 1
    );
  }

  return scored;
}
