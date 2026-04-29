import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(__dirname, "../..");
const startScript = path.join(rootDir, "scripts/start-local.sh");
const stopScript = path.join(rootDir, "scripts/stop-local.sh");
const dailyScript = path.join(rootDir, "scripts/run-daily-cycle.sh");

function runScript(scriptPath: string) {
  return execFileSync("/bin/bash", [scriptPath], {
    cwd: rootDir,
    env: {
      ...process.env,
      ROLE_RADAR_DRY_RUN: "1",
      ROLE_RADAR_NO_OPEN: "1",
      ROLE_RADAR_ENV_FILE: "/tmp/role-radar-missing.env"
    },
    encoding: "utf8"
  });
}

describe("local control scripts", () => {
  it("describes the start workflow in dry-run mode", () => {
    const output = runScript(startScript);

    expect(output).toContain("dry-run: stop existing Role Radar local process");
    expect(output).toContain("dry-run: seed database (preserve ingested timelines)");
    expect(output).toContain("dry-run: skip local role discovery bootstrap");
    expect(output).toContain("dry-run: start Next.js dev server on http://127.0.0.1:3000");
    expect(output).toContain("dry-run: open browser http://127.0.0.1:3000/en");
  });

  it("describes the local role-discovery bootstrap when a Brave key is present", () => {
    const output = execFileSync("/bin/bash", [startScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        ROLE_RADAR_DRY_RUN: "1",
        ROLE_RADAR_NO_OPEN: "1",
        ROLE_RADAR_ENV_FILE: "/tmp/role-radar-missing.env",
        BRAVE_SEARCH_API_KEY: "test-brave-key"
      },
      encoding: "utf8"
    });

    expect(output).toContain("dry-run: start Next.js dev server on http://127.0.0.1:3000");
    expect(output).toContain("dry-run: bootstrap local role discovery in background with npm run discovery:roles -- --limit=5");
  });

  it("describes the local role-discovery bootstrap when the Brave key only exists in the env file", () => {
    const envFile = path.join(rootDir, "tmp", "start-local-test.env");
    fs.mkdirSync(path.dirname(envFile), { recursive: true });
    fs.writeFileSync(envFile, "BRAVE_SEARCH_API_KEY=test-from-file\n", "utf8");

    const output = execFileSync("/bin/bash", [startScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        ROLE_RADAR_DRY_RUN: "1",
        ROLE_RADAR_NO_OPEN: "1",
        ROLE_RADAR_ENV_FILE: envFile
      },
      encoding: "utf8"
    });

    expect(output).toContain("dry-run: bootstrap local role discovery in background with npm run discovery:roles -- --limit=5");
  });

  it("describes the stop workflow in dry-run mode", () => {
    const output = runScript(stopScript);

    expect(output).toContain("dry-run: stop pid from");
    expect(output).toContain("dry-run: free tcp port 3000");
    expect(output).toContain("dry-run: cleanup pid file");
  });

  it("describes the daily cycle in dry-run mode", () => {
    const output = execFileSync("/bin/bash", [dailyScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        ROLE_RADAR_DAILY_DRY_RUN: "1"
      },
      encoding: "utf8"
    });

    expect(output).toContain(`dry-run: cd ${rootDir}`);
    expect(output).toContain("dry-run: npm run ingest:signals");
    expect(output).toContain("dry-run: npm run notifications:run");
  });

  it("describes the role-discovery step when the daily discovery flag is enabled", () => {
    const output = execFileSync("/bin/bash", [dailyScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        ROLE_RADAR_DAILY_DRY_RUN: "1",
        ROLE_RADAR_DAILY_ENABLE_ROLE_DISCOVERY: "1",
        ROLE_RADAR_DAILY_ROLE_DISCOVERY_LIMIT: "4"
      },
      encoding: "utf8"
    });

    expect(output).toContain("dry-run: npm run discovery:roles -- --limit=4");
  });
});
