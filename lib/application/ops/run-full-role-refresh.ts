import { createBraveSearchClient } from "@/lib/role-discovery/brave-search-client";
import { collectRefreshTargetRoleSlugs } from "@/lib/application/discovery/collect-refresh-target-role-slugs";
import { runRoleDiscovery } from "@/lib/application/discovery/run-role-discovery";
import { logger } from "@/lib/logging/logger";
import { createRoleRiskSnapshot } from "@/lib/repositories/role-risk-snapshots";
import { findTrackedRoleStateBySlug, listTrackedRoleSlugs } from "@/lib/repositories/roles";
import { refreshRoleRisk } from "@/lib/repositories/risk-refresh";

export type FullRoleRefreshSummary = {
  scheduleLabel: string;
  totalRoles: number;
  successCount: number;
  failureCount: number;
  rolesWithDiscoveryHits: number;
  rolesRiskRefreshed: number;
};

type RunFullRoleRefreshDeps = {
  listTrackedRoleSlugs?: typeof listTrackedRoleSlugs;
  findTrackedRoleStateBySlug?: typeof findTrackedRoleStateBySlug;
  runRoleDiscovery?: typeof runRoleDiscovery;
  refreshRoleRisk?: typeof refreshRoleRisk;
  createRoleRiskSnapshot?: typeof createRoleRiskSnapshot;
  createClient?: typeof createBraveSearchClient;
  logger?: Pick<typeof logger, "info" | "warn" | "error" | "debug">;
};

type RunFullRoleRefreshOptions = {
  scheduleLabel?: string;
  deps?: RunFullRoleRefreshDeps;
};

