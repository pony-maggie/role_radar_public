import "@/lib/runtime/load-env";
import fs from "node:fs/promises";
import path from "node:path";
import { createMailer } from "@/lib/email/mailer";
import { logger } from "@/lib/logging/logger";
import { markDispatchFailed, markDispatchSent, listPendingDispatches, queueDueNotifications } from "@/lib/repositories/notifications";
import { renderNotification } from "@/lib/notifications/render";

function parseArgs(argv: string[]) {
  return {
    queueOnly: argv.includes("--queue-only"),
    limit: Number.parseInt(argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? "20", 10)
  };
}

async function ensureOutputDir() {
  const directory = path.join(process.cwd(), "tmp", "notification-previews");
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

export async function processPendingDispatches({ limit }: { limit: number }) {
  const pending = await listPendingDispatches(limit);
  logger.info("processing pending notification dispatches", {
    count: pending.length
  });

  const outputDir = await ensureOutputDir();
  const mailer = createMailer();

  for (const dispatch of pending) {
    try {
      const rendered = renderNotification(dispatch.payload);
      const subject = dispatch.subjectEn || rendered.subjectEn;
      await mailer.send({
        to: dispatch.email,
        subject,
        html: rendered.html,
        text: rendered.text
      });

      await markDispatchSent({
        dispatchId: dispatch.id,
        deliveryMode: "smtp",
        previewPath: null
      });

      logger.info("notification sent", {
        dispatchId: dispatch.id,
        email: dispatch.email,
        kind: dispatch.kind
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown notification failure";

      try {
        const rendered = renderNotification(dispatch.payload);
        const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
        const fileBase = `${timestamp}-${dispatch.id}-${rendered.fileStem}`;
        const htmlPath = path.join(outputDir, `${fileBase}.html`);
        const textPath = path.join(outputDir, `${fileBase}.txt`);
        await fs.writeFile(htmlPath, rendered.html, "utf8");
        await fs.writeFile(textPath, rendered.text, "utf8");
      } catch {
        // Keep failure handling best-effort.
      }

      await markDispatchFailed(dispatch.id, message);
      logger.error("notification delivery failed", {
        dispatchId: dispatch.id,
        email: dispatch.email,
        kind: dispatch.kind,
        error: message
      });
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const queued = await queueDueNotifications();
  logger.info("queued notification dispatches", { count: queued });

  if (args.queueOnly) {
    return;
  }

  await processPendingDispatches({ limit: args.limit });
}

const isDirectExecution =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectExecution) {
  main().catch((error) => {
    logger.error("notification runner crashed", {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });
}
