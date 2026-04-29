import { fileURLToPath } from "node:url";
import { runSourceIngest } from "@/lib/application/ingest/run-source-ingest";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logging/logger";
export {
  normalizeAndDedupeItems,
  resolveIngestTargets
} from "@/lib/application/ingest/run-source-ingest";

async function main() {
  await runSourceIngest();
}

const entrypointPath = process.argv[1];

if (entrypointPath && fileURLToPath(import.meta.url) === entrypointPath) {
  main()
    .catch((error) => {
      logger.error("ingest runner crashed", {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
