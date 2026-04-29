import type { SearchResultHit } from "@/lib/role-discovery/search-client";
import {
  rankRoleDiscoveryCandidates,
  type RankedRoleDiscoveryCandidate,
  type RoleDiscoveryContext
} from "@/lib/role-discovery/rank-candidates";

const LANDING_PAGE_PATHS = new Set(["", "/", "/blog", "/blog/"]);
const ARTICLE_PATH_SEGMENTS = new Set([
  "article",
  "articles",
  "blog",
  "insights",
  "news",
  "press",
  "resource",
  "resources",
  "stories",
  "update",
  "updates"
]);
const REFERENCE_PATH_SEGMENTS = new Set(["job", "jobs", "ooh", "occupation", "occupations"]);
const REFERENCE_HOST_TERMS = ["bls.gov", "onetonline.org", "careeronestop.org"];
const VERTICAL_LANDING_PATH_SEGMENTS = new Set(["industry", "industries"]);
const MARKETING_TITLE_TERMS = [
  "#1",
  "software",
  "platform",
  "powered",
  "for small businesses",
  "blog & resources",
  "chatbot",
  "chatbots"
];
const EVERGREEN_TITLE_TERMS = [
  "will ",
  "future of",
  "what does ai mean",
  "not obsolete",
  "more valuable"
];
const REFERENCE_TITLE_TERMS = [
  "occupational outlook handbook",
  "tasks automated by ai",
  "bureau of labor statistics",
  "job profile",
  "career profile"
];

export function isLikelyLandingPage(candidate: SearchResultHit) {
  try {
    const url = new URL(candidate.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const segments = pathname.split("/").filter(Boolean);
    const isLocaleLanding =
      segments.length === 1 && /^[a-z]{2}(?:-[a-z]{2})?$/i.test(segments[0] ?? "");

    if (LANDING_PAGE_PATHS.has(pathname) || isLocaleLanding) {
      return true;
    }

    if (!candidate.publishedAt && segments.length <= 1) {
      const title = candidate.title.toLowerCase();
      return MARKETING_TITLE_TERMS.some((term) => title.includes(term));
    }
  } catch {
    return false;
  }

  return false;
}

export function isLikelyEvergreenExplainer(candidate: SearchResultHit) {
  try {
    const url = new URL(candidate.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const segments = pathname.split("/").filter(Boolean);
    const title = candidate.title.toLowerCase();
    const hasArticlePathHint = segments.some((segment) => ARTICLE_PATH_SEGMENTS.has(segment.toLowerCase()));
    const hasEvergreenTitle = EVERGREEN_TITLE_TERMS.some((term) => title.includes(term));

    if (!candidate.publishedAt && segments.length <= 1) {
      return true;
    }

    if (!candidate.publishedAt && hasEvergreenTitle && !hasArticlePathHint) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function isLikelyOccupationReference(candidate: SearchResultHit) {
  try {
    const url = new URL(candidate.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const segments = pathname.split("/").filter(Boolean);
    const hostname = url.hostname.toLowerCase();
    const title = candidate.title.toLowerCase();
    const hasReferencePathHint = segments.some((segment) =>
      REFERENCE_PATH_SEGMENTS.has(segment.toLowerCase())
    );
    const hasReferenceHost = REFERENCE_HOST_TERMS.some((term) => hostname === term || hostname.endsWith(`.${term}`));
    const hasReferenceTitle = REFERENCE_TITLE_TERMS.some((term) => title.includes(term));

    if (!candidate.publishedAt && hasReferenceTitle) {
      return true;
    }

    if (!candidate.publishedAt && hasReferenceHost) {
      return true;
    }

    if (!candidate.publishedAt && hasReferencePathHint && hasReferenceTitle) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function isLikelyVendorVerticalLanding(candidate: SearchResultHit) {
  try {
    const url = new URL(candidate.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const segments = pathname.split("/").filter(Boolean);
    const title = candidate.title.toLowerCase();
    const hasVerticalPathHint = segments.some((segment) =>
      VERTICAL_LANDING_PATH_SEGMENTS.has(segment.toLowerCase())
    );
    const hasMarketingTitle = MARKETING_TITLE_TERMS.some((term) => title.includes(term));

    if (!candidate.publishedAt && hasVerticalPathHint && hasMarketingTitle) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function filterRoleDiscoveryCandidates(
  candidates: SearchResultHit[],
  context: RoleDiscoveryContext
): RankedRoleDiscoveryCandidate[] {
  return rankRoleDiscoveryCandidates(candidates, context).filter(
    (candidate) =>
      candidate.accepted &&
      !isLikelyLandingPage(candidate) &&
      !isLikelyEvergreenExplainer(candidate) &&
      !isLikelyOccupationReference(candidate) &&
      !isLikelyVendorVerticalLanding(candidate)
  );
}
