import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLogger } from "@/lib/logging/logger";

describe("logger", () => {
  it("writes messages to the configured log file", () => {
    const logPath = path.join(os.tmpdir(), `role-radar-${Date.now()}.log`);
    const logger = createLogger({
      env: {
        ROLE_RADAR_LOG_PATH: logPath,
        ROLE_RADAR_LOG_LEVEL: "info"
      }
    });

    logger.info("smtp ready", { source: "test" });

    const output = fs.readFileSync(logPath, "utf8");
    expect(output).toContain("smtp ready");
    expect(output).toContain('"source":"test"');
  });
});
