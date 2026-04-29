import { prisma } from "@/lib/db/prisma";
import { normalizeStoredSignalWeight } from "@/lib/ingest/signal-policy";
import type {
  Prisma,
  CandidateConfidence,
  MappingDecisionStatus,
  SignalStrength,
  SignalType,
  ReviewStatus,
  SourceMappingMode,
  SourceType
} from "@prisma/client";

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

type PersistDecisionInput = {
  status: "accepted" | "ambiguous" | "unmatched";
  primaryRoleSlug: string | null;
  reason: string;
  confidence: "high" | "medium" | "low" | null;
  candidateSlugs: string[];
  matchedKeywords: string[];
  reviewStatus?: "pending" | "approved" | "rejected";
  inference?: {
    modelProvider: string;
    modelName: string;
    assignedRoleSlug: string;
    inferenceSummaryEn: string;
    inferenceSummaryZh?: string | null;
    impactDirection: "increase" | "maintain" | "neutral" | "decrease";
    relevance: "low" | "medium" | "high" | "none";
    signalWeight: number;
    rawJson: Prisma.InputJsonValue;
  };
};

type PersistSignalInput = {
  shouldPersistSignal: boolean;
  roleId: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceType: SourceType;
  signalType: SignalType;
  strength: SignalStrength;
  publishedAt: Date;
  summaryEn: string;
  summaryZh: string;
  rationaleEn: string;
  rationaleZh: string;
};

type PersistSourceItemInput = {
  sourceCatalogId: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceType: SourceType;
  title: string;
  summaryEn: string;
  summaryZh?: string | null;
  publishedAt: Date;
  mappingMode: "observe_only" | "direct_mapped";
  classificationInputHash?: string | null;
  classificationPromptVersion?: string | null;
  classificationModelName?: string | null;
};

type PersistDiscoveryScoringEvidenceInput = {
  roleSlug: string;
  sourceUrl: string;
  title: string;
  summaryEn: string;
  publishedAt: string | null;
  sourceLabel: string;
  relevance: "low" | "medium" | "high";
  signalWeight: number;
  modelProvider?: string | null;
  modelName?: string | null;
  rawJson?: Prisma.InputJsonValue;
};

function toSourceMappingMode(value: PersistSourceItemInput["mappingMode"]): SourceMappingMode {
  return value === "observe_only" ? "OBSERVE_ONLY" : "DIRECT_MAPPED";
}

function toDecisionStatus(value: PersistDecisionInput["status"]): MappingDecisionStatus {
  switch (value) {
    case "accepted":
      return "ACCEPTED";
    case "ambiguous":
      return "AMBIGUOUS";
    default:
      return "UNMATCHED";
  }
}

function toConfidence(value: PersistDecisionInput["confidence"]): CandidateConfidence | null {
  if (!value) return null;
  return value.toUpperCase() as CandidateConfidence;
}

function toReviewStatus(value: NonNullable<PersistDecisionInput["reviewStatus"]>): ReviewStatus {
  return value.toUpperCase() as ReviewStatus;
}

function toImpactDirection(
  value: NonNullable<NonNullable<PersistDecisionInput["inference"]>["impactDirection"]>
) {
  return (value === "neutral" ? "MAINTAIN" : value.toUpperCase()) as
    | "INCREASE"
    | "MAINTAIN"
    | "DECREASE";
}

function toInferenceRelevance(
  value: NonNullable<NonNullable<PersistDecisionInput["inference"]>["relevance"]>
) {
  return (value === "none" ? "LOW" : value.toUpperCase()) as "LOW" | "MEDIUM" | "HIGH";
}

function toOptionalDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDiscoverySourceCatalogId(roleSlug: string) {
  return `discovery-role-search:${roleSlug}`;
}

