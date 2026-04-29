import { prisma } from "@/lib/db/prisma";
import type { RatingStatus, RiskLevel } from "@prisma/client";
import { inferRoleProfileFromDictionary } from "@/lib/domain/role-profile";
import { listTimelineSourceItemsForRoleSlug } from "@/lib/repositories/source-items";

const riskSeverityOrder = {
  SEVERE: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
} satisfies Record<RiskLevel, number>;

const homepagePrioritySlugs = new Set([
  "actors",
  "customer-service-representative",
  "project-management-specialists",
  "management-analysts",
  "human-resources-specialists",
  "human-resources-managers",
  "financial-managers",
  "marketing-managers",
  "sales-managers",
  "business-intelligence-analysts",
  "computer-systems-analysts",
  "administrative-services-managers",
  "billing-and-posting-clerks",
  "bill-and-account-collectors",
  "claims-adjusters-examiners-and-investigators",
  "compliance-officers",
  "operations-research-analysts",
  "public-relations-specialists",
  "public-relations-managers",
  "technical-writers",
  "training-and-development-specialists",
  "market-research-analysts-and-marketing-specialists",
  "editors",
  "data-entry-keyers",
  "database-architects",
  "desktop-publishers",
  "purchasing-managers",
  "receptionists-and-information-clerks",
  "lawyers",
  "legal-secretaries-and-administrative-assistants"
]);

function getSourceHost(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

function isPublicSourceUrl(sourceUrl: string) {
  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./i, "").toLowerCase();
    return hostname !== "example.com";
  } catch {
    return false;
  }
}

type HomepageSortableRole = {
  slug: string;
  riskLevel: RiskLevel;
  ratingStatus: RatingStatus;
  nameZh: string;
  nameEn: string;
  publicTimelineCount?: number;
  replacementRate?: number | null;
  riskSummaryEn?: string | null;
  riskSummaryZh?: string | null;
};

function isTranslatedRole(role: HomepageSortableRole) {
  return role.nameZh !== role.nameEn;
}

function readRoleKeywords(keywords: unknown) {
  if (!Array.isArray(keywords)) {
    return [];
  }

  return keywords.filter((value): value is string => typeof value === "string");
}

function countKeywordOverlap(left: string[], right: string[]) {
  if (!left.length || !right.length) {
    return 0;
  }

  const rightTerms = new Set(right.map((value) => value.toLowerCase()));

  return left.reduce((count, value) => {
    return count + (rightTerms.has(value.toLowerCase()) ? 1 : 0);
  }, 0);
}

function normalizeKeywords(keywords: readonly string[]) {
  return keywords.map((keyword) => keyword.toLowerCase());
}

const topicKeywordAliases: Record<string, readonly string[]> = {
  finance: ["financial"],
  financial: ["finance"],
  lawyer: ["lawyers", "legal"],
  lawyers: ["lawyer", "legal"],
  attorney: ["attorneys", "legal"],
  attorneys: ["attorney", "legal"],
  legal: ["lawyer", "lawyers", "attorney", "attorneys"]
};

function singularizeKeywordToken(token: string) {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("s") && token.length > 4) {
    return token.slice(0, -1);
  }

  return token;
}

function expandTopicKeywordTerms(keywords: readonly string[]) {
  const terms = new Set<string>();

  for (const keyword of normalizeKeywords(keywords)) {
    const normalized = keyword.trim();

    if (!normalized) {
      continue;
    }

    terms.add(normalized);
    for (const token of normalized.split(/\s+/)) {
      const singular = singularizeKeywordToken(token);
      terms.add(token);
      terms.add(singular);

      for (const alias of topicKeywordAliases[token] ?? []) {
        terms.add(alias);
      }

      for (const alias of topicKeywordAliases[singular] ?? []) {
        terms.add(alias);
      }
    }
  }

  return terms;
}

function topicKeywordMatchesIncludeTerms(keyword: string, includeTerms: ReadonlySet<string>) {
  for (const term of expandTopicKeywordTerms([keyword])) {
    if (includeTerms.has(term)) {
      return true;
    }
  }

  return false;
}

function compareTopicRolesByReplacementRate<
  T extends {
    slug: string;
    nameEn: string;
    replacementRate: number | null;
  }
