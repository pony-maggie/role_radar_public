import { prisma } from "@/lib/db/prisma";
import { adjudicateRoleDiscoveryCandidate } from "@/lib/ai/role-discovery-adjudication";
import { ROLE_ALIASES } from "@/lib/ingest/role-aliases";
import { buildRoleDiscoveryQueryHash } from "@/lib/role-discovery/cache-keys";
import {
  filterRoleDiscoveryCandidates,
  isLikelyEvergreenExplainer,
  isLikelyLandingPage
} from "@/lib/role-discovery/filter-candidates";
import { buildRoleDiscoveryQueries } from "@/lib/role-discovery/query-builder";
import { rankRoleDiscoveryCandidates } from "@/lib/role-discovery/rank-candidates";
import type { RoleSearchClient, SearchResultHit } from "@/lib/role-discovery/search-client";
import {
  findFreshSearchQueryRunByHash,
  listSearchHitsForRun,
  upsertRoleEvidenceCandidate,
  upsertSearchQueryRun
} from "@/lib/repositories/role-discovery";
import { persistDiscoveryScoringEvidence } from "@/lib/repositories/source-items";

type RunRoleDiscoveryOptions = {
  provider: string;
  client: RoleSearchClient;
  maxQueries?: number;
  maxResultsPerQuery?: number;
  maxTimelineItems?: number;
  maxAdjudications?: number;
  adjudicator?: typeof adjudicateRoleDiscoveryCandidate;
  now?: () => Date;
};

type RoleDiscoveryHit = {
  sourceUrl: string;
  title: string;
  snippet: string;
  publishedAt: string | null;
};

type PersistedRoleDiscoveryHit = ReturnType<typeof rankRoleDiscoveryCandidates>[number] & {
  attributionConfidence?: number | null;
  modelProvider?: string | null;
  modelName?: string | null;
  adjudicationReason?: string | null;
};

type ScoreEligibleSignal = {
  roleSlug: string;
  assignedRoleSlug: string;
  sourceUrl: string;
};

function prioritizeQueries(queries: string[]) {
  return [...queries].sort((left, right) => {
    const leftPriority = /ai automation/i.test(left) ? 0 : / ai$/i.test(left) ? 1 : 2;
    const rightPriority = /ai automation/i.test(right) ? 0 : / ai$/i.test(right) ? 1 : 2;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.localeCompare(right);
  });
}

function toRoleDiscoveryHit(hit: SearchResultHit): RoleDiscoveryHit {
  return {
    sourceUrl: hit.url,
    title: hit.title,
    snippet: hit.snippet,
    publishedAt: hit.publishedAt ?? null
  };
}

function isScoreEligibleDiscoveryHit(hit: PersistedRoleDiscoveryHit) {
  return !isLikelyLandingPage(hit) && !isLikelyEvergreenExplainer(hit);
}

function toDiscoveryInferenceRelevance(hit: PersistedRoleDiscoveryHit): "low" | "medium" | "high" {
  if ((hit.attributionConfidence ?? 0) >= 0.8 || hit.discoveryScore >= 8) {
    return "high";
  }

  if ((hit.attributionConfidence ?? 0) >= 0.55 || hit.discoveryScore >= 5) {
    return "medium";
  }

  return "low";
}

function toDiscoverySignalWeight(hit: PersistedRoleDiscoveryHit) {
  const confidenceBoost = hit.attributionConfidence ? Math.min(0.18, hit.attributionConfidence * 0.2) : 0;
  const scoreBoost = Math.min(0.16, Math.max(0, hit.discoveryScore - 4) * 0.03);
  return Math.min(0.88, 0.42 + confidenceBoost + scoreBoost);
}