function toDiscoveryRawJson(input: PersistDiscoveryScoringEvidenceInput) {
  const base = {
    evidenceKind: "role_search",
    provider: input.modelProvider ?? "brave",
    adjudicated: true,
    discoveryScore: input.signalWeight,
    timelineEligible: true,
    scoreEligible: true
  };

  if (input.rawJson && typeof input.rawJson === "object" && !Array.isArray(input.rawJson)) {
    return {
      ...base,
      ...input.rawJson
    };
  }

  return {
    ...base,
    rawJson: input.rawJson ?? null
  };
}

export async function persistSourceItemInference(
  input: NonNullable<PersistDecisionInput["inference"]> & { sourceItemId: string }
) {
  const role = await prisma.role.findUnique({
    where: { slug: input.assignedRoleSlug },
    select: { id: true }
  });

  return prisma.sourceItemInference.upsert({
    where: { sourceItemId: input.sourceItemId },
    create: {
      sourceItemId: input.sourceItemId,
      roleId: role?.id ?? null,
      assignedRoleSlug: input.assignedRoleSlug,
      modelProvider: input.modelProvider,
      modelName: input.modelName,
      inferenceSummaryEn: input.inferenceSummaryEn,
      inferenceSummaryZh: input.inferenceSummaryZh ?? input.inferenceSummaryEn,
      impactDirection: toImpactDirection(input.impactDirection),
      relevance: toInferenceRelevance(input.relevance),
      signalWeight: normalizeStoredSignalWeight(input.signalWeight),
      rawJson: input.rawJson
    },
    update: {
      roleId: role?.id ?? null,
      assignedRoleSlug: input.assignedRoleSlug,
      modelProvider: input.modelProvider,
      modelName: input.modelName,
      inferenceSummaryEn: input.inferenceSummaryEn,
      inferenceSummaryZh: input.inferenceSummaryZh ?? input.inferenceSummaryEn,
      impactDirection: toImpactDirection(input.impactDirection),
      relevance: toInferenceRelevance(input.relevance),
      signalWeight: normalizeStoredSignalWeight(input.signalWeight),
      rawJson: input.rawJson
    }
  });
}

export async function persistSourceItemSignalIfEligible(input: PersistSignalInput) {
  if (!input.shouldPersistSignal) {
    return null;
  }

  return prisma.signal.upsert({
    where: {
      roleId_sourceUrl: {
        roleId: input.roleId,
        sourceUrl: input.sourceUrl
      }
    },
    create: {
      roleId: input.roleId,
      sourceUrl: input.sourceUrl,
      sourceTitle: input.sourceTitle,
      sourceType: input.sourceType,
      signalType: input.signalType,
      strength: input.strength,
      publishedAt: input.publishedAt,
      summaryEn: input.summaryEn,
      summaryZh: input.summaryZh,
      rationaleEn: input.rationaleEn,
      rationaleZh: input.rationaleZh
    },
    update: {
      sourceTitle: input.sourceTitle,
      sourceType: input.sourceType,
      signalType: input.signalType,
      strength: input.strength,
      publishedAt: input.publishedAt,
      summaryEn: input.summaryEn,
      summaryZh: input.summaryZh,
      rationaleEn: input.rationaleEn,
      rationaleZh: input.rationaleZh
    }
  });
}