>(left: T, right: T) {
  const leftHasRate = typeof left.replacementRate === "number";
  const rightHasRate = typeof right.replacementRate === "number";

  if (leftHasRate !== rightHasRate) {
    return leftHasRate ? -1 : 1;
  }

  if (leftHasRate && rightHasRate) {
    const rateDelta = (right.replacementRate ?? 0) - (left.replacementRate ?? 0);
    if (rateDelta !== 0) return rateDelta;
  }

  const nameDelta = left.nameEn.localeCompare(right.nameEn);
  if (nameDelta !== 0) return nameDelta;

  return left.slug.localeCompare(right.slug);
}

function getPublicTimelineCount(role: HomepageSortableRole) {
  return role.publicTimelineCount ?? 0;
}

function isNoSourceFallbackSummary(summary: string | null | undefined) {
  if (!summary) return false;

  return [
    "No role-specific source items are attached yet",
    "This role is being tracked with 0 recent source signal",
    "这个岗位暂时还没有挂接到足够的专属资讯",
    "这个岗位当前结合了 0 条近期来源信号"
  ].some((pattern) => summary.includes(pattern));
}

function buildTimelineAwareSummary(locale: "en" | "zh", timelineCount: number) {
  if (locale === "zh") {
    return `这个岗位当前已结合 ${timelineCount} 条时间线资讯和岗位画像推理来给出替代率。`;
  }

  return `This role is currently tracked with ${timelineCount} timeline item${timelineCount === 1 ? "" : "s"} plus a profile-based replacement estimate.`;
}

function resolveHomepageRiskSummary(
  locale: "en" | "zh",
  riskSummary: string | null | undefined,
  publicTimelineCount: number
) {
  if (publicTimelineCount > 0 && isNoSourceFallbackSummary(riskSummary)) {
    return buildTimelineAwareSummary(locale, publicTimelineCount);
  }

  return riskSummary ?? null;
}

function compareDictionaryRolesForDisplay(left: HomepageSortableRole, right: HomepageSortableRole) {
  const leftPriority = homepagePrioritySlugs.has(left.slug);
  const rightPriority = homepagePrioritySlugs.has(right.slug);
  if (leftPriority !== rightPriority) {
    return leftPriority ? -1 : 1;
  }

  const leftTranslated = isTranslatedRole(left);
  const rightTranslated = isTranslatedRole(right);
  if (leftTranslated !== rightTranslated) {
    return leftTranslated ? -1 : 1;
  }

  const severityDelta = riskSeverityOrder[left.riskLevel] - riskSeverityOrder[right.riskLevel];
  if (severityDelta !== 0) return severityDelta;

  return left.nameEn.localeCompare(right.nameEn);
}

export function sortDictionaryRolesForDisplay<T extends HomepageSortableRole>(roles: T[]): T[] {
  return [...roles].sort(compareDictionaryRolesForDisplay);
}

export async function listHomepageReplacementRanking(limit = 10) {
  const roles = (await listHomepageRoles(760))
    .filter((role) => typeof role.replacementRate === "number")
    .sort((left, right) => {
      const rateDelta = (right.replacementRate ?? 0) - (left.replacementRate ?? 0);
      if (rateDelta !== 0) return rateDelta;
      return left.nameEn.localeCompare(right.nameEn);
    })
    .slice(0, limit);

  return roles.map((role) => ({
    slug: role.slug,
    nameEn: role.nameEn,
    nameZh: role.nameZh,
    replacementRate: role.replacementRate ?? 0
  }));
}

export function sortRolesForHomepage<T extends HomepageSortableRole>(roles: T[]): T[] {
  return [...roles].sort((left, right) => {
    const coverageDelta = getPublicTimelineCount(right) - getPublicTimelineCount(left);
    if (coverageDelta !== 0) return coverageDelta;

    if (left.ratingStatus !== right.ratingStatus) {
      return left.ratingStatus === "RATED" ? -1 : 1;
    }

    if (left.ratingStatus !== "RATED" && right.ratingStatus !== "RATED") {
      const dictionaryDelta = compareDictionaryRolesForDisplay(left, right);
      if (dictionaryDelta !== 0) return dictionaryDelta;
    }

    const severityDelta = riskSeverityOrder[left.riskLevel] - riskSeverityOrder[right.riskLevel];
    if (severityDelta !== 0) return severityDelta;
    return left.nameEn.localeCompare(right.nameEn);
  });
}

