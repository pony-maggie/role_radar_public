import "@/lib/runtime/load-env";
import { fileURLToPath } from "node:url";
import { runFullRoleRefresh } from "@/lib/application/ops/run-full-role-refresh";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logging/logger";

export async function runRefreshAllRolesCli() {
  const scheduleLabel = process.env.ROLE_RADAR_ROLE_REFRESH_SCHEDULE ?? "unspecified";
  const summary = await runFullRoleRefresh({ scheduleLabel });

  logger.info("role refresh cli completed", summary);
  return summary;
}

export async function runRefreshAllRolesEntrypoint() {
  try {
    await runRefreshAllRolesCli();
  } catch (error) {
    logger.error("role refresh cli crashed", {
      error: error instanceof Error ? error.stack ?? error.message : String(error)
    });
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (error) {
      logger.error("role refresh cli disconnect failed", {
        error: error instanceof Error ? error.stack ?? error.message : String(error)
      });
    }
  }
}

const entrypointPath = process.argv[1];

if (entrypointPath && fileURLToPath(import.meta.url) === entrypointPath) {
  void runRefreshAllRolesEntrypoint();
}