export async function persistSourceItemDecision(
  sourceItem: PersistSourceItemInput,
  decision: PersistDecisionInput
) {
  const role = decision.primaryRoleSlug
    ? await prisma.role.findUnique({
        where: { slug: decision.primaryRoleSlug },
        select: { id: true }
      })
    : null;

  return prisma.$transaction(async (tx) => {
    const persistedItem = await tx.sourceItem.upsert({
      where: {
        sourceCatalogId_sourceUrl: {
          sourceCatalogId: sourceItem.sourceCatalogId,
          sourceUrl: sourceItem.sourceUrl
        }
      },
      create: {
        sourceCatalogId: sourceItem.sourceCatalogId,
        sourceLabel: sourceItem.sourceLabel,
        sourceUrl: sourceItem.sourceUrl,
        sourceType: sourceItem.sourceType,
        title: sourceItem.title,
        summaryEn: sourceItem.summaryEn,
        summaryZh: sourceItem.summaryZh ?? null,
        publishedAt: sourceItem.publishedAt,
        mappingMode: toSourceMappingMode(sourceItem.mappingMode),
        classificationInputHash: sourceItem.classificationInputHash ?? null,
        classificationPromptVersion: sourceItem.classificationPromptVersion ?? null,
        classificationModelName: sourceItem.classificationModelName ?? null,
        classificationCachedAt:
          sourceItem.classificationInputHash &&
          sourceItem.classificationPromptVersion &&
          sourceItem.classificationModelName
            ? new Date()
            : null
      },
      update: {
        sourceLabel: sourceItem.sourceLabel,
        sourceType: sourceItem.sourceType,
        title: sourceItem.title,
        summaryEn: sourceItem.summaryEn,
        summaryZh: sourceItem.summaryZh ?? null,
        publishedAt: sourceItem.publishedAt,
        mappingMode: toSourceMappingMode(sourceItem.mappingMode),
        classificationInputHash: sourceItem.classificationInputHash ?? null,
        classificationPromptVersion: sourceItem.classificationPromptVersion ?? null,
        classificationModelName: sourceItem.classificationModelName ?? null,
        classificationCachedAt:
          sourceItem.classificationInputHash &&
          sourceItem.classificationPromptVersion &&
          sourceItem.classificationModelName
            ? new Date()
            : null
      }
    });

    const existingDecision = await tx.sourceItemRoleDecision.findUnique({
      where: { sourceItemId: persistedItem.id },
      select: {
        reviewStatus: true,
        reviewedAt: true
      }
    });
    const nextReviewStatus = decision.reviewStatus
      ? toReviewStatus(decision.reviewStatus)
      : existingDecision?.reviewStatus ?? "PENDING";
    const nextReviewedAt = decision.reviewStatus
      ? nextReviewStatus === "PENDING"
        ? null
        : new Date()
      : nextReviewStatus === "PENDING"
        ? null
        : existingDecision?.reviewedAt ?? new Date();

    const persistedDecision = await tx.sourceItemRoleDecision.upsert({
      where: { sourceItemId: persistedItem.id },
      create: {
        sourceItemId: persistedItem.id,
        roleId: role?.id ?? null,
        decisionStatus: toDecisionStatus(decision.status),
        confidence: toConfidence(decision.confidence),
        reason: decision.reason,
        candidateSlugs: decision.candidateSlugs,
        matchedKeywords: decision.matchedKeywords,
        reviewStatus: nextReviewStatus,
        reviewedAt: nextReviewedAt
      },
      update: {
        roleId: role?.id ?? null,
        decisionStatus: toDecisionStatus(decision.status),
        confidence: toConfidence(decision.confidence),
        reason: decision.reason,
        candidateSlugs: decision.candidateSlugs,
        matchedKeywords: decision.matchedKeywords,
        reviewStatus: nextReviewStatus,
        reviewedAt: nextReviewedAt
      }
    });

    const persistedInference = decision.inference
      ? await tx.sourceItemInference.upsert({
          where: { sourceItemId: persistedItem.id },
          create: {
            sourceItemId: persistedItem.id,
            roleId: role?.id ?? null,
            assignedRoleSlug: decision.inference.assignedRoleSlug,
            modelProvider: decision.inference.modelProvider,
            modelName: decision.inference.modelName,
            inferenceSummaryEn: decision.inference.inferenceSummaryEn,
            inferenceSummaryZh:
              decision.inference.inferenceSummaryZh ?? decision.inference.inferenceSummaryEn,
            impactDirection: toImpactDirection(decision.inference.impactDirection),
            relevance: toInferenceRelevance(decision.inference.relevance),
            signalWeight: normalizeStoredSignalWeight(decision.inference.signalWeight),
            rawJson: decision.inference.rawJson
          },
          update: {
            roleId: role?.id ?? null,
            assignedRoleSlug: decision.inference.assignedRoleSlug,
            modelProvider: decision.inference.modelProvider,
            modelName: decision.inference.modelName,
            inferenceSummaryEn: decision.inference.inferenceSummaryEn,
            inferenceSummaryZh:
              decision.inference.inferenceSummaryZh ?? decision.inference.inferenceSummaryEn,
            impactDirection: toImpactDirection(decision.inference.impactDirection),
            relevance: toInferenceRelevance(decision.inference.relevance),
            signalWeight: normalizeStoredSignalWeight(decision.inference.signalWeight),
            rawJson: decision.inference.rawJson
          }
        })
      : null;

    return { sourceItem: persistedItem, decision: persistedDecision, inference: persistedInference };
  });
}

