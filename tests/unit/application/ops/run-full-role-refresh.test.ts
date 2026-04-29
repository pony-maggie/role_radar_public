import { describe, expect, it, vi } from "vitest";
import { runFullRoleRefresh } from "@/lib/application/ops/run-full-role-refresh";

describe("runFullRoleRefresh", () => {
  it("continues after one refresh target fails and counts one tracked-role failure", async () => {
    const listTrackedRoleSlugs = vi.fn().mockResolvedValue(["actors"]);
    const findTrackedRoleStateBySlug = vi
      .fn()
      .mockResolvedValueOnce({
        id: "role_actors",
        slug: "actors",
        replacementRate: 38,
        riskLevel: "MEDIUM",
        ratingStatus: "RATED",
        lastRatedAt: new Date("2026-04-01T00:00:00.000Z"),
        riskCachedAt: new Date("2026-04-01T00:00:00.000Z")
      })
      .mockResolvedValueOnce({
        id: "role_bookkeeping_clerk",
        slug: "bookkeeping-clerk",
        replacementRate: 52,
        riskLevel: "MEDIUM",
        ratingStatus: "RATED",
        lastRatedAt: new Date("2026-04-01T00:00:00.000Z"),
        riskCachedAt: new Date("2026-04-01T00:00:00.000Z")
      });
    const createRoleRiskSnapshot = vi.fn().mockResolvedValue(undefined);
    const runRoleDiscovery = vi.fn().mockResolvedValue({
      queries: ["actors ai automation"],
      timelineHits: [{ id: "hit-1" }],
      stats: { persistedCount: 2 },
      affectedRoles: ["actors", "bookkeeping-clerk"]
    });
    const refreshRoleRisk = vi.fn()
      .mockRejectedValueOnce(new Error("actors refresh failed"))
      .mockResolvedValueOnce({
        slug: "bookkeeping-clerk",
        replacementRate: 54,
        riskLevel: "MEDIUM"
      });
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    const result = await runFullRoleRefresh({
      scheduleLabel: "weekly",
      deps: {
        listTrackedRoleSlugs,
        findTrackedRoleStateBySlug,
        runRoleDiscovery,
        refreshRoleRisk,
        createRoleRiskSnapshot,
        logger,
        createClient: () => ({ search: vi.fn() })
      }
    });

    expect(result).toMatchObject({
      scheduleLabel: "weekly",
      totalRoles: 1,
      successCount: 0,
      failureCount: 1,
      rolesWithDiscoveryHits: 1,
      rolesRiskRefreshed: 1
    });
    expect(refreshRoleRisk).toHaveBeenNthCalledWith(1, "actors");
    expect(refreshRoleRisk).toHaveBeenNthCalledWith(2, "bookkeeping-clerk");
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "full role refresh failed for role",
      expect.objectContaining({
        roleSlug: "actors",
        failedRefreshTargetRoleSlugs: ["actors"],
        failedRefreshTargetErrors: ["actors refresh failed"],
        refreshTargetRoleCount: 2
      })
    );
  });

  it("continues after one role fails and returns a truthful summary", async () => {
    const listTrackedRoleSlugs = vi.fn().mockResolvedValue(["actors", "bookkeeping-clerk"]);
    const findTrackedRoleStateBySlug = vi.fn().mockResolvedValue({
      id: "role_actors",
      slug: "actors",
      replacementRate: 38,
      riskLevel: "MEDIUM",
      ratingStatus: "RATED",
      lastRatedAt: new Date("2026-04-01T00:00:00.000Z"),
      riskCachedAt: new Date("2026-04-01T00:00:00.000Z")
    });
    const createRoleRiskSnapshot = vi.fn().mockResolvedValue(undefined);
    const runRoleDiscovery = vi.fn()
      .mockResolvedValueOnce({
        queries: ["actors ai automation"],
        timelineHits: [{ id: "hit-1" }],
        stats: { persistedCount: 1 },
        affectedRoleSlugs: ["actors"]
      })
      .mockRejectedValueOnce(new Error("brave timeout"));
    const refreshRoleRisk = vi.fn().mockResolvedValue({
      slug: "actors",
      replacementRate: 61,
      riskLevel: "HIGH"
    });
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    const result = await runFullRoleRefresh({
      scheduleLabel: "weekly",
      deps: {
        listTrackedRoleSlugs,
        findTrackedRoleStateBySlug,
        runRoleDiscovery,
        refreshRoleRisk,
        createRoleRiskSnapshot,
        logger,
        createClient: () => ({ search: vi.fn() })
      }
    });

    expect(result).toMatchObject({
      scheduleLabel: "weekly",
      totalRoles: 2,
      successCount: 1,
      failureCount: 1,
      rolesWithDiscoveryHits: 1,
      rolesRiskRefreshed: 1
    });
    expect(refreshRoleRisk).toHaveBeenCalledWith("actors");
    expect(logger.warn).toHaveBeenCalledWith(
      "full role refresh failed for role",
      expect.objectContaining({ roleSlug: "bookkeeping-clerk" })
    );
  });

  it("returns zero counts cleanly when no tracked roles exist", async () => {
    const result = await runFullRoleRefresh({
      scheduleLabel: "weekly",
      deps: {
        listTrackedRoleSlugs: vi.fn().mockResolvedValue([]),
        runRoleDiscovery: vi.fn(),
        refreshRoleRisk: vi.fn(),
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        createClient: () => ({ search: vi.fn() })
      }
    });

    expect(result).toMatchObject({
      totalRoles: 0,
      successCount: 0,
      failureCount: 0,
      rolesWithDiscoveryHits: 0,
      rolesRiskRefreshed: 0
    });
  });

  it("writes one snapshot per processed role from the full refresh flow", async () => {
    const createRoleRiskSnapshot = vi.fn().mockResolvedValue(undefined);

    await runFullRoleRefresh({
      scheduleLabel: "weekly",
      deps: {
        listTrackedRoleSlugs: vi.fn().mockResolvedValue(["actors"]),
        findTrackedRoleStateBySlug: vi.fn().mockResolvedValueOnce({
          id: "role_actors",
          slug: "actors",
          replacementRate: 38,
          riskLevel: "MEDIUM",
          ratingStatus: "RATED",
          lastRatedAt: new Date("2026-04-01T00:00:00.000Z"),
          riskCachedAt: new Date("2026-04-01T00:00:00.000Z")
        }),
        runRoleDiscovery: vi.fn().mockResolvedValue({
          queries: [],
          timelineHits: [],
          stats: { persistedCount: 0 },
          affectedRoleSlugs: ["actors"]
        }),
        refreshRoleRisk: vi.fn().mockResolvedValue({
          id: "role_actors",
          slug: "actors",
          replacementRate: 44,
          riskLevel: "MEDIUM",
          ratingStatus: "RATED",
          lastRatedAt: new Date("2026-04-08T00:00:00.000Z"),
          riskCachedAt: new Date("2026-04-08T00:00:00.000Z")
        }),
        createRoleRiskSnapshot,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        createClient: () => ({ search: vi.fn() })
      }
    });

    expect(createRoleRiskSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        roleId: "role_actors",
        replacementRate: 44,
        wasRecomputed: true,
        source: "full_refresh"
      })
    );
  });

  it("writes a retained snapshot when a processed role produces no refresh targets", async () => {
    const createRoleRiskSnapshot = vi.fn().mockResolvedValue(undefined);

    await runFullRoleRefresh({
      scheduleLabel: "weekly",
      deps: {
        listTrackedRoleSlugs: vi.fn().mockResolvedValue(["actors"]),
        findTrackedRoleStateBySlug: vi.fn().mockResolvedValue({
          id: "role_actors",
          slug: "actors",
          replacementRate: 44,
          riskLevel: "MEDIUM",
          ratingStatus: "RATED",
          lastRatedAt: new Date("2026-04-08T00:00:00.000Z"),
          riskCachedAt: new Date("2026-04-08T00:00:00.000Z")
        }),
        runRoleDiscovery: vi.fn().mockResolvedValue({
          queries: [],
          timelineHits: [],
          stats: { persistedCount: 0 },
          affectedRoleSlugs: []
        }),
        refreshRoleRisk: vi.fn(),
        createRoleRiskSnapshot,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        createClient: () => ({ search: vi.fn() })
      }
    });

    expect(createRoleRiskSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        roleId: "role_actors",
        replacementRate: 44,
        wasRecomputed: false,
        source: "full_refresh"
      })
    );
  });

  it("does not write a snapshot when the processed role refresh itself fails", async () => {
    const createRoleRiskSnapshot = vi.fn().mockResolvedValue(undefined);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

    const result = await runFullRoleRefresh({
      scheduleLabel: "weekly",
      deps: {
        listTrackedRoleSlugs: vi.fn().mockResolvedValue(["actors"]),
        findTrackedRoleStateBySlug: vi
          .fn()
          .mockResolvedValueOnce({
            id: "role_actors",
            slug: "actors",
            replacementRate: 44,
            riskLevel: "MEDIUM",
            ratingStatus: "RATED",
            lastRatedAt: new Date("2026-04-08T00:00:00.000Z"),
            riskCachedAt: new Date("2026-04-08T00:00:00.000Z")
          })
          .mockResolvedValueOnce({
            id: "role_actors",
            slug: "actors",
            replacementRate: 44,
            riskLevel: "MEDIUM",
            ratingStatus: "RATED",
            lastRatedAt: new Date("2026-04-08T00:00:00.000Z"),
            riskCachedAt: new Date("2026-04-08T00:00:00.000Z")
          }),
        runRoleDiscovery: vi.fn().mockResolvedValue({
          queries: [],
          timelineHits: [],
          stats: { persistedCount: 0 },
          affectedRoleSlugs: ["actors"]
        }),
        refreshRoleRisk: vi.fn().mockRejectedValue(new Error("actors refresh failed")),
        createRoleRiskSnapshot,
        logger,
        createClient: () => ({ search: vi.fn() })
      }
    });

    expect(result).toMatchObject({
      successCount: 0,
      failureCount: 1,
      rolesRiskRefreshed: 0
    });
    expect(createRoleRiskSnapshot).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "full role refresh failed for role",
      expect.objectContaining({
        roleSlug: "actors",
        refreshTargetRoleCount: 1
      })
    );
  });

  it("still snapshots the processed role when it refreshes successfully but a secondary target fails", async () => {
    const createRoleRiskSnapshot = vi.fn().mockResolvedValue(undefined);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

    const result = await runFullRoleRefresh({
      scheduleLabel: "weekly",
      deps: {
        listTrackedRoleSlugs: vi.fn().mockResolvedValue(["actors"]),
        findTrackedRoleStateBySlug: vi.fn().mockResolvedValue({
          id: "role_actors",
          slug: "actors",
          replacementRate: 38,
          riskLevel: "MEDIUM",
          ratingStatus: "RATED",
          lastRatedAt: new Date("2026-04-01T00:00:00.000Z"),
          riskCachedAt: new Date("2026-04-01T00:00:00.000Z")
        }),
        runRoleDiscovery: vi.fn().mockResolvedValue({
          queries: [],
          timelineHits: [],
          stats: { persistedCount: 0 },
          affectedRoles: ["actors", "bookkeeping-clerk"]
        }),
        refreshRoleRisk: vi
          .fn()
          .mockResolvedValueOnce({
            id: "role_actors",
            slug: "actors",
            replacementRate: 44,
            riskLevel: "MEDIUM",
            ratingStatus: "RATED",
            lastRatedAt: new Date("2026-04-08T00:00:00.000Z"),
            riskCachedAt: new Date("2026-04-08T00:00:00.000Z")
          })
          .mockRejectedValueOnce(new Error("secondary refresh failed")),
        createRoleRiskSnapshot,
        logger,
        createClient: () => ({ search: vi.fn() })
      }
    });

    expect(result).toMatchObject({
      successCount: 0,
      failureCount: 1,
      rolesRiskRefreshed: 1
    });
    expect(createRoleRiskSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        roleId: "role_actors",
        replacementRate: 44,
        wasRecomputed: true,
        source: "full_refresh"
      })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "full role refresh failed for role",
      expect.objectContaining({
        roleSlug: "actors",
        failedRefreshTargetRoleSlugs: ["bookkeeping-clerk"]
      })
    );
  });

  it("still writes a retained processed-role snapshot when only a secondary target fails", async () => {
    const createRoleRiskSnapshot = vi.fn().mockResolvedValue(undefined);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

    const result = await runFullRoleRefresh({
      scheduleLabel: "weekly",
      deps: {
        listTrackedRoleSlugs: vi.fn().mockResolvedValue(["actors"]),
        findTrackedRoleStateBySlug: vi
          .fn()
          .mockResolvedValueOnce({
            id: "role_actors",
            slug: "actors",
            replacementRate: 44,
            riskLevel: "MEDIUM",
            ratingStatus: "RATED",
            lastRatedAt: new Date("2026-04-08T00:00:00.000Z"),
            riskCachedAt: new Date("2026-04-08T00:00:00.000Z")
          })
          .mockResolvedValueOnce({
            id: "role_actors",
            slug: "actors",
            replacementRate: 44,
            riskLevel: "MEDIUM",
            ratingStatus: "RATED",
            lastRatedAt: new Date("2026-04-08T00:00:00.000Z"),
            riskCachedAt: new Date("2026-04-08T00:00:00.000Z")
          }),
        runRoleDiscovery: vi.fn().mockResolvedValue({
          queries: [],
          timelineHits: [],
          stats: { persistedCount: 0 },
          affectedRoleSlugs: ["bookkeeping-clerk"]
        }),
        refreshRoleRisk: vi.fn().mockRejectedValue(new Error("secondary refresh failed")),
        createRoleRiskSnapshot,
        logger,
        createClient: () => ({ search: vi.fn() })
      }
    });

    expect(result).toMatchObject({
      successCount: 0,
      failureCount: 1,
      rolesRiskRefreshed: 0
    });
    expect(createRoleRiskSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        roleId: "role_actors",
        replacementRate: 44,
        wasRecomputed: false,
        source: "full_refresh"
      })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "full role refresh failed for role",
      expect.objectContaining({
        roleSlug: "actors",
        failedRefreshTargetRoleSlugs: ["bookkeeping-clerk"]
      })
    );
  });
});