export async function runFullRoleRefresh(options: RunFullRoleRefreshOptions = {}): Promise<FullRoleRefreshSummary> {
  const scheduleLabel = options.scheduleLabel ?? process.env.ROLE_RADAR_ROLE_REFRESH_SCHEDULE ?? "unspecified";
  const deps = options.deps ?? {};
  const listSlugs = deps.listTrackedRoleSlugs ?? listTrackedRoleSlugs;
  const findTrackedRole = deps.findTrackedRoleStateBySlug ?? findTrackedRoleStateBySlug;
  const runDiscovery = deps.runRoleDiscovery ?? runRoleDiscovery;
  const refreshRisk = deps.refreshRoleRisk ?? refreshRoleRisk;
  const persistSnapshot = deps.createRoleRiskSnapshot ?? createRoleRiskSnapshot;
  const createClient = deps.createClient ?? createBraveSearchClient;
  const log = deps.logger ?? logger;

  const roleSlugs = await listSlugs();
  const client = createClient();
  const summary: FullRoleRefreshSummary = {
    scheduleLabel,
    totalRoles: roleSlugs.length,
    successCount: 0,
    failureCount: 0,
    rolesWithDiscoveryHits: 0,
    rolesRiskRefreshed: 0
  };

  log.info("starting full role refresh", {
    scheduleLabel,
    totalRoles: summary.totalRoles
  });

  for (const roleSlug of roleSlugs) {
    let roleHadError = false;
    let processedRoleRefreshFailed = false;
    const failedRefreshTargetDetails: Array<{ roleSlug: string; error: string }> = [];
    let trackedRoleAfterRefreshFromRefreshTarget:
      | Awaited<ReturnType<typeof findTrackedRoleStateBySlug>>
      | null = null;

    try {
      const trackedRoleBeforeRefresh = await findTrackedRole(roleSlug);
      const result = await runDiscovery(roleSlug, {
        provider: "brave",
        client,
        maxQueries: 3,
        maxResultsPerQuery: 20,
        maxTimelineItems: 10
      });

      if (result.timelineHits.length > 0) {
        summary.rolesWithDiscoveryHits += 1;
      }

      const refreshTargetRoleSlugs = collectRefreshTargetRoleSlugs(result);

      for (const refreshTargetRoleSlug of refreshTargetRoleSlugs) {
        try {
          const refreshedRole = await refreshRisk(refreshTargetRoleSlug);

          if (refreshTargetRoleSlug === roleSlug) {
            trackedRoleAfterRefreshFromRefreshTarget = {
              id: refreshedRole.id ?? trackedRoleBeforeRefresh?.id ?? "",
              slug: refreshedRole.slug ?? roleSlug,
              replacementRate: refreshedRole.replacementRate ?? trackedRoleBeforeRefresh?.replacementRate ?? null,
              riskLevel: refreshedRole.riskLevel ?? trackedRoleBeforeRefresh?.riskLevel ?? null,
              ratingStatus: refreshedRole.ratingStatus ?? trackedRoleBeforeRefresh?.ratingStatus ?? null,
              lastRatedAt: refreshedRole.lastRatedAt ?? trackedRoleBeforeRefresh?.lastRatedAt ?? null,
              riskCachedAt: refreshedRole.riskCachedAt ?? trackedRoleBeforeRefresh?.riskCachedAt ?? null
            };
          }

          summary.rolesRiskRefreshed += 1;
        } catch (error) {
          roleHadError = true;
          if (refreshTargetRoleSlug === roleSlug) {
            processedRoleRefreshFailed = true;
          }
          failedRefreshTargetDetails.push({
            roleSlug: refreshTargetRoleSlug,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      if (refreshTargetRoleSlugs.length === 0) {
        const retainedRole = await findTrackedRole(roleSlug);

        if (retainedRole) {
          await persistSnapshot({
            roleId: retainedRole.id,
            snapshotAt: new Date(),
            replacementRate: retainedRole.replacementRate,
            riskLevel: retainedRole.riskLevel,
            ratingStatus: retainedRole.ratingStatus,
            wasRecomputed: false,
            source: "full_refresh"
          });
        }
      }
      const shouldPersistProcessedRoleSnapshot =
        refreshTargetRoleSlugs.length > 0 && !processedRoleRefreshFailed;

      if (shouldPersistProcessedRoleSnapshot) {
        const trackedRoleAfterRefresh =
          trackedRoleAfterRefreshFromRefreshTarget ?? (await findTrackedRole(roleSlug));

        if (trackedRoleAfterRefresh) {
          const roleId = trackedRoleAfterRefresh.id ?? trackedRoleBeforeRefresh?.id;
          const riskLevel = trackedRoleAfterRefresh.riskLevel ?? trackedRoleBeforeRefresh?.riskLevel;
          const ratingStatus =
            trackedRoleAfterRefresh.ratingStatus ?? trackedRoleBeforeRefresh?.ratingStatus;

          if (!roleId || !riskLevel || !ratingStatus) {
            throw new Error(`Unable to snapshot tracked role state: ${roleSlug}`);
          }

          await persistSnapshot({
            roleId,
            snapshotAt: new Date(),
            replacementRate: trackedRoleAfterRefresh.replacementRate ?? trackedRoleBeforeRefresh?.replacementRate ?? null,
            riskLevel,
            ratingStatus,
            wasRecomputed:
              trackedRoleBeforeRefresh?.lastRatedAt?.getTime() !==
                trackedRoleAfterRefresh.lastRatedAt?.getTime() ||
              trackedRoleBeforeRefresh?.riskCachedAt?.getTime() !==
                trackedRoleAfterRefresh.riskCachedAt?.getTime(),
            source: "full_refresh"
          });
        }
      }

      if (roleHadError) {
        summary.failureCount += 1;
        log.warn("full role refresh failed for role", {
          roleSlug,
          failedRefreshTargetRoleSlugs: failedRefreshTargetDetails.map((failedTarget) => failedTarget.roleSlug),
          failedRefreshTargetErrors: failedRefreshTargetDetails.map((failedTarget) => failedTarget.error),
          refreshTargetRoleCount: refreshTargetRoleSlugs.length
        });
      } else {
        summary.successCount += 1;
        log.info("full role refresh completed for role", {
          roleSlug,
          queryCount: result.queries.length,
          timelineHitCount: result.timelineHits.length,
          refreshTargetCount: refreshTargetRoleSlugs.length
        });
      }
    } catch (error) {
      summary.failureCount += 1;
      log.warn("full role refresh failed for role", {
        roleSlug,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  log.info("full role refresh summary", summary);
  return summary;
}