export async function persistDiscoveryScoringEvidence(input: PersistDiscoveryScoringEvidenceInput) {
  const role = await prisma.role.findUnique({
    where: { slug: input.roleSlug },
    select: { id: true }
  });

  const publishedAt = toOptionalDate(input.publishedAt) ?? new Date();
  const sourceCatalogId = getDiscoverySourceCatalogId(input.roleSlug);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const sourceItem = await tx.sourceItem.upsert({
      where: {
        sourceCatalogId_sourceUrl: {
          sourceCatalogId,
          sourceUrl: input.sourceUrl
        }
      },
      create: {
        sourceCatalogId,
        sourceLabel: input.sourceLabel,
        sourceUrl: input.sourceUrl,
        sourceType: "NEWS",
        title: input.title,
        summaryEn: input.summaryEn,
        summaryZh: null,
        publishedAt,
        mappingMode: "DIRECT_MAPPED",
        classificationInputHash: null,
        classificationPromptVersion: null,
        classificationModelName: null,
        classificationCachedAt: null
      },
      update: {
        sourceLabel: input.sourceLabel,
        sourceType: "NEWS",
        title: input.title,
        summaryEn: input.summaryEn,
        summaryZh: null,
        publishedAt,
        mappingMode: "DIRECT_MAPPED",
        classificationInputHash: null,
        classificationPromptVersion: null,
        classificationModelName: null,
        classificationCachedAt: null
      }
    });

    const decision = await tx.sourceItemRoleDecision.upsert({
      where: { sourceItemId: sourceItem.id },
      create: {
        sourceItemId: sourceItem.id,
        roleId: role?.id ?? null,
        decisionStatus: "ACCEPTED",
        confidence: input.relevance === "high" ? "HIGH" : input.relevance === "medium" ? "MEDIUM" : "LOW",
        reason: `Discovery-backed evidence materialized for ${input.roleSlug}.`,
        candidateSlugs: [input.roleSlug],
        matchedKeywords: [],
        reviewStatus: "APPROVED",
        reviewedAt: now
      },
      update: {
        roleId: role?.id ?? null,
        decisionStatus: "ACCEPTED",
        confidence: input.relevance === "high" ? "HIGH" : input.relevance === "medium" ? "MEDIUM" : "LOW",
        reason: `Discovery-backed evidence materialized for ${input.roleSlug}.`,
        candidateSlugs: [input.roleSlug],
        matchedKeywords: [],
        reviewStatus: "APPROVED",
        reviewedAt: now
      }
    });

    const inference = await tx.sourceItemInference.upsert({
      where: { sourceItemId: sourceItem.id },
      create: {
        sourceItemId: sourceItem.id,
        roleId: role?.id ?? null,
        assignedRoleSlug: input.roleSlug,
        modelProvider: input.modelProvider ?? "brave",
        modelName: input.modelName ?? "role-discovery",
        inferenceSummaryEn: input.summaryEn,
        inferenceSummaryZh: input.summaryEn,
        impactDirection: "INCREASE",
        relevance: toInferenceRelevance(input.relevance),
        signalWeight: normalizeStoredSignalWeight(input.signalWeight),
        rawJson: toDiscoveryRawJson(input)
      },
      update: {
        roleId: role?.id ?? null,
        assignedRoleSlug: input.roleSlug,
        modelProvider: input.modelProvider ?? "brave",
        modelName: input.modelName ?? "role-discovery",
        inferenceSummaryEn: input.summaryEn,
        inferenceSummaryZh: input.summaryEn,
        impactDirection: "INCREASE",
        relevance: toInferenceRelevance(input.relevance),
        signalWeight: normalizeStoredSignalWeight(input.signalWeight),
        rawJson: toDiscoveryRawJson(input)
      }
    });

    return { sourceItem, decision, inference };
  });
}

