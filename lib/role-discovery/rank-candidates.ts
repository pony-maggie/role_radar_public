import type { SearchResultHit } from "@/lib/role-discovery/search-client";

export type RoleDiscoveryContext = {
  roleSlug: string;
  roleNameEn: string;
  roleNameZh: string;
  aliases: string[];
  tasks: string[];
};

export type RankedRoleDiscoveryCandidate = SearchResultHit & {
  discoveryScore: number;
  accepted: boolean;
  reviewable: boolean;
};

const AI_TERMS = [
  "ai",
  "artificial intelligence",
  "automation",
  "automate",
  "agent",
  "agents",
  "copilot",
  "llm"
];

const WORKFLOW_TERMS = [
  "workflow",
  "workflows",
  "task",
  "tasks",
  "ticket",
  "tickets",
  "triage",
  "routing",
  "case",
  "cases",
  "resolution",
  "review",
  "response",
  "operations",
  "process",
  "job"
];

const NOISE_TERMS = [
  "funding",
  "raises",
  "raised",
  "valuation",
  "investor",
  "investors",
  "series a",
  "series b",
  "seed round",
  "conference",
  "summit",
  "webinar",
  "event",
  "award"
];

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function buildMatchTerms(context: RoleDiscoveryContext) {
  return [
    context.roleNameEn,
    context.roleNameZh,
    ...context.aliases
  ]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length >= 2);
}

function buildTaskTerms(context: RoleDiscoveryContext) {
  const roleTerms = new Set(buildMatchTerms(context));

  return context.tasks
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length >= 3)
    .filter((value) => !roleTerms.has(value));
}

function countDistinctMatches(text: string, terms: string[]) {
  let count = 0;

  for (const term of new Set(terms)) {
    if (text.includes(term)) {
      count += 1;
    }
  }

  return count;
}

function hasAnyMatch(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function parsePublishedAt(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function assessRoleDiscoveryCandidate(
  candidate: SearchResultHit,
  context: RoleDiscoveryContext
) {
  const title = normalizeText(candidate.title);
  const snippet = normalizeText(candidate.snippet);
  const combined = `${title} ${snippet}`.trim();
  const matchTerms = buildMatchTerms(context);
  const taskTerms = buildTaskTerms(context);

  const titleRoleMatches = countDistinctMatches(title, matchTerms);
  const snippetRoleMatches = countDistinctMatches(snippet, matchTerms);
  const hasRoleMatch = titleRoleMatches + snippetRoleMatches > 0;
  const hasAiSignal = hasAnyMatch(combined, AI_TERMS);
  const hasWorkflowSignal =
    hasAnyMatch(combined, WORKFLOW_TERMS) || countDistinctMatches(combined, taskTerms) > 0;
  const hasNoiseSignal = hasAnyMatch(combined, NOISE_TERMS);

  const discoveryScore =
    titleRoleMatches * 3 +
    snippetRoleMatches * 2 +
    (hasAiSignal ? 3 : 0) +
    (hasWorkflowSignal ? 2 : 0) -
    (hasNoiseSignal ? 6 : 0);

  const accepted =
    hasRoleMatch &&
    (hasAiSignal || hasWorkflowSignal) &&
    discoveryScore >= 4 &&
    !(hasNoiseSignal && !hasWorkflowSignal);
  const reviewable =
    !accepted &&
    hasRoleMatch &&
    discoveryScore >= 3 &&
    !hasNoiseSignal;

  return {
    accepted,
    reviewable,
    discoveryScore
  };
}

export function rankRoleDiscoveryCandidates(
  candidates: SearchResultHit[],
  context: RoleDiscoveryContext
): RankedRoleDiscoveryCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      ...assessRoleDiscoveryCandidate(candidate, context)
    }))
    .sort((left, right) => {
      const scoreDelta = right.discoveryScore - left.discoveryScore;
      if (scoreDelta !== 0) return scoreDelta;

      const publishedDelta = parsePublishedAt(right.publishedAt) - parsePublishedAt(left.publishedAt);
      if (publishedDelta !== 0) return publishedDelta;

      return left.title.localeCompare(right.title);
    });
}
