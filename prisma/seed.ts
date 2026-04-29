import { Prisma, PrismaClient } from "@prisma/client";
import {
  demoRoleRiskSnapshots,
  demoRoles,
  demoSignals,
  demoSourceItemDecisions,
  demoSourceItems
} from "./seed-data";
import { getSeedOptions } from "./seed-options";
import { importRoleDictionary } from "./import-role-dictionary";

const prisma = new PrismaClient();

function toNullableJson(value: unknown) {
  return value ?? Prisma.DbNull;
}

async function main() {
  const seedOptions = getSeedOptions();

  await importRoleDictionary(prisma);

  await prisma.notificationDispatch.deleteMany();
  await prisma.watchSubscription.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.emailVerificationChallenge.deleteMany();

  if (seedOptions.resetIngestData) {
    await prisma.sourceItemInference.deleteMany();
    await prisma.sourceItemRoleDecision.deleteMany();
    await prisma.sourceItem.deleteMany();
    await prisma.signal.deleteMany();
  }

  for (const role of demoRoles) {
    const dictionaryRole = await prisma.roleDictionary.findUnique({
      where: { slug: role.dictionaryRoleSlug },
      select: { id: true }
    });

    if (!dictionaryRole) {
      throw new Error(`Cannot seed role without dictionary entry: ${role.dictionaryRoleSlug}`);
    }

    await prisma.role.upsert({
      where: { slug: role.slug },
      create: {
        id: role.id,
        dictionaryRoleId: dictionaryRole.id,
        slug: role.slug,
        socCode: role.socCode ?? null,
        nameEn: role.nameEn,
        nameZh: role.nameZh,
        summaryEn: role.summaryEn,
        summaryZh: role.summaryZh,
        riskLevel: role.riskLevel,
        replacementRate: role.replacementRate,
        riskSummaryEn: role.riskSummaryEn,
        riskSummaryZh: role.riskSummaryZh,
        riskReasons: toNullableJson(role.riskReasons),
        riskModelProvider: role.replacementRate ? "google" : null,
        riskModelName: role.replacementRate ? "gemini-2.5-flash" : null,
        riskInferenceRaw:
          role.replacementRate && role.riskSummaryEn && role.riskReasons
            ? {
                replacementRate: role.replacementRate,
                riskBand: role.riskLevel.toLowerCase(),
                summaryEn: role.riskSummaryEn,
                summaryZh: role.riskSummaryZh,
                reasons: role.riskReasons
              }
            : Prisma.DbNull,
        ratingStatus: role.ratingStatus,
        lastRatedAt: new Date(role.lastRatedAt),
        repetitionScore: role.repetitionScore,
        ruleClarityScore: role.ruleClarityScore,
        transformationScore: role.transformationScore,
        workflowAutomationScore: role.workflowAutomationScore,
        interpersonalScore: role.interpersonalScore,
        physicalityScore: role.physicalityScore,
        ambiguityScore: role.ambiguityScore
      },
      update: {
        dictionaryRoleId: dictionaryRole.id,
        socCode: role.socCode ?? null,
        nameEn: role.nameEn,
        nameZh: role.nameZh,
        summaryEn: role.summaryEn,
        summaryZh: role.summaryZh,
        riskLevel: role.riskLevel,
        replacementRate: role.replacementRate,
        riskSummaryEn: role.riskSummaryEn,
        riskSummaryZh: role.riskSummaryZh,
        riskReasons: toNullableJson(role.riskReasons),
        riskModelProvider: role.replacementRate ? "google" : null,
        riskModelName: role.replacementRate ? "gemini-2.5-flash" : null,
        riskInferenceRaw:
          role.replacementRate && role.riskSummaryEn && role.riskReasons
            ? {
                replacementRate: role.replacementRate,
                riskBand: role.riskLevel.toLowerCase(),
                summaryEn: role.riskSummaryEn,
                summaryZh: role.riskSummaryZh,
                reasons: role.riskReasons
              }
            : Prisma.DbNull,
        ratingStatus: role.ratingStatus,
        lastRatedAt: new Date(role.lastRatedAt),
        repetitionScore: role.repetitionScore,
        ruleClarityScore: role.ruleClarityScore,
        transformationScore: role.transformationScore,
        workflowAutomationScore: role.workflowAutomationScore,
        interpersonalScore: role.interpersonalScore,
        physicalityScore: role.physicalityScore,
        ambiguityScore: role.ambiguityScore
      }
    });
  }

  for (const snapshot of demoRoleRiskSnapshots) {
    const role = await prisma.role.findUnique({
      where: { slug: snapshot.roleSlug }
    });

    if (!role) {
      throw new Error(`Cannot seed role risk snapshot without role: ${snapshot.roleSlug}`);
    }

    await prisma.roleRiskSnapshot.upsert({
      where: {
        roleId_snapshotAt: {
          roleId: role.id,
          snapshotAt: new Date(snapshot.snapshotAt)
        }
      },
      create: {
        roleId: role.id,
        snapshotAt: new Date(snapshot.snapshotAt),
        replacementRate: snapshot.replacementRate,
        riskLevel: snapshot.riskLevel,
        ratingStatus: snapshot.ratingStatus,
        wasRecomputed: snapshot.wasRecomputed,
        source: snapshot.source
      },
      update: {
        replacementRate: snapshot.replacementRate,
        riskLevel: snapshot.riskLevel,
        ratingStatus: snapshot.ratingStatus,
        wasRecomputed: snapshot.wasRecomputed,
        source: snapshot.source
      }
    });
  }

  for (const signal of demoSignals) {
    const role = await prisma.role.findUnique({
      where: { slug: signal.roleSlug }
    });

    if (!role) {
      throw new Error(`Cannot seed signal without role: ${signal.roleSlug}`);
    }

    await prisma.signal.upsert({
      where: {
        roleId_sourceUrl: {
          roleId: role.id,
          sourceUrl: signal.sourceUrl
        }
      },
      create: {
        id: signal.id,
        roleId: role.id,
        sourceUrl: signal.sourceUrl,
        sourceTitle: signal.sourceTitle,
        sourceType: signal.sourceType,
        signalType: signal.signalType,
        strength: signal.strength,
        publishedAt: new Date(signal.publishedAt),
        summaryEn: signal.summaryEn,
        summaryZh: signal.summaryZh,
        rationaleEn: signal.rationaleEn,
        rationaleZh: signal.rationaleZh
      },
      update: {
        sourceTitle: signal.sourceTitle,
        sourceType: signal.sourceType,
        signalType: signal.signalType,
        strength: signal.strength,
        publishedAt: new Date(signal.publishedAt),
        summaryEn: signal.summaryEn,
        summaryZh: signal.summaryZh,
        rationaleEn: signal.rationaleEn,
        rationaleZh: signal.rationaleZh
      }
    });
  }

  for (const sourceItem of demoSourceItems) {
    await prisma.sourceItem.upsert({
      where: {
        sourceCatalogId_sourceUrl: {
          sourceCatalogId: sourceItem.sourceCatalogId,
          sourceUrl: sourceItem.sourceUrl
        }
      },
      create: {
        id: sourceItem.id,
        sourceCatalogId: sourceItem.sourceCatalogId,
        sourceLabel: sourceItem.sourceLabel,
        sourceUrl: sourceItem.sourceUrl,
        sourceType: sourceItem.sourceType,
        title: sourceItem.title,
        summaryEn: sourceItem.summaryEn,
        summaryZh: sourceItem.summaryZh,
        publishedAt: new Date(sourceItem.publishedAt),
        mappingMode: sourceItem.mappingMode
      },
      update: {
        sourceLabel: sourceItem.sourceLabel,
        sourceType: sourceItem.sourceType,
        title: sourceItem.title,
        summaryEn: sourceItem.summaryEn,
        summaryZh: sourceItem.summaryZh,
        publishedAt: new Date(sourceItem.publishedAt),
        mappingMode: sourceItem.mappingMode
      }
    });
  }

  for (const decision of demoSourceItemDecisions) {
    const sourceItem = await prisma.sourceItem.findUnique({
      where: { id: decision.sourceItemId }
    });

    if (!sourceItem) {
      throw new Error(`Cannot seed source item decision without source item: ${decision.sourceItemId}`);
    }

    const role = await prisma.role.findUnique({
      where: { slug: decision.roleSlug }
    });

    if (!role) {
      throw new Error(`Cannot seed source item decision without role: ${decision.roleSlug}`);
    }

    await prisma.sourceItemRoleDecision.upsert({
      where: { sourceItemId: sourceItem.id },
      create: {
        id: decision.id,
        sourceItemId: sourceItem.id,
        roleId: role.id,
        decisionStatus: decision.decisionStatus,
        confidence: decision.confidence,
        reason: decision.reason,
        candidateSlugs: decision.candidateSlugs,
        matchedKeywords: decision.matchedKeywords,
        reviewStatus: decision.reviewStatus,
        reviewedAt: decision.reviewedAt ? new Date(decision.reviewedAt) : null
      },
      update: {
        roleId: role.id,
        decisionStatus: decision.decisionStatus,
        confidence: decision.confidence,
        reason: decision.reason,
        candidateSlugs: decision.candidateSlugs,
        matchedKeywords: decision.matchedKeywords,
        reviewStatus: decision.reviewStatus,
        reviewedAt: decision.reviewedAt ? new Date(decision.reviewedAt) : null
      }
    });

    await prisma.sourceItemInference.upsert({
      where: { sourceItemId: sourceItem.id },
      create: {
        sourceItemId: sourceItem.id,
        roleId: role.id,
        assignedRoleSlug: decision.assignedRoleSlug,
        modelProvider: decision.modelProvider,
        modelName: decision.modelName,
        inferenceSummaryEn: decision.inferenceSummaryEn,
        inferenceSummaryZh: decision.inferenceSummaryZh,
        impactDirection: decision.impactDirection,
        relevance: decision.relevance,
        signalWeight: decision.signalWeight,
        rawJson: decision.rawJson
      },
      update: {
        roleId: role.id,
        assignedRoleSlug: decision.assignedRoleSlug,
        modelProvider: decision.modelProvider,
        modelName: decision.modelName,
        inferenceSummaryEn: decision.inferenceSummaryEn,
        inferenceSummaryZh: decision.inferenceSummaryZh,
        impactDirection: decision.impactDirection,
        relevance: decision.relevance,
        signalWeight: decision.signalWeight,
        rawJson: decision.rawJson
      }
    });
  }

  console.log(
    seedOptions.resetIngestData
      ? "Seeded Role Radar demo data and reset ingested source data"
      : "Seeded Role Radar demo data without clearing ingested source data"
  );
}

main().finally(async () => {
  await prisma.$disconnect();
});