export async function findStoredSourceItemByCatalogUrl(sourceCatalogId: string, sourceUrl: string) {
  return prisma.sourceItem.findUnique({
    where: {
      sourceCatalogId_sourceUrl: {
        sourceCatalogId,
        sourceUrl
      }
    },
    include: {
      inference: true,
      decisions: true
    }
  });
}

export async function listApprovedSourceItemsForRole(roleSlug: string, limit = 10) {
  const items = await prisma.sourceItemRoleDecision.findMany({
    where: {
      decisionStatus: "ACCEPTED",
      NOT: {
        sourceItem: {
          sourceUrl: {
            contains: "example.com"
          }
        }
      },
      role: { slug: roleSlug }
    },
    include: {
      role: {
        select: {
          slug: true,
          nameEn: true,
          nameZh: true
        }
      },
      sourceItem: {
        include: {
          inference: true
        }
      }
    },
    orderBy: {
      sourceItem: {
        publishedAt: "desc"
      }
    },
    take: limit
  });

  return items.map((item) => ({
    id: item.id,
    roleSlug: item.role?.slug ?? null,
    roleNameEn: item.role?.nameEn ?? null,
    roleNameZh: item.role?.nameZh ?? null,
    reviewStatus: item.reviewStatus,
    title: item.sourceItem.title,
    sourceUrl: item.sourceItem.sourceUrl,
    sourceCatalogId: item.sourceItem.sourceCatalogId,
    sourceLabel: item.sourceItem.sourceLabel,
    sourceType: item.sourceItem.sourceType,
    summaryEn: item.sourceItem.summaryEn,
    summaryZh: item.sourceItem.summaryZh,
    publishedAt: item.sourceItem.publishedAt.toISOString(),
    reason: item.reason,
    sourceHost: getSourceHost(item.sourceItem.sourceUrl),
    modelProvider: item.sourceItem.inference?.modelProvider ?? null,
    modelName: item.sourceItem.inference?.modelName ?? null,
    assignedRoleSlug: item.sourceItem.inference?.assignedRoleSlug ?? null,
    inferenceSummaryEn: item.sourceItem.inference?.inferenceSummaryEn ?? null,
    inferenceSummaryZh: item.sourceItem.inference?.inferenceSummaryZh ?? null,
    impactDirection: item.sourceItem.inference?.impactDirection ?? null,
    relevance: item.sourceItem.inference?.relevance ?? null,
    signalWeight: item.sourceItem.inference?.signalWeight ?? null
  }));
}