export function mergeHomepageRoles(
  ratedRoles: HomepageSortableRole[],
  dictionaryRoles: HomepageSortableRole[],
  limit = 16
) {
  const merged = new Map<string, HomepageSortableRole>();

  for (const role of dictionaryRoles) {
    merged.set(role.slug, role);
  }

  for (const role of ratedRoles) {
    merged.set(role.slug, role);
  }

  return sortRolesForHomepage([...merged.values()]).slice(0, limit);
}

async function listHomepageCoverageCounts() {
  const [items, roleDiscoveryCandidates] = await Promise.all([
    prisma.sourceItem.findMany({
      where: {
        decisions: {
          some: {
            decisionStatus: "ACCEPTED"
          }
        }
      },
      select: {
        id: true,
        sourceUrl: true,
        decisions: {
          where: {
            decisionStatus: "ACCEPTED"
          },
          select: {
            role: {
              select: {
                slug: true
              }
            }
          }
        },
        inference: {
          select: {
            assignedRoleSlug: true
          }
        }
      }
    }),
    prisma.roleEvidenceCandidate.findMany({
      where: {
        timelineEligible: true
      },
      select: {
        roleSlug: true,
        sourceUrl: true
      }
    })
  ]);

  const counts = new Map<string, number>();

  for (const item of items) {
    if (!isPublicSourceUrl(item.sourceUrl)) continue;

    const slugs = new Set<string>();
    for (const decision of item.decisions) {
      if (decision.role?.slug) {
        slugs.add(decision.role.slug);
      }
    }

    if (item.inference?.assignedRoleSlug) {
      slugs.add(item.inference.assignedRoleSlug);
    }

    for (const slug of slugs) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }

  for (const candidate of roleDiscoveryCandidates) {
    if (!isPublicSourceUrl(candidate.sourceUrl)) continue;
    counts.set(candidate.roleSlug, (counts.get(candidate.roleSlug) ?? 0) + 1);
  }

  return counts;
}

export async function listHomepageRoles(limit = 16) {
  const [ratedRoles, dictionaryRoles, coverageCounts] = await Promise.all([
    prisma.role.findMany({
      orderBy: { nameEn: "asc" }
    }),
    prisma.roleDictionary.findMany({
      where: { isActive: true },
      orderBy: { nameEn: "asc" }
    }),
    listHomepageCoverageCounts()
  ]);

  return mergeHomepageRoles(
    ratedRoles.map((role) => {
      const publicTimelineCount = coverageCounts.get(role.slug) ?? 0;

      return {
        slug: role.slug,
        nameEn: role.nameEn,
        nameZh: role.nameZh,
        riskLevel: role.riskLevel,
        ratingStatus: role.ratingStatus,
        publicTimelineCount,
        replacementRate: role.replacementRate,
        riskSummaryEn: resolveHomepageRiskSummary("en", role.riskSummaryEn, publicTimelineCount),
        riskSummaryZh: resolveHomepageRiskSummary("zh", role.riskSummaryZh, publicTimelineCount)
      };
    }),
    sortDictionaryRolesForDisplay(
      dictionaryRoles.map((role) => {
        const publicTimelineCount = coverageCounts.get(role.slug) ?? 0;
        const inferred = inferRoleProfileFromDictionary({
          slug: role.slug,
          nameEn: role.nameEn,
          nameZh: role.nameZh,
          keywords: Array.isArray(role.keywords) ? role.keywords.filter((value): value is string => typeof value === "string") : []
        }, publicTimelineCount);

        return {
          slug: role.slug,
          nameEn: role.nameEn,
          nameZh: role.nameZh,
          riskLevel: inferred.riskLevel,
          ratingStatus: inferred.ratingStatus,
          publicTimelineCount,
          replacementRate: inferred.replacementRate,
          riskSummaryEn: inferred.summaryEn,
          riskSummaryZh: inferred.summaryZh
        };
      })
    ),
    limit
  );
}

