import "@/lib/runtime/load-env";
import {
  buildSourceClassificationCacheModelName,
  buildSourceClassificationContext,
  classifySourceItem,
  hasUsableSourceClassificationCache
} from "@/lib/ai/classify-source-item";
import { buildSourceClassificationInputHash } from "@/lib/ai/cache-keys";
import { prisma } from "@/lib/db/prisma";
import { canonicalizeSourceUrl } from "@/lib/ingest/canonicalize-source-url";
import { normalizeSignalPolicy } from "@/lib/ingest/classify-signal";
import { fetchSearchDiscoveryItems } from "@/lib/ingest/fetch-search-discovery";
import { deriveItemStrategy } from "@/lib/ingest/item-strategy";
import { normalizeItem } from "@/lib/ingest/normalize-item";
import { discoveryCatalog } from "@/lib/ingest/search-discovery-catalog";
import { fetchCatalogSourceItems, listConfiguredSources } from "@/lib/ingest/source-loader";
import type { RawSourceItem, SourceCatalogEntry } from "@/lib/ingest/source-types";
import { logger } from "@/lib/logging/logger";
import { refreshRoleRisk } from "@/lib/repositories/risk-refresh";
import {
  findStoredSourceItemByCatalogUrl,
  persistSourceItemDecision,
  persistSourceItemSignalIfEligible
} from "@/lib/repositories/source-items";

function getSafeChineseSummaryFallback() {
  return "该信号尚未提供中文摘要。";
}

function getSafeChineseRationaleFallback(sourceLabel: string, sourceClass: string) {
  return `${sourceLabel} 提供了一条 ${sourceClass} 信号，但尚未提供中文说明。`;
}

function describeSource(source: {
  id: string;
  class: string;
  transport: string;
  tier: string;
  enabledByDefault: boolean;
  mappingMode: string;
  maxItems?: number;
}) {
  const trust =
    source.class === "official" ? "high" : source.class === "media" ? "medium" : "auxiliary";
  const value =
    source.class === "official"
      ? "capability_update"
      : source.class === "jobs"
        ? "hiring_shift"
        : "adoption_case";
  return [
    `id=${source.id}`,
    `class=${source.class}`,
    `trust=${trust}`,
    `value=${value}`,
    `transport=${source.transport}`,
    `tier=${source.tier}`,
    `enabled=${source.enabledByDefault}`,
    `mode=${source.mappingMode}`,
    `cap=${source.maxItems ?? "default"}`
  ].join(" ");
}

type DictionaryRoleContext = {
  slug: string;
  nameEn: string;
  nameZh: string;
  keywords: string[];
};

type ClassifiedDecision = Awaited<ReturnType<typeof classifySourceItem>>;
type ProcessableSource = Pick<
  SourceCatalogEntry,
  | "id"
  | "label"
  | "class"
  | "transport"
  | "tier"
  | "enabledByDefault"
  | "mappingMode"
  | "sourceType"
  | "roleSlug"
>;

function getCanonicalSourceUrl(sourceUrl: string) {
  try {
    return canonicalizeSourceUrl(sourceUrl);
  } catch {
    return sourceUrl;
  }
}

export function normalizeAndDedupeItems(
  rawItems: RawSourceItem[],
  seenCanonicalSourceUrls: Set<string>,
  options: { canonicalizeForStorage: boolean }
) {
  const items = [...new Map(
    rawItems.map((item) => {
      const canonicalSourceUrl = getCanonicalSourceUrl(item.sourceUrl);
      return [
        canonicalSourceUrl,
        {
          ...item,
          sourceUrl: options.canonicalizeForStorage ? canonicalSourceUrl : item.sourceUrl
        }
      ] as const;
    })
  ).values()]
    .map((item) => normalizeItem(item))
    .filter((item) => {
      const canonicalSourceUrl = getCanonicalSourceUrl(item.sourceUrl);
      if (seenCanonicalSourceUrls.has(canonicalSourceUrl)) {
        return false;
      }
      seenCanonicalSourceUrls.add(canonicalSourceUrl);
      return true;
    });

  return items;
}

function toDiscoverySource(site: (typeof discoveryCatalog)[number]): ProcessableSource {
  return {
    id: site.id,
    label: site.label,
    class: "media",
    transport: "html",
    tier: "manual_html",
    enabledByDefault: false,
    mappingMode: "observe_only",
    sourceType: site.sourceType
  };
}