export async function listPendingReviewDecisions(limit = 20) {
  const items = await prisma.sourceItemRoleDecision.findMany({
    where: {
      reviewStatus: "PENDING",
      roleId: { not: null },
      decisionStatus: "ACCEPTED"
    },
    include: {
      role: {
        select: {
          slug: true,
          nameEn: true,
          nameZh: true
        }
      },
      sourceItem: {
        include: {
          inference: true
        }
      }
    },
    orderBy: {
      sourceItem: {
        publishedAt: "desc"
      }
    },
    take: limit
  });

  return items.map((item) => ({
    id: item.id,
    sourceItemId: item.sourceItemId,
    sourceTitle: item.sourceItem.title,
    sourceUrl: item.sourceItem.sourceUrl,
    sourceCatalogId: item.sourceItem.sourceCatalogId,
    sourceLabel: item.sourceItem.sourceLabel,
    sourceType: item.sourceItem.sourceType,
    summaryEn: item.sourceItem.summaryEn,
    summaryZh: item.sourceItem.summaryZh,
    publishedAt: item.sourceItem.publishedAt.toISOString(),
    reviewStatus: item.reviewStatus as ReviewStatus,
    decisionStatus: item.decisionStatus as MappingDecisionStatus,
    confidence: item.confidence,
    reason: item.reason,
    candidateSlugs: Array.isArray(item.candidateSlugs) ? item.candidateSlugs : [],
    matchedKeywords: Array.isArray(item.matchedKeywords) ? item.matchedKeywords : [],
    roleSlug: item.role?.slug ?? item.sourceItem.inference?.assignedRoleSlug ?? null,
    roleNameEn: item.role?.nameEn ?? null,
    roleNameZh: item.role?.nameZh ?? null,
    sourceHost: getSourceHost(item.sourceItem.sourceUrl),
    modelProvider: item.sourceItem.inference?.modelProvider ?? null,
    modelName: item.sourceItem.inference?.modelName ?? null,
    inferenceSummaryEn: item.sourceItem.inference?.inferenceSummaryEn ?? null,
    inferenceSummaryZh: item.sourceItem.inference?.inferenceSummaryZh ?? null,
    impactDirection: item.sourceItem.inference?.impactDirection ?? null,
    relevance: item.sourceItem.inference?.relevance ?? null,
    signalWeight: item.sourceItem.inference?.signalWeight ?? null
  }));
}

export async function listInferenceDiagnostics(limit = 20) {
  const items = await prisma.sourceItemRoleDecision.findMany({
    where: {
      sourceItem: {
        inference: {
          isNot: null
        }
      }
    },
    include: {
      role: {
        select: {
          slug: true,
          nameEn: true,
          nameZh: true
        }
      },
      sourceItem: {
        include: {
          inference: true
        }
      }
    },
    orderBy: {
      sourceItem: {
        publishedAt: "desc"
      }
    },
    take: limit
  });

  return items.map((item) => ({
    id: item.id,
    sourceTitle: item.sourceItem.title,
    sourceLabel: item.sourceItem.sourceLabel,
    sourceUrl: item.sourceItem.sourceUrl,
    sourceType: item.sourceItem.sourceType,
    summaryEn: item.sourceItem.summaryEn,
    summaryZh: item.sourceItem.summaryZh,
    publishedAt: item.sourceItem.publishedAt.toISOString(),
    decisionStatus: item.decisionStatus as MappingDecisionStatus,
    reviewStatus: item.reviewStatus as ReviewStatus,
    reason: item.reason,
    roleSlug: item.role?.slug ?? item.sourceItem.inference?.assignedRoleSlug ?? null,
    roleNameEn: item.role?.nameEn ?? null,
    roleNameZh: item.role?.nameZh ?? null,
    sourceHost: getSourceHost(item.sourceItem.sourceUrl),
    modelProvider: item.sourceItem.inference?.modelProvider ?? null,
    modelName: item.sourceItem.inference?.modelName ?? null,
    inferenceSummaryEn: item.sourceItem.inference?.inferenceSummaryEn ?? null,
    inferenceSummaryZh: item.sourceItem.inference?.inferenceSummaryZh ?? null,
    impactDirection: item.sourceItem.inference?.impactDirection ?? null,
    relevance: item.sourceItem.inference?.relevance ?? null,
    signalWeight: item.sourceItem.inference?.signalWeight ?? null
  }));
}

