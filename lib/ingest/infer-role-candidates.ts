import { roleKeywords, type SeededRoleKeywordSlug } from "./role-keywords";

export type RoleCandidateConfidence = "high" | "medium" | "low";

export type RoleCandidate = {
  roleSlug: SeededRoleKeywordSlug;
  matchedKeywords: string[];
  score: number;
  confidence: RoleCandidateConfidence;
};

export type RoleCandidateResult = {
  candidates: RoleCandidate[];
  uniqueCandidate: RoleCandidate | null;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

function getConfidence(score: number): RoleCandidateConfidence {
  if (score >= 3) return "high";
  if (score >= 2) return "medium";
  return "low";
}

export function inferRoleCandidates(item: { title: string; summary: string }): RoleCandidateResult {
  const haystack = normalizeText(`${item.title} ${item.summary}`);

  const candidates = (Object.entries(roleKeywords) as Array<[SeededRoleKeywordSlug, readonly string[]]>)
    .map(([roleSlug, keywords]) => {
      const matchedKeywords = keywords.filter((keyword) => haystack.includes(normalizeText(keyword)));
      return {
        roleSlug,
        matchedKeywords,
        score: matchedKeywords.length,
        confidence: getConfidence(matchedKeywords.length)
      } satisfies RoleCandidate;
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.roleSlug.localeCompare(right.roleSlug));

  if (candidates.length === 0) {
    return { candidates, uniqueCandidate: null };
  }

  const [topCandidate, secondCandidate] = candidates;
  const hasSafeLead =
    !secondCandidate || topCandidate.score - secondCandidate.score >= 2 || secondCandidate.score <= 1;

  const uniqueCandidate =
    topCandidate.confidence === "high" && hasSafeLead ? topCandidate : null;

  return {
    candidates,
    uniqueCandidate
  };
}
