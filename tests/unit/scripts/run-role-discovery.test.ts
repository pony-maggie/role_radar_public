import { afterEach, describe, expect, it, vi } from "vitest";

const runRoleDiscovery = vi.hoisted(() => vi.fn());
const refreshRoleRisk = vi.hoisted(() => vi.fn());
const createBraveSearchClient = vi.hoisted(() => vi.fn());
const logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}));

vi.mock("@/lib/runtime/load-env", () => ({}));
vi.mock("@/lib/application/discovery/run-role-discovery", () => ({
  runRoleDiscovery
}));
vi.mock("@/lib/repositories/risk-refresh", () => ({
  refreshRoleRisk
}));
vi.mock("@/lib/role-discovery/brave-search-client", () => ({
  createBraveSearchClient
}));
vi.mock("@/lib/logging/logger", () => ({
  logger
}));

import {
  filterRoleDiscoveryTargetSlugs,
  parseArgs,
  runRoleDiscoveryCli
} from "@/scripts/run-role-discovery";

afterEach(() => {
  vi.clearAllMocks();
});

describe("run-role-discovery script", () => {
  it("parses repeated role flags and comma-separated role lists", () => {
    const args = parseArgs([
      "--role=actors",
      "--roles=customer-service-representative,actors,bookkeeping-clerk",
      "--limit=7",
      "--max-timeline=4",
      "--max-queries=2",
      "--max-results=12"
    ]);

    expect(args).toEqual({
      provider: "brave",
      roleSlugs: ["actors", "customer-service-representative", "bookkeeping-clerk"],
      limit: 7,
      maxTimelineItems: 4,
      maxQueries: 2,
      maxResultsPerQuery: 12
    });
  });

  it("filters empty and pseudo role slugs from default discovery targets", () => {
    expect(
      filterRoleDiscoveryTargetSlugs([
        "actors",
        "",
        "ai",
        " customer-service-representative ",
        "models",
        "actors"
      ])
    ).toEqual(["actors", "customer-service-representative"]);
  });

  it("refreshes affected roles and logs the refreshed risk details after discovery", async () => {
    createBraveSearchClient.mockReturnValue({
      search: vi.fn()
    });
    runRoleDiscovery.mockResolvedValue({
      queries: ["actors AI automation"],
      timelineHits: [],
      stats: {
        persistedCount: 0
      },
      affectedRoleSlugs: ["actors"],
      scoreEligibleSignals: [
        {
          roleSlug: "actors"
        },
        {
          assignedRoleSlug: "customer-service-representative"
        }
      ]
    });
    refreshRoleRisk.mockImplementation(async (roleSlug: string) => ({
      slug: roleSlug,
      replacementRate: roleSlug === "actors" ? 0.41 : 0.12,
      riskLevel: roleSlug === "actors" ? "LOW" : "MEDIUM"
    }));

    await runRoleDiscoveryCli(["--role=actors"]);

    expect(refreshRoleRisk).toHaveBeenCalledTimes(2);
    expect(refreshRoleRisk).toHaveBeenNthCalledWith(1, "actors");
    expect(refreshRoleRisk).toHaveBeenNthCalledWith(2, "customer-service-representative");
    expect(logger.info).toHaveBeenCalledWith(
      "refreshed role risk after discovery",
      expect.objectContaining({
        roleSlug: "actors",
        replacementRate: 0.41,
        riskLevel: "LOW"
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "refreshed role risk after discovery",
      expect.objectContaining({
        roleSlug: "customer-service-representative",
        replacementRate: 0.12,
        riskLevel: "MEDIUM"
      })
    );
  });

  it("reuses the shared affected-role collector and still refreshes deduped role slugs", async () => {
    createBraveSearchClient.mockReturnValue({ search: vi.fn() });
    runRoleDiscovery.mockResolvedValue({
      queries: ["actors ai automation"],
      timelineHits: [],
      stats: { persistedCount: 0 },
      affectedRoleSlugs: ["actors"],
      affectedRoles: [{ slug: "actors" }],
      scoreEligibleSignals: [{ assignedRoleSlug: "customer-service-representative" }]
    });
    refreshRoleRisk.mockResolvedValue({
      slug: "actors",
      replacementRate: 55,
      riskLevel: "MEDIUM"
    });

    await runRoleDiscoveryCli(["--role=actors"]);

    expect(refreshRoleRisk).toHaveBeenCalledWith("actors");
    expect(refreshRoleRisk).toHaveBeenCalledWith("customer-service-representative");
    expect(refreshRoleRisk).toHaveBeenCalledTimes(2);
  });
});