export function resolveIngestTargets(
  sourceIds: string[],
  options: { includeManual?: boolean } = {}
) {
  const requestedIds = [...new Set(sourceIds)];
  const primarySources = listConfiguredSources({
    includeManual: options.includeManual,
    ids: requestedIds.length ? requestedIds : undefined
  });
  const discoverySites = requestedIds.length
    ? discoveryCatalog.filter((site) => requestedIds.includes(site.id))
    : discoveryCatalog;

  if (requestedIds.length > 0) {
    const knownIds = new Set([
      ...primarySources.map((source) => source.id),
      ...discoverySites.map((site) => site.id)
    ]);
    const missingIds = requestedIds.filter((id) => !knownIds.has(id));
    if (missingIds.length > 0) {
      throw new Error(`Unknown source id(s): ${missingIds.join(", ")}`);
    }
  }

  return { primarySources, discoverySites };
}

async function summarizeGeminiMappings(
  items: Array<{
    sourceCatalogId: string;
    sourceUrl: string;
    sourceLabel: string;
    sourceType: string;
    title: string;
    summary: string;
  }>,
  roles: DictionaryRoleContext[],
  sourceFallbackRoleSlug?: string,
  options: { allowGemini?: boolean } = {}
) {
  const acceptedCounts = new Map<string, number>();
  let accepted = 0;
  let unmatched = 0;
  let cached = 0;
  let wouldClassify = 0;
  const preview: string[] = [];
  const decisions: ClassifiedDecision[] = [];
  const allowGemini = options.allowGemini ?? true;

  for (const item of items) {
    const context = buildSourceClassificationContext(item, roles);
    const cachedEntry = await findStoredSourceItemByCatalogUrl(item.sourceCatalogId, item.sourceUrl);
    const cacheHit = hasUsableSourceClassificationCache(cachedEntry, context);

    if (!allowGemini && !cacheHit) {
      wouldClassify += 1;
      if (preview.length < 3) {
        preview.push(`would_classify:none:No reusable cached Gemini classification exists yet.:${item.title}`);
      }
      continue;
    }

    let decision: ClassifiedDecision;
    try {
      decision = await classifySourceItem(item, roles, undefined, {
        cachedEntry,
        context
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      decision = {
        assignedRoleSlug: sourceFallbackRoleSlug ?? null,
        sourceKind:
          item.sourceType === "JOB_POSTING"
            ? "jobs"
            : item.sourceType === "COMPANY_UPDATE" || item.sourceType === "BLOG"
              ? "official"
              : "media",
        signalType: sourceFallbackRoleSlug ? "hiring_shift" : "ecosystem_context",
        relevance: sourceFallbackRoleSlug ? "low" : "none",
        impactDirection: "neutral",
        explanation: `Classification fallback used because Gemini was unavailable or returned an error: ${message}`,
        summaryEn:
          "The source was fetched successfully, but model classification was temporarily unavailable, so the item was kept conservatively.",
        summaryZh: "来源已抓取成功，但模型分类暂时不可用，因此该条目被保守处理。",
        signalWeight: "supporting",
        modelProvider: "fallback",
        modelName: "classification-fallback"
      };
    }
    decisions.push(decision);
    const assignedRoleSlug = decision.assignedRoleSlug ?? sourceFallbackRoleSlug ?? null;
    if (cacheHit) {
      cached += 1;
    }

    if (assignedRoleSlug) {
      accepted += 1;
      acceptedCounts.set(assignedRoleSlug, (acceptedCounts.get(assignedRoleSlug) ?? 0) + 1);
      if (preview.length < 3) {
        preview.push(`${cacheHit ? "cached" : "accepted"}:${assignedRoleSlug}:${decision.explanation}:${item.title}`);
      }
      continue;
    }

    unmatched += 1;
    if (preview.length < 3) {
      preview.push(`${cacheHit ? "cached" : "unmatched"}:none:${decision.explanation}:${item.title}`);
    }
  }

  const candidateSummary = [...acceptedCounts.entries()]
    .map(([roleSlug, count]) => `${roleSlug}=${count}`)
    .join(", ");

  return {
    accepted,
    candidateSummary,
    cached,
    decisions,
    preview,
    unmatched,
    wouldClassify
  };
}

type RunSourceIngestOptions = {
  argv?: string[];
};

export async function runSourceIngest(options: RunSourceIngestOptions = {}) {
  const rawArgv = options.argv ?? process.argv.slice(2);
  const argv = new Set(rawArgv);
  const dryRun = argv.has("--dry-run");
  const withGemini = argv.has("--with-gemini");
  const includeManual = argv.has("--include-manual");
  const listOnly = argv.has("--list");
  const sourceIds = rawArgv
    .filter((arg) => arg.startsWith("--source="))
    .flatMap((arg) => arg.slice("--source=".length).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const { primarySources: sources, discoverySites } = resolveIngestTargets(sourceIds, {
    includeManual
  });
  const roles = await prisma.roleDictionary.findMany({
    where: { isActive: true },
    select: {
      slug: true,
      nameEn: true,
      nameZh: true,
      keywords: true
    }
  });
  const roleContexts: DictionaryRoleContext[] = roles.map((role) => ({
    slug: role.slug,
    nameEn: role.nameEn,
    nameZh: role.nameZh,
    keywords: Array.isArray(role.keywords)
      ? role.keywords.filter((v): v is string => typeof v === "string")
      : []
  }));

  if (listOnly) {
    for (const source of sources) {
      logger.info(`[source] ${describeSource(source)}`);
    }
    for (const site of discoverySites) {
      logger.info(`[source] ${describeSource(toDiscoverySource(site))}`);
    }
    return;
  }

  let fetchedCount = 0;
  let persistedCount = 0;
  let failedSources = 0;
  let observedCount = 0;
  let reviewQueuedCount = 0;
  const affectedRoleSlugs = new Set<string>();
  const seenCanonicalSourceUrls = new Set<string>();

  async function processFetchedItems(source: ProcessableSource, rawItems: RawSourceItem[]) {
    const normalizedItems = normalizeAndDedupeItems(rawItems, seenCanonicalSourceUrls, {
      canonicalizeForStorage: source.id.startsWith("discovery-")
    });
    fetchedCount += normalizedItems.length;

    if (dryRun) {
      const summary = await summarizeGeminiMappings(
        normalizedItems,
        roleContexts,
        source.mappingMode === "direct_mapped" ? source.roleSlug : undefined,
        { allowGemini: withGemini }
      );
      logger.info(
        `[dry-run] ${describeSource(source)} fetched=${normalizedItems.length} cached=${summary.cached} would_classify=${summary.wouldClassify} accepted=${summary.accepted} unmatched=${summary.unmatched} candidates=${summary.candidateSummary || "none"}`
      );
      for (const previewLine of summary.preview) {
        logger.info(`[dry-run:item] ${source.id}: ${previewLine}`);
      }
      return;
    }

    const summary = await summarizeGeminiMappings(
      normalizedItems,
      roleContexts,
      source.mappingMode === "direct_mapped" ? source.roleSlug : undefined
    );

    for (let index = 0; index < normalizedItems.length; index += 1) {
      const item = normalizedItems[index];
      const classification = summary.decisions[index];
      const classificationContext = buildSourceClassificationContext(item, roleContexts);
      const classificationCacheModelName =
        classification?.modelProvider && classification?.modelName
          ? buildSourceClassificationCacheModelName(
              classification.modelProvider,
              classification.modelName
            )
          : classificationContext.modelName;
      const classificationCacheInputHash =
        classification?.modelProvider && classification?.modelName
          ? buildSourceClassificationInputHash({
              sourceCatalogId: item.sourceCatalogId,
              sourceUrl: item.sourceUrl,
              sourceType: item.sourceType,
              title: item.title,
              summaryEn: item.summary,
              topicHints: item.topicHints ?? [],
              candidateSlugs: classificationContext.candidates.map((candidate) => candidate.slug),
              promptVersion: classificationContext.promptVersion,
              modelName: classificationCacheModelName
            })
          : classificationContext.inputHash;
      const assignedRoleSlug =
        classification?.assignedRoleSlug ??
        (source.mappingMode === "direct_mapped" ? source.roleSlug ?? null : null);

      const role = assignedRoleSlug
        ? await prisma.role.findUnique({
            where: { slug: assignedRoleSlug }
          })
        : null;
      const strategy = deriveItemStrategy({
        sourceClass: source.class,
        sourceType: item.sourceType,
        classification: classification ?? null
      });
      const normalizedSignal = normalizeSignalPolicy({
        sourceClass: source.class,
        sourceType: item.sourceType,
        sourceCatalogId: item.sourceCatalogId,
        assignedRoleSlug,
        strategy,
        classification: classification ?? null
      });
      await persistSourceItemDecision(
        {
          sourceCatalogId: item.sourceCatalogId,
          sourceLabel: item.sourceLabel,
          sourceUrl: item.sourceUrl,
          sourceType: item.sourceType,
          title: item.title,
          summaryEn: item.summary,
          summaryZh: getSafeChineseSummaryFallback(),
          publishedAt: item.publishedAt,
          mappingMode: source.mappingMode,
          classificationInputHash: classificationCacheInputHash,
          classificationPromptVersion: classificationContext.promptVersion,
          classificationModelName: classificationCacheModelName
        },
        {
          status: assignedRoleSlug ? "accepted" : "unmatched",
          primaryRoleSlug: assignedRoleSlug,
          reason:
            classification?.explanation ??
            `${source.label} produced a mapped ${source.class} signal for ${assignedRoleSlug ?? "unmapped"}.`,
          confidence:
            classification?.relevance === "high"
              ? "high"
              : classification?.relevance === "medium"
                ? "medium"
                : classification?.relevance === "none"
                  ? null
                  : "low",
          candidateSlugs: assignedRoleSlug ? [assignedRoleSlug] : [],
          matchedKeywords: [],
          reviewStatus: source.mappingMode === "direct_mapped" ? "approved" : "pending",
          inference:
            classification && classification.modelProvider && classification.modelName
              ? {
                  modelProvider: classification.modelProvider,
                  modelName: classification.modelName,
                  assignedRoleSlug: assignedRoleSlug ?? "unmapped",
                  inferenceSummaryEn: classification.summaryEn,
                  inferenceSummaryZh: classification.summaryZh ?? null,
                  impactDirection:
                    classification.impactDirection === "neutral"
                      ? "maintain"
                      : classification.impactDirection,
                  relevance: classification.relevance === "none" ? "low" : classification.relevance,
                  signalWeight: normalizedSignal.signalWeight,
                  rawJson: {
                    ...classification,
                    strategyId: strategy.strategyId,
                    strategyDefaultSignalType: strategy.defaultSignalType,
                    strategyCanAffectReplacementRate: strategy.canAffectReplacementRate,
                    normalizedSignalType: normalizedSignal.signalType,
                    normalizedSignalStrength: normalizedSignal.signalStrength,
                    normalizedSignalWeight: normalizedSignal.signalWeight,
                    shouldPersistSignal: normalizedSignal.shouldPersistSignal
                  }
                }
              : undefined
        }
      );

      if (role && assignedRoleSlug) {
        affectedRoleSlugs.add(assignedRoleSlug);
        await persistSourceItemSignalIfEligible({
          shouldPersistSignal: normalizedSignal.shouldPersistSignal,
          roleId: role.id,
          sourceUrl: item.sourceUrl,
          sourceTitle: item.title,
          sourceType: item.sourceType,
          signalType: normalizedSignal.signalType,
          strength: normalizedSignal.signalStrength,
          publishedAt: item.publishedAt,
          summaryEn: classification?.summaryEn ?? item.summary,
          summaryZh: classification?.summaryZh ?? getSafeChineseSummaryFallback(),
          rationaleEn:
            classification?.explanation ??
            `${source.label} produced a mapped ${source.class} signal for ${assignedRoleSlug}.`,
          rationaleZh: getSafeChineseRationaleFallback(source.label, source.class)
        });
      }

      if (source.mappingMode === "observe_only") {
        observedCount += 1;
        reviewQueuedCount += 1;
      } else {
        persistedCount += 1;
      }
    }

    logger.info(
      `[ingest] ${describeSource(source)} fetched=${normalizedItems.length} accepted=${summary.accepted} unmatched=${summary.unmatched} candidates=${summary.candidateSummary || "none"}`
    );
    for (const previewLine of summary.preview) {
      logger.info(`[ingest:item] ${source.id}: ${previewLine}`);
    }
  }

  for (const source of sources) {
    try {
      const rawItems = await fetchCatalogSourceItems(source);
      await processFetchedItems(source, rawItems);
    } catch (error) {
      failedSources += 1;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[skip] ${source.id}: ${message}`);
    }
  }

  for (const site of discoverySites) {
    const source = toDiscoverySource(site);

    try {
      const rawItems = await fetchSearchDiscoveryItems(site);
      await processFetchedItems(source, rawItems);
    } catch (error) {
      failedSources += 1;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[skip] ${site.id}: ${message}`);
    }
  }

  const attemptedSourceCount = sources.length + discoverySites.length;
  if (attemptedSourceCount > 0 && failedSources === attemptedSourceCount) {
    throw new Error(`All attempted source fetches failed (${failedSources}/${attemptedSourceCount})`);
  }

  if (!dryRun) {
    for (const roleSlug of affectedRoleSlugs) {
      const refreshedRole = await refreshRoleRisk(roleSlug);
      logger.info(
        `[refresh] ${refreshedRole.slug}: replacementRate=${refreshedRole.replacementRate ?? "pending"} riskLevel=${refreshedRole.riskLevel}`
      );
    }
  }

  logger.info(
    dryRun
      ? `Dry run complete. configured=${attemptedSourceCount} fetched=${fetchedCount} failed=${failedSources}`
      : `Ingest complete. configured=${attemptedSourceCount} fetched=${fetchedCount} observed=${observedCount} queued=${reviewQueuedCount} persisted=${persistedCount} failed=${failedSources}`
  );
}