export async function listRecentApprovedSourceItems(limit = 6) {
  const items = await prisma.sourceItemRoleDecision.findMany({
    where: {
      decisionStatus: "ACCEPTED",
      NOT: {
        sourceItem: {
          sourceUrl: {
            contains: "example.com"
          }
        }
      },
      OR: [
        { roleId: { not: null } },
        {
          sourceItem: {
            inference: {
              isNot: null
            }
          }
        }
      ]
    },
    include: {
      role: {
        select: {
          slug: true,
          nameEn: true,
          nameZh: true
        }
      },
      sourceItem: {
        include: {
          inference: true
        }
      }
    },
    orderBy: {
      sourceItem: {
        publishedAt: "desc"
      }
    },
    take: limit
  });

  return items.map((item) => ({
    id: item.id,
    roleSlug: item.role?.slug ?? null,
    roleNameEn: item.role?.nameEn ?? null,
    roleNameZh: item.role?.nameZh ?? null,
    sourceTitle: item.sourceItem.title,
    sourceLabel: item.sourceItem.sourceLabel,
    sourceHost: getSourceHost(item.sourceItem.sourceUrl),
    sourceUrl: item.sourceItem.sourceUrl,
    sourceType: item.sourceItem.sourceType,
    summaryEn: item.sourceItem.summaryEn,
    summaryZh: item.sourceItem.summaryZh,
    rationaleEn: item.reason,
    rationaleZh: item.reason,
    publishedAt: item.sourceItem.publishedAt,
    modelProvider: item.sourceItem.inference?.modelProvider ?? null,
    modelName: item.sourceItem.inference?.modelName ?? null,
    impactDirection: item.sourceItem.inference?.impactDirection ?? null,
    relevance: item.sourceItem.inference?.relevance ?? null,
    signalWeight: item.sourceItem.inference?.signalWeight ?? null
  }));
}

export async function listTimelineSourceItemsForRoleSlug(roleSlug: string, limit = 10) {
  return listTimelineSourceItemsForRoleSlugSince(roleSlug, null, limit);
}

export async function listTimelineSourceItemsForRoleSlugSince(
  roleSlug: string,
  since: Date | null,
  limit = 10
) {
  const items = await prisma.sourceItem.findMany({
    where: {
      NOT: {
        sourceUrl: {
          contains: "example.com"
        }
      },
      ...(since
        ? {
            publishedAt: {
              gt: since
            }
          }
        : {}),
      OR: [
        {
          decisions: {
            some: {
              decisionStatus: "ACCEPTED",
              role: {
                slug: roleSlug
              }
            }
          }
        },
        {
          inference: {
            assignedRoleSlug: roleSlug
          },
          decisions: {
            some: {
              decisionStatus: "ACCEPTED"
            }
          }
        }
      ]
    },
    include: {
      inference: true,
      decisions: {
        where: {
          decisionStatus: "ACCEPTED"
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    },
    orderBy: {
      publishedAt: "desc"
    },
    take: limit
  });

  return items.map((item) => ({
    id: item.id,
    sourceTitle: item.title,
    sourceUrl: item.sourceUrl,
    sourceType: item.sourceType,
    sourceLabel: item.sourceLabel,
    sourceHost: getSourceHost(item.sourceUrl),
    summaryEn: item.inference?.inferenceSummaryEn ?? item.summaryEn,
    summaryZh: item.inference?.inferenceSummaryZh ?? item.summaryZh ?? item.summaryEn,
    rationaleEn: item.decisions[0]?.reason ?? item.inference?.inferenceSummaryEn ?? item.summaryEn,
    rationaleZh:
      item.inference?.inferenceSummaryZh ??
      item.decisions[0]?.reason ??
      item.summaryZh ??
      item.summaryEn,
    publishedAt: item.publishedAt
  })).filter((item) => isPublicSourceUrl(item.sourceUrl));
}
