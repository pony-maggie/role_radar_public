import "@/lib/runtime/load-env";
import { fileURLToPath } from "node:url";
import {
  collectRefreshTargetRoleSlugs,
  type DiscoveryResultWithRefreshTargets
} from "@/lib/application/discovery/collect-refresh-target-role-slugs";
import { runRoleDiscovery } from "@/lib/application/discovery/run-role-discovery";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logging/logger";
import { listHomepageRoles } from "@/lib/repositories/roles";
import { refreshRoleRisk } from "@/lib/repositories/risk-refresh";
import { createBraveSearchClient } from "@/lib/role-discovery/brave-search-client";

type CliArgs = {
  provider: string;
  roleSlugs: string[];
  limit: number;
  maxTimelineItems: number;
  maxQueries: number;
  maxResultsPerQuery: number;
};

const blockedRoleDiscoverySlugs = new Set(["", "ai", "model", "models"]);

function parseIntegerArg(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseArgs(argv: string[]): CliArgs {
  const directRoles = argv
    .filter((arg) => arg.startsWith("--role="))
    .map((arg) => arg.split("=")[1] ?? "")
    .filter(Boolean);
  const rolesArg = argv.find((arg) => arg.startsWith("--roles="))?.split("=")[1] ?? "";
  const roleSlugs = [...new Set([
    ...directRoles,
    ...rolesArg.split(",").map((value) => value.trim()).filter(Boolean)
  ])];

  return {
    provider: argv.find((arg) => arg.startsWith("--provider="))?.split("=")[1] ?? "brave",
    roleSlugs,
    limit: parseIntegerArg(argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1], 5),
    maxTimelineItems: parseIntegerArg(argv.find((arg) => arg.startsWith("--max-timeline="))?.split("=")[1], 10),
    maxQueries: parseIntegerArg(argv.find((arg) => arg.startsWith("--max-queries="))?.split("=")[1], 3),
    maxResultsPerQuery: parseIntegerArg(argv.find((arg) => arg.startsWith("--max-results="))?.split("=")[1], 20)
  };
}

export function filterRoleDiscoveryTargetSlugs(roleSlugs: string[]) {
  return [...new Set(
    roleSlugs
      .map((slug) => slug.trim())
      .filter((slug) => slug.length > 0)
      .filter((slug) => !blockedRoleDiscoverySlugs.has(slug.toLowerCase()))
  )];
}

async function resolveTargetRoleSlugs(args: CliArgs) {
  if (args.roleSlugs.length > 0) {
    return filterRoleDiscoveryTargetSlugs(args.roleSlugs);
  }

  const roles = await listHomepageRoles(760);
  return filterRoleDiscoveryTargetSlugs(roles
    .sort((left, right) => {
      const coverageDelta = (left.publicTimelineCount ?? 0) - (right.publicTimelineCount ?? 0);
      if (coverageDelta !== 0) return coverageDelta;
      return left.nameEn.localeCompare(right.nameEn);
    })
    .slice(0, args.limit)
    .map((role) => role.slug));
}

export async function runRoleDiscoveryCli(argv: string[]) {
  const args = parseArgs(argv);
  if (args.provider !== "brave") {
    throw new Error(`Unsupported role discovery provider: ${args.provider}`);
  }

  const client = createBraveSearchClient();
  const roleSlugs = await resolveTargetRoleSlugs(args);
  logger.info("starting role discovery run", {
    provider: args.provider,
    roleCount: roleSlugs.length,
    roles: roleSlugs
  });

  for (const roleSlug of roleSlugs) {
    const result = await runRoleDiscovery(roleSlug, {
      provider: args.provider,
      client,
      maxQueries: args.maxQueries,
      maxResultsPerQuery: args.maxResultsPerQuery,
      maxTimelineItems: args.maxTimelineItems
    });
    const refreshTargetRoleSlugs = collectRefreshTargetRoleSlugs(
      result as DiscoveryResultWithRefreshTargets
    );

    for (const refreshedRoleSlug of refreshTargetRoleSlugs) {
      const refreshedRole = await refreshRoleRisk(refreshedRoleSlug);
      logger.info("refreshed role risk after discovery", {
        roleSlug: refreshedRoleSlug,
        replacementRate: refreshedRole.replacementRate ?? "pending",
        riskLevel: refreshedRole.riskLevel
      });
    }

    logger.info("role discovery completed", {
      roleSlug,
      queryCount: result.queries.length,
      timelineHitCount: result.timelineHits.length,
      persistedHitCount: result.stats.persistedCount,
      stats: result.stats
    });
  }
}

const entrypointPath = process.argv[1];

if (entrypointPath && fileURLToPath(import.meta.url) === entrypointPath) {
  runRoleDiscoveryCli(process.argv.slice(2))
    .catch((error) => {
      logger.error("role discovery runner crashed", {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
