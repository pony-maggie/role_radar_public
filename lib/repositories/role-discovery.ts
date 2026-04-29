import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

type SearchHitInput = {
  rank: number;
  sourceUrl: string;
  title: string;
  snippet: string;
  publishedAt?: string | null;
  rawPayload?: Prisma.InputJsonValue;
};

type SearchQueryRunInput = {
  roleSlug: string;
  provider: string;
  queryText: string;
  queryHash: string;
  status: string;
  expiresAt: Date;
  hits: SearchHitInput[];
};

type RoleEvidenceCandidateInput = {
  roleSlug: string;
  sourceUrl: string;
  title: string;
  snippet: string;
  sourceLabel?: string | null;
  evidenceKind: string;
  timelineEligible: boolean;
  scoreEligible: boolean;
  attributionConfidence?: number | null;
  modelProvider?: string | null;
  modelName?: string | null;
  rawJson?: Prisma.InputJsonValue;
};

function toOptionalDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function upsertSearchQueryRun(input: SearchQueryRunInput) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.searchQueryRun.upsert({
      where: {
        queryHash: input.queryHash
      },
      create: {
        roleSlug: input.roleSlug,
        provider: input.provider,
        queryText: input.queryText,
        queryHash: input.queryHash,
        status: input.status,
        expiresAt: input.expiresAt
      },
      update: {
        roleSlug: input.roleSlug,
        provider: input.provider,
        queryText: input.queryText,
        status: input.status,
        searchedAt: new Date(),
        expiresAt: input.expiresAt
      }
    });

    await tx.searchHit.deleteMany({
      where: {
        runId: run.id
      }
    });

    if (input.hits.length > 0) {
      await tx.searchHit.createMany({
        data: input.hits.map((hit) => ({
          runId: run.id,
          rank: hit.rank,
          sourceUrl: hit.sourceUrl,
          title: hit.title,
          snippet: hit.snippet,
          publishedAt: toOptionalDate(hit.publishedAt),
          rawPayload: hit.rawPayload
        }))
      });
    }

    return run;
  });
}

export async function listSearchHitsForRun(runId: string) {
  return prisma.searchHit.findMany({
    where: {
      runId
    },
    orderBy: {
      rank: "asc"
    }
  });
}

export async function findFreshSearchQueryRunByHash(queryHash: string, now = new Date()) {
  return prisma.searchQueryRun.findUnique({
    where: {
      queryHash
    },
    select: {
      id: true,
      roleSlug: true,
      provider: true,
      queryText: true,
      queryHash: true,
      status: true,
      expiresAt: true
    }
  }).then((run) => {
    if (!run) return null;
    return run.expiresAt.getTime() > now.getTime() ? run : null;
  });
}

export async function upsertRoleEvidenceCandidate(input: RoleEvidenceCandidateInput) {
  return prisma.roleEvidenceCandidate.upsert({
    where: {
      roleSlug_sourceUrl: {
        roleSlug: input.roleSlug,
        sourceUrl: input.sourceUrl
      }
    },
    create: {
      roleSlug: input.roleSlug,
      sourceUrl: input.sourceUrl,
      title: input.title,
      snippet: input.snippet,
      sourceLabel: input.sourceLabel ?? null,
      evidenceKind: input.evidenceKind,
      timelineEligible: input.timelineEligible,
      scoreEligible: input.scoreEligible,
      attributionConfidence: input.attributionConfidence ?? null,
      modelProvider: input.modelProvider ?? null,
      modelName: input.modelName ?? null,
      rawJson: input.rawJson
    },
    update: {
      title: input.title,
      snippet: input.snippet,
      sourceLabel: input.sourceLabel ?? null,
      evidenceKind: input.evidenceKind,
      timelineEligible: input.timelineEligible,
      scoreEligible: input.scoreEligible,
      attributionConfidence: input.attributionConfidence ?? null,
      modelProvider: input.modelProvider ?? null,
      modelName: input.modelName ?? null,
      rawJson: input.rawJson
    }
  });
}

export async function listRoleEvidenceTimeline(roleSlug: string, limit = 10) {
  return prisma.roleEvidenceCandidate.findMany({
    where: {
      roleSlug,
      timelineEligible: true
    },
    orderBy: [
      {
        updatedAt: "desc"
      },
      {
        createdAt: "desc"
      }
    ],
    take: limit
  });
}
