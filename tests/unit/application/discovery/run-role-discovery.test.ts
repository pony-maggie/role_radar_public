import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { buildRoleDiscoveryQueryHash } from "@/lib/role-discovery/cache-keys";
import { upsertSearchQueryRun } from "@/lib/repositories/role-discovery";
import { runRoleDiscovery } from "@/lib/application/discovery/run-role-discovery";

describe("runRoleDiscovery", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function cleanupDiscoveryFixtures() {
    await prisma.sourceItemInference.deleteMany({
      where: {
        sourceItem: {
          sourceCatalogId: {
            startsWith: "discovery-role-search"
          }
        }
      }
    });

    await prisma.sourceItemRoleDecision.deleteMany({
      where: {
        sourceItem: {
          sourceCatalogId: {
            startsWith: "discovery-role-search"
          }
        }
      }
    });

    await prisma.sourceItem.deleteMany({
      where: {
        sourceCatalogId: {
          startsWith: "discovery-role-search"
        }
      }
    });

    await prisma.roleEvidenceCandidate.deleteMany({
      where: {
        sourceUrl: {
          startsWith: "https://test-role-discovery.local/"
        }
      }
    });

    await prisma.searchHit.deleteMany({
      where: {
        run: {
          provider: {
            startsWith: "test-brave"
          }
        }
      }
    });

    await prisma.searchQueryRun.deleteMany({
      where: {
        provider: {
          startsWith: "test-brave"
        }
      }
    });
  }

  beforeEach(cleanupDiscoveryFixtures);
  afterEach(cleanupDiscoveryFixtures);

  it("reuses a fresh cached query run instead of searching again", async () => {
    const queryText = "Customer Service Representatives AI automation";
    const queryHash = buildRoleDiscoveryQueryHash({
      roleSlug: "customer-service-representative",
      provider: "test-brave-cache",
      queryText
    });

    await upsertSearchQueryRun({
      roleSlug: "customer-service-representative",
      provider: "test-brave-cache",
      queryText,
      queryHash,
      status: "SUCCESS",
      expiresAt: new Date("2099-04-22T00:00:00.000Z"),
      hits: [
        {
          rank: 1,
          sourceUrl: "https://test-role-discovery.local/support-ai-cache",
          title: "Customer Service Representatives AI automation result",
          snippet: "Customer support workflows are moving into AI-led automation.",
          publishedAt: "2026-04-19T00:00:00.000Z"
        }
      ]
    });

    const search = vi.fn(async () => []);
    const result = await runRoleDiscovery("customer-service-representative", {
      provider: "test-brave-cache",
      client: {
        search
      }
    });

    expect(search).not.toHaveBeenCalledWith(queryText, expect.any(Number));
    expect(result.hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceUrl: "https://test-role-discovery.local/support-ai-cache",
          title: "Customer Service Representatives AI automation result"
        })
      ])
    );
  });

  it("searches and persists query runs when no fresh cache exists", async () => {
    const queryText = "Actors AI automation";
    const search = vi.fn(async (query: string) => [
      {
        url: `https://test-role-discovery.local/${encodeURIComponent(query)}`,
        title: `${query} result`,
        snippet: "Fresh search discovery result.",
        publishedAt: "2026-04-19T00:00:00.000Z"
      },
      {
        url: "https://actorcopilot.ai/",
        title: "Actor Copilot - AI tools for performers",
        snippet: "AI tools for performers and actor workflows.",
        publishedAt: null
      },
      {
        url: "https://test-role-discovery.local/funding-noise",
        title: "AI startup raises Series B funding",
        snippet: "Investors back another model company at a higher valuation.",
        publishedAt: "2026-04-19T00:00:00.000Z"
      }
    ]);

    const result = await runRoleDiscovery("actors", {
      provider: "test-brave-fresh",
      client: {
        search
      },
      maxQueries: 1,
      adjudicator: vi.fn().mockResolvedValue(null)
    });

    expect(search).toHaveBeenCalledWith(queryText, 20);
    expect(result.hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Actors AI automation result"
        })
      ])
    );
    expect(result.hits).toHaveLength(1);

    const persistedCandidates = await prisma.roleEvidenceCandidate.findMany({
      where: {
        roleSlug: "actors"
      }
    });

    expect(persistedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceUrl: "https://test-role-discovery.local/Actors%20AI%20automation",
          title: "Actors AI automation result",
          evidenceKind: "role_search",
          scoreEligible: true
        })
      ])
    );
    expect(result.stats.persistedCount).toBe(1);
    expect(persistedCandidates).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceUrl: "https://test-role-discovery.local/funding-noise"
        })
      ])
    );
  });

  it("uses adjudication for reviewable borderline hits and preserves MiniMax metadata", async () => {
    const provider = `test-brave-adjudication-${Date.now()}`;
    const adjudicator = vi.fn().mockResolvedValue({
      accepted: true,
      confidence: 0.83,
      reason: "The hit describes customer-support workflow changes.",
      provider: "minimax",
      model: "MiniMax-M2.7"
    });
    const search = vi.fn(async () => [
      {
        url: "https://test-role-discovery.local/support-tooling",
        title: "Customer support teams discuss new tooling",
        snippet: "Contact center leaders are evaluating new systems this year.",
        publishedAt: "2026-04-19T00:00:00.000Z"
      }
    ]);

    const result = await runRoleDiscovery("customer-service-representative", {
      provider,
      client: { search },
      maxQueries: 1,
      adjudicator
    });

    expect(adjudicator).toHaveBeenCalledOnce();
    expect(result.hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceUrl: "https://test-role-discovery.local/support-tooling"
        })
      ])
    );

    const timeline = await prisma.roleEvidenceCandidate.findMany({
      where: {
        roleSlug: "customer-service-representative",
        sourceUrl: "https://test-role-discovery.local/support-tooling"
      }
    });

    expect(timeline).toEqual([
      expect.objectContaining({
        sourceUrl: "https://test-role-discovery.local/support-tooling",
        modelProvider: "minimax",
        modelName: "MiniMax-M2.7",
        attributionConfidence: 0.83,
        timelineEligible: true
      })
    ]);
  });

  it("materializes score-eligible discovery hits into scoring evidence", async () => {
    const result = await runRoleDiscovery("customer-service-representative", {
      provider: `test-brave-score-${Date.now()}`,
      client: {
        search: vi.fn().mockResolvedValue([
          {
            url: "https://test-role-discovery.local/support-ai-score",
            title: "AI shifts customer support workflows",
            snippet: "Enterprises are routing more repetitive support work through AI systems.",
            publishedAt: "2026-04-19T00:00:00.000Z"
          }
        ])
      },
      adjudicator: vi.fn().mockResolvedValue(null),
      maxQueries: 1,
      maxResultsPerQuery: 5,
      maxTimelineItems: 5
    });

    const inference = await prisma.sourceItemInference.findFirst({
      where: {
        assignedRoleSlug: "customer-service-representative",
        sourceItem: {
          sourceUrl: "https://test-role-discovery.local/support-ai-score"
        }
      },
      include: {
        sourceItem: true
      }
    });

    expect(result.stats.persistedCount).toBeGreaterThan(0);
    expect(result.stats.scoreEligibleCount).toBeGreaterThan(0);
    expect(result.affectedRoleSlugs).toContain("customer-service-representative");
    expect(inference).toMatchObject({
      assignedRoleSlug: "customer-service-representative",
      sourceItem: {
        sourceCatalogId: expect.stringContaining("discovery-role-search"),
        sourceUrl: "https://test-role-discovery.local/support-ai-score"
      }
    });
  });

  it("skips adjudication for weak non-reviewable hits", async () => {
    const adjudicator = vi.fn();
    const search = vi.fn(async () => [
      {
        url: "https://test-role-discovery.local/support-panel",
        title: "Industry panel recap",
        snippet: "Customer support leaders met this week.",
        publishedAt: "2026-04-19T00:00:00.000Z"
      }
    ]);

    const result = await runRoleDiscovery("customer-service-representative", {
      provider: `test-brave-weak-${Date.now()}`,
      client: { search },
      maxQueries: 1,
      adjudicator
    });

    expect(adjudicator).not.toHaveBeenCalled();
    expect(result.hits).toEqual([]);
    expect(result.stats.adjudicatedCount).toBe(0);
    expect(result.stats.persistedCount).toBe(0);
  });
});
