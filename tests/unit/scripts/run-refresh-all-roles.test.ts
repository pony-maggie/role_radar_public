import { afterEach, describe, expect, it, vi } from "vitest";

const runFullRoleRefresh = vi.hoisted(() => vi.fn());
const disconnect = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}));

vi.mock("@/lib/runtime/load-env", () => ({}));
vi.mock("@/lib/application/ops/run-full-role-refresh", () => ({
  runFullRoleRefresh
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $disconnect: disconnect
  }
}));
vi.mock("@/lib/logging/logger", () => ({
  logger
}));

import {
  runRefreshAllRolesCli,
  runRefreshAllRolesEntrypoint
} from "@/scripts/run-refresh-all-roles";

const originalScheduleLabel = process.env.ROLE_RADAR_ROLE_REFRESH_SCHEDULE;

afterEach(() => {
  if (originalScheduleLabel === undefined) {
    delete process.env.ROLE_RADAR_ROLE_REFRESH_SCHEDULE;
  } else {
    process.env.ROLE_RADAR_ROLE_REFRESH_SCHEDULE = originalScheduleLabel;
  }
  process.exitCode = undefined;
  vi.clearAllMocks();
});

describe("run-refresh-all-roles script", () => {
  it("passes the informational schedule label through to the application flow", async () => {
    process.env.ROLE_RADAR_ROLE_REFRESH_SCHEDULE = "debug-1m";
    runFullRoleRefresh.mockResolvedValue({
      scheduleLabel: "debug-1m",
      totalRoles: 2,
      successCount: 2,
      failureCount: 0,
      rolesWithDiscoveryHits: 1,
      rolesRiskRefreshed: 1
    });

    await runRefreshAllRolesCli();

    expect(runFullRoleRefresh).toHaveBeenCalledWith({
      scheduleLabel: "debug-1m"
    });
    expect(logger.info).toHaveBeenCalledWith(
      "role refresh cli completed",
      expect.objectContaining({ totalRoles: 2 })
    );
  });

  it("logs stack detail and disconnects prisma when the cli crashes", async () => {
    const error = new Error("boom");
    error.stack = "Error: boom\nSTACK";
    runFullRoleRefresh.mockRejectedValue(error);

    await runRefreshAllRolesEntrypoint();

    expect(logger.error).toHaveBeenCalledWith(
      "role refresh cli crashed",
      expect.objectContaining({ error: "Error: boom\nSTACK" })
    );
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(1);
  });

  it("logs disconnect failures without leaking a rejection", async () => {
    const crashError = new Error("boom");
    crashError.stack = "Error: boom\nSTACK";
    const disconnectError = new Error("disconnect boom");
    disconnectError.stack = "Error: disconnect boom\nSTACK";
    runFullRoleRefresh.mockRejectedValue(crashError);
    disconnect.mockRejectedValueOnce(disconnectError);

    await runRefreshAllRolesEntrypoint();

    expect(logger.error).toHaveBeenCalledWith(
      "role refresh cli crashed",
      expect.objectContaining({ error: "Error: boom\nSTACK" })
    );
    expect(logger.error).toHaveBeenCalledWith(
      "role refresh cli disconnect failed",
      expect.objectContaining({ error: "Error: disconnect boom\nSTACK" })
    );
    expect(process.exitCode).toBe(1);
  });
});