export async function listRoleSearchSuggestions(limit = 32) {
  const suggestions = await prisma.roleDictionary.findMany({
    where: { isActive: true },
    orderBy: { nameEn: "asc" },
    select: {
      slug: true,
      nameEn: true,
      nameZh: true
    }
  });

  return sortDictionaryRolesForDisplay(
    suggestions.map((role) => ({
      slug: role.slug,
      nameEn: role.nameEn,
      nameZh: role.nameZh,
      riskLevel: "LOW" as const,
      ratingStatus: "INSUFFICIENT_SIGNAL" as const
    }))
  )
    .slice(0, limit)
    .map(({ slug, nameEn, nameZh }) => ({
      slug,
      nameEn,
      nameZh
    }));
}

export async function listIndexableRoleSlugs() {
  return prisma.roleDictionary.findMany({
    where: { isActive: true },
    orderBy: [{ updatedAt: "desc" }, { slug: "asc" }],
    select: {
      slug: true,
      updatedAt: true
    }
  });
}

export async function listTrackedRoleSlugs() {
  const roles = await prisma.role.findMany({
    orderBy: {
      slug: "asc"
    },
    select: {
      slug: true
    }
  });

  return roles.map((role) => role.slug);
}

export async function findTrackedRoleStateBySlug(slug: string) {
  return prisma.role.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      replacementRate: true,
      riskLevel: true,
      ratingStatus: true,
      lastRatedAt: true,
      riskCachedAt: true
    }
  });
}

export async function listTopicRoles(input: {
  limit: number;
  includeSlugs?: readonly string[];
  includeKeywords?: readonly string[];
  minReplacementRate?: number;
}) {
  const dictionaryRoles = await prisma.roleDictionary.findMany({
    where: { isActive: true },
    select: {
      slug: true,
      nameEn: true,
      nameZh: true,
      keywords: true
    }
  });

  const storedRoles = await prisma.role.findMany({
    where: {
      slug: {
        in: dictionaryRoles.map((role) => role.slug)
      }
    },
    select: {
      slug: true,
      replacementRate: true,
      riskLevel: true,
      ratingStatus: true,
      nameEn: true,
      nameZh: true,
      riskSummaryEn: true,
      riskSummaryZh: true
    }
  });

  const storedBySlug = new Map(storedRoles.map((role) => [role.slug, role] as const));
  const includeSlugs = input.includeSlugs?.length ? new Set(input.includeSlugs) : null;
  const includeKeywords = input.includeKeywords?.length
    ? expandTopicKeywordTerms(input.includeKeywords)
    : null;

  return dictionaryRoles
    .map((dictionaryRole) => {
      const storedRole = storedBySlug.get(dictionaryRole.slug);
      const dictionaryKeywords = readRoleKeywords(dictionaryRole.keywords);
      const inferred = inferRoleProfileFromDictionary({
        slug: dictionaryRole.slug,
        nameEn: dictionaryRole.nameEn,
        nameZh: dictionaryRole.nameZh,
        keywords: dictionaryKeywords
      });
      const replacementRate = storedRole?.replacementRate ?? inferred.replacementRate;
      const riskLevel = storedRole?.riskLevel ?? inferred.riskLevel;
      const ratingStatus = storedRole?.ratingStatus ?? inferred.ratingStatus;

      return {
        slug: dictionaryRole.slug,
        nameEn: storedRole?.nameEn ?? dictionaryRole.nameEn,
        nameZh: storedRole?.nameZh ?? dictionaryRole.nameZh,
        replacementRate,
        riskLevel,
        ratingStatus,
        riskSummaryEn: storedRole?.riskSummaryEn ?? inferred.summaryEn,
        riskSummaryZh: storedRole?.riskSummaryZh ?? inferred.summaryZh,
        keywords: dictionaryKeywords
      };
    })
    .filter((role) => {
      if (includeSlugs && !includeSlugs.has(role.slug)) {
        return false;
      }

      if (
        includeKeywords &&
        !role.keywords.some((keyword) => topicKeywordMatchesIncludeTerms(keyword, includeKeywords))
      ) {
        return false;
      }

      if (
        typeof input.minReplacementRate === "number" &&
        !(typeof role.replacementRate === "number" && role.replacementRate >= input.minReplacementRate)
      ) {
        return false;
      }

      return true;
    })
    .sort(compareTopicRolesByReplacementRate)
    .slice(0, input.limit)
    .map(({ keywords: _keywords, ...role }) => role);
}