export async function runRoleDiscovery(roleSlug: string, options: RunRoleDiscoveryOptions) {
  const role = await prisma.roleDictionary.findUnique({
    where: {
      slug: roleSlug
    },
    select: {
      slug: true,
      nameEn: true,
      nameZh: true,
      keywords: true,
      role: {
        select: {
          nameEn: true,
          nameZh: true
        }
      }
    }
  });

  if (!role) {
    throw new Error(`Unknown role: ${roleSlug}`);
  }

  const queries = prioritizeQueries(
    buildRoleDiscoveryQueries({
      slug: role.slug,
      nameEn: role.role?.nameEn ?? role.nameEn,
      nameZh: role.role?.nameZh ?? role.nameZh,
      aliases: ROLE_ALIASES[role.slug] ?? [],
      tasks: Array.isArray(role.keywords)
        ? role.keywords.filter((value): value is string => typeof value === "string").slice(0, 4)
        : []
    })
  ).slice(0, options.maxQueries ?? 3);
  const context = {
    roleSlug,
    roleNameEn: role.role?.nameEn ?? role.nameEn,
    roleNameZh: role.role?.nameZh ?? role.nameZh,
    aliases: ROLE_ALIASES[role.slug] ?? [],
    tasks: Array.isArray(role.keywords)
      ? role.keywords.filter((value): value is string => typeof value === "string").slice(0, 4)
      : []
  };

  const hits: RoleDiscoveryHit[] = [];
  const now = options.now ?? (() => new Date());
  const expiresAt = new Date(now().getTime() + 24 * 60 * 60 * 1000);
  const maxResultsPerQuery = options.maxResultsPerQuery ?? 20;

  for (const queryText of queries) {
    const queryHash = buildRoleDiscoveryQueryHash({
      roleSlug,
      provider: options.provider,
      queryText
    });
    const cachedRun = await findFreshSearchQueryRunByHash(queryHash, now());

    if (cachedRun) {
      const cachedHits = await listSearchHitsForRun(cachedRun.id);
      hits.push(
        ...cachedHits.map((hit) => ({
          sourceUrl: hit.sourceUrl,
          title: hit.title,
          snippet: hit.snippet,
          publishedAt: hit.publishedAt?.toISOString() ?? null
        }))
      );
      continue;
    }

    const searchHits = await options.client.search(queryText, maxResultsPerQuery);
    const run = await upsertSearchQueryRun({
      roleSlug,
      provider: options.provider,
      queryText,
      queryHash,
      status: "SUCCESS",
      expiresAt,
      hits: searchHits.map((hit, index) => ({
        rank: index + 1,
        sourceUrl: hit.url,
        title: hit.title,
        snippet: hit.snippet,
        publishedAt: hit.publishedAt ?? null
      }))
    });

    const persistedHits = await listSearchHitsForRun(run.id);
    hits.push(
      ...persistedHits.map((hit) => ({
        sourceUrl: hit.sourceUrl,
        title: hit.title,
        snippet: hit.snippet,
        publishedAt: hit.publishedAt?.toISOString() ?? null
      }))
    );
  }

  const dedupedHits = [...new Map(
    hits.map((hit) => [hit.sourceUrl, hit] as const)
  ).values()];
  const rankedHits = rankRoleDiscoveryCandidates(
    dedupedHits.map((hit) => ({
      url: hit.sourceUrl,
      title: hit.title,
      snippet: hit.snippet,
      publishedAt: hit.publishedAt
    })),
    context
  );
  const adjudicator = options.adjudicator ?? adjudicateRoleDiscoveryCandidate;
  const adjudicatedHits: PersistedRoleDiscoveryHit[] = [];
  const filteredTimelineHits = filterRoleDiscoveryCandidates(
    dedupedHits.map((hit) => ({
      url: hit.sourceUrl,
      title: hit.title,
      snippet: hit.snippet,
      publishedAt: hit.publishedAt
    })),
    context
  );
  const candidatesForAdjudication = rankedHits
    .filter(
      (candidate) =>
        candidate.reviewable &&
        !isLikelyLandingPage(candidate)
    )
    .slice(0, options.maxAdjudications ?? 3);
  const adjudicationQueue = candidatesForAdjudication;

  for (const hit of adjudicationQueue) {
    const adjudication = await adjudicator({
      role: {
        slug: context.roleSlug,
        nameEn: context.roleNameEn,
        nameZh: context.roleNameZh,
        aliases: context.aliases,
        tasks: context.tasks
      },
      candidate: {
        url: hit.url,
        title: hit.title,
        snippet: hit.snippet,
        publishedAt: hit.publishedAt
      }
    });

    if (!adjudication?.accepted) {
      continue;
    }

    adjudicatedHits.push({
      ...hit,
      accepted: true,
      attributionConfidence: adjudication.confidence,
      modelProvider: adjudication.provider,
      modelName: adjudication.model,
      adjudicationReason: adjudication.reason
    });
  }

  const persistedHits: PersistedRoleDiscoveryHit[] = [...new Map(
    rankedHits
      .filter((hit) => hit.accepted)
      .concat(adjudicatedHits)
      .map((hit) => [hit.url, hit] as const)
  ).values()];
  const timelineUrls = new Set(
    [...new Map(
      filteredTimelineHits
        .concat(
          adjudicatedHits.filter(
            (hit) => !isLikelyLandingPage(hit) && !isLikelyEvergreenExplainer(hit)
          )
        )
        .map((hit) => [hit.url, hit] as const)
    ).values()]
      .slice(0, options.maxTimelineItems ?? 10)
      .map((hit) => hit.url)
  );
  const timelineHits = persistedHits.filter((hit) => timelineUrls.has(hit.url));
  const scoreEligibleHits = persistedHits.filter((hit) => isScoreEligibleDiscoveryHit(hit));
  const scoreEligibleSignals: ScoreEligibleSignal[] = scoreEligibleHits.map((hit) => ({
    roleSlug,
    assignedRoleSlug: roleSlug,
    sourceUrl: hit.url
  }));

  await Promise.all(
    persistedHits.map((hit) =>
      upsertRoleEvidenceCandidate({
        roleSlug,
        sourceUrl: hit.url,
        title: hit.title,
        snippet: hit.snippet,
        sourceLabel: "Role Search",
        evidenceKind: "role_search",
        timelineEligible: timelineUrls.has(hit.url),
        scoreEligible: isScoreEligibleDiscoveryHit(hit),
        attributionConfidence: hit.attributionConfidence ?? null,
        modelProvider: hit.modelProvider ?? null,
        modelName: hit.modelName ?? null,
        rawJson: {
          provider: options.provider,
          publishedAt: hit.publishedAt,
          discoveryScore: hit.discoveryScore,
          adjudicationReason: hit.adjudicationReason ?? null
        }
      })
    )
  );

  for (const hit of scoreEligibleHits) {
    await persistDiscoveryScoringEvidence({
      roleSlug,
      sourceUrl: hit.url,
      title: hit.title,
      summaryEn: hit.snippet,
      publishedAt: hit.publishedAt ?? null,
      sourceLabel: "Role Search",
      relevance: toDiscoveryInferenceRelevance(hit),
      signalWeight: toDiscoverySignalWeight(hit),
      modelProvider: hit.modelProvider ?? "brave",
      modelName: hit.modelName ?? "role-discovery",
      rawJson: {
        provider: options.provider,
        publishedAt: hit.publishedAt,
        discoveryScore: hit.discoveryScore,
        adjudicationReason: hit.adjudicationReason ?? null,
        evidenceKind: "role_search",
        timelineEligible: timelineUrls.has(hit.url),
        scoreEligible: true
      }
    });
  }

  return {
    roleSlug,
    queries,
    stats: {
      candidateCount: dedupedHits.length,
      acceptedCount: rankedHits.filter((hit) => hit.accepted).length,
      adjudicatedCount: adjudicatedHits.length,
      persistedCount: persistedHits.length,
      timelineCount: timelineUrls.size,
      scoreEligibleCount: scoreEligibleHits.length
    },
    hits: persistedHits.slice(0, options.maxTimelineItems ?? 10).map((hit) => ({
      sourceUrl: hit.url,
      title: hit.title,
      snippet: hit.snippet,
      publishedAt: hit.publishedAt ?? null
    })),
    timelineHits: timelineHits.slice(0, options.maxTimelineItems ?? 10).map((hit) => ({
      sourceUrl: hit.url,
      title: hit.title,
      snippet: hit.snippet,
      publishedAt: hit.publishedAt ?? null
    })),
    affectedRoleSlugs: scoreEligibleHits.length > 0 ? [roleSlug] : [],
    scoreEligibleSignals
  };
}
