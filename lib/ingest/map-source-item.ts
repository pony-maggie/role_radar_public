import { inferRoleCandidates, type RoleCandidate } from "./infer-role-candidates";
import type { RoleCandidateConfidence } from "./infer-role-candidates";

export type SourceItemMappingStatus = "accepted" | "ambiguous" | "unmatched";

export type SourceItemMappingDecision = {
  status: SourceItemMappingStatus;
  primaryRoleSlug: string | null;
  reason: string;
  candidates: RoleCandidate[];
  confidence: RoleCandidateConfidence | null;
  candidateSlugs: string[];
  matchedKeywords: string[];
};

export function mapSourceItemToRoleDecision(item: {
  title: string;
  summary: string;
}): SourceItemMappingDecision {
  const inference = inferRoleCandidates(item);

  if (inference.uniqueCandidate) {
    return {
      status: "accepted",
      primaryRoleSlug: inference.uniqueCandidate.roleSlug,
      reason: "Unique high-confidence candidate",
      candidates: inference.candidates,
      confidence: inference.uniqueCandidate.confidence,
      candidateSlugs: inference.candidates.map((candidate) => candidate.roleSlug),
      matchedKeywords: inference.uniqueCandidate.matchedKeywords
    };
  }

  if (inference.candidates.length > 0) {
    return {
      status: "ambiguous",
      primaryRoleSlug: null,
      reason: "Multiple plausible role candidates or insufficient lead",
      candidates: inference.candidates,
      confidence: inference.candidates[0]?.confidence ?? null,
      candidateSlugs: inference.candidates.map((candidate) => candidate.roleSlug),
      matchedKeywords: inference.candidates.flatMap((candidate) => candidate.matchedKeywords)
    };
  }

  return {
    status: "unmatched",
    primaryRoleSlug: null,
    reason: "No role keywords matched",
    candidates: [],
    confidence: null,
    candidateSlugs: [],
    matchedKeywords: []
  };
}