export async function listRelatedRoles(slug: string, limit = 4) {
  const baseRole = await prisma.roleDictionary.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameZh: true,
      industryCode: true,
      keywords: true
    }
  });

  if (!baseRole) {
    return [];
  }

  const candidateRoles = await prisma.roleDictionary.findMany({
    where: {
      isActive: true,
      industryCode: baseRole.industryCode,
      slug: {
        not: slug
      }
    },
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameZh: true,
      industryCode: true,
      keywords: true
    }
  });

  if (!candidateRoles.length) {
    return [];
  }

  const baseKeywords = readRoleKeywords(baseRole.keywords);
  const materializedRoles = await prisma.role.findMany({
    where: {
      slug: {
        in: candidateRoles.map((role) => role.slug)
      }
    },
    select: {
      slug: true,
      replacementRate: true,
      riskLevel: true,
      ratingStatus: true
    }
  });
  const materializedBySlug = new Map(materializedRoles.map((role) => [role.slug, role] as const));

  return candidateRoles
    .map((candidate) => {
      const candidateKeywords = readRoleKeywords(candidate.keywords);
      const overlap = countKeywordOverlap(baseKeywords, candidateKeywords);
      const materialized = materializedBySlug.get(candidate.slug);
      const inferred = inferRoleProfileFromDictionary({
        slug: candidate.slug,
        nameEn: candidate.nameEn,
        nameZh: candidate.nameZh,
        keywords: candidateKeywords
      });

      return {
        slug: candidate.slug,
        nameEn: candidate.nameEn,
        nameZh: candidate.nameZh,
        replacementRate: materialized?.replacementRate ?? inferred.replacementRate,
        riskLevel: materialized?.riskLevel ?? inferred.riskLevel,
        ratingStatus: materialized?.ratingStatus ?? inferred.ratingStatus,
        keywordOverlap: overlap,
        translated: candidate.nameZh !== candidate.nameEn
      };
    })
    .sort((left, right) => {
      if (right.keywordOverlap !== left.keywordOverlap) {
        return right.keywordOverlap - left.keywordOverlap;
      }

      if (left.translated !== right.translated) {
        return left.translated ? -1 : 1;
      }

      return left.nameEn.localeCompare(right.nameEn);
    })
    .slice(0, limit)
    .map(({ keywordOverlap: _keywordOverlap, translated: _translated, ...role }) => role);
}

export async function getRoleBySlug(slug: string) {
  let role = await prisma.role.findUnique({
    where: { slug },
    include: {
      signals: { orderBy: { publishedAt: "desc" }, take: 10 }
    }
  });

  const dictionaryRole = await prisma.roleDictionary.findUnique({
    where: { slug }
  });

  if (!role && dictionaryRole) {
    const inferred = inferRoleProfileFromDictionary({
      slug: dictionaryRole.slug,
      nameEn: dictionaryRole.nameEn,
      nameZh: dictionaryRole.nameZh,
      keywords: Array.isArray(dictionaryRole.keywords)
        ? dictionaryRole.keywords.filter((value): value is string => typeof value === "string")
        : []
    });

    role = await prisma.role.upsert({
      where: {
        slug: dictionaryRole.slug
      },
      create: {
        dictionaryRoleId: dictionaryRole.id,
        slug: dictionaryRole.slug,
        socCode: dictionaryRole.socCode,
        nameEn: dictionaryRole.nameEn,
        nameZh: dictionaryRole.nameZh,
        summaryEn: inferred.summaryEn,
        summaryZh: inferred.summaryZh,
        riskLevel: inferred.riskLevel,
        replacementRate: inferred.replacementRate,
        riskSummaryEn: inferred.summaryEn,
        riskSummaryZh: inferred.summaryZh,
        riskReasons: inferred.reasons,
        riskModelProvider: "fallback",
        riskModelName: "role-profile",
        riskInferenceRaw: { bootstrap: true },
        ratingStatus: "RATED",
        lastRatedAt: new Date(),
        repetitionScore: inferred.repetitionScore,
        ruleClarityScore: inferred.ruleClarityScore,
        transformationScore: inferred.transformationScore,
        workflowAutomationScore: inferred.workflowAutomationScore,
        interpersonalScore: inferred.interpersonalScore,
        physicalityScore: inferred.physicalityScore,
        ambiguityScore: inferred.ambiguityScore
      },
      update: {},
      include: {
        signals: { orderBy: { publishedAt: "desc" }, take: 10 }
      }
    });
  }

  if (!role) {
    if (!dictionaryRole) {
      return null;
    }

    const inferred = inferRoleProfileFromDictionary({
      slug: dictionaryRole.slug,
      nameEn: dictionaryRole.nameEn,
      nameZh: dictionaryRole.nameZh,
      keywords: Array.isArray(dictionaryRole.keywords)
        ? dictionaryRole.keywords.filter((value): value is string => typeof value === "string")
        : []
    });

    return {
      id: `dictionary-${dictionaryRole.id}`,
      dictionaryRoleId: dictionaryRole.id,
      slug: dictionaryRole.slug,
      socCode: dictionaryRole.socCode,
      nameEn: dictionaryRole.nameEn,
      nameZh: dictionaryRole.nameZh,
      summaryEn: inferred.summaryEn,
      summaryZh: inferred.summaryZh,
      riskLevel: inferred.riskLevel,
      replacementRate: inferred.replacementRate,
      riskSummaryEn: inferred.summaryEn,
      riskSummaryZh: inferred.summaryZh,
      riskReasons: inferred.reasons,
      ratingStatus: "RATED" as const,
      lastRatedAt: null,
      repetitionScore: inferred.repetitionScore,
      ruleClarityScore: inferred.ruleClarityScore,
      transformationScore: inferred.transformationScore,
      workflowAutomationScore: inferred.workflowAutomationScore,
      interpersonalScore: inferred.interpersonalScore,
      physicalityScore: inferred.physicalityScore,
      ambiguityScore: inferred.ambiguityScore,
      signals: [],
      sourceItemDecisions: [],
      timelineItems: await listTimelineSourceItemsForRoleSlug(slug)
    };
  }

  const timelineItems = new Map<
    string,
    {
      id: string;
      sourceTitle: string;
      sourceLabel: string | null;
      sourceHost: string | null;
      sourceUrl: string;
      sourceType: string;
      summaryEn: string;
      summaryZh: string;
      rationaleEn: string;
      rationaleZh: string;
      publishedAt: Date;
    }
  >();

  for (const signal of role.signals) {
    if (!isPublicSourceUrl(signal.sourceUrl)) {
      continue;
    }

    timelineItems.set(signal.sourceUrl, {
      id: signal.id,
      sourceTitle: signal.sourceTitle,
      sourceLabel: signal.sourceType,
      sourceHost: getSourceHost(signal.sourceUrl),
      sourceUrl: signal.sourceUrl,
      sourceType: signal.sourceType,
      summaryEn: signal.summaryEn,
      summaryZh: signal.summaryZh,
      rationaleEn: signal.rationaleEn,
      rationaleZh: signal.rationaleZh,
      publishedAt: signal.publishedAt
    });
  }

  for (const item of await listTimelineSourceItemsForRoleSlug(slug)) {
    const existingItem = timelineItems.get(item.sourceUrl);
    timelineItems.set(item.sourceUrl, {
      ...(existingItem ?? {}),
      ...item,
      id: item.id,
      sourceLabel: item.sourceLabel ?? existingItem?.sourceLabel ?? null,
      sourceHost: item.sourceHost ?? existingItem?.sourceHost ?? null,
      summaryEn: item.summaryEn ?? existingItem?.summaryEn ?? "",
      summaryZh: item.summaryZh ?? existingItem?.summaryZh ?? item.summaryEn,
      rationaleEn: item.rationaleEn ?? existingItem?.rationaleEn ?? item.summaryEn,
      rationaleZh: item.rationaleZh ?? existingItem?.rationaleZh ?? item.summaryZh ?? item.summaryEn,
      publishedAt: item.publishedAt ?? existingItem?.publishedAt ?? new Date(0)
    });
  }

  return {
    ...role,
    sourceItemDecisions: [],
    timelineItems: [...timelineItems.values()]
      .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime())
      .slice(0, 10)
  };
}
