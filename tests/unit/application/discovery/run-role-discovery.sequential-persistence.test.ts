import { afterEach, describe, expect, it, vi } from "vitest";

const {
  findUniqueRoleDictionary,
  findFreshSearchQueryRunByHash,
  listSearchHitsForRun,
  upsertRoleEvidenceCandidate,
  upsertSearchQueryRun,
  persistDiscoveryScoringEvidence,
  rankRoleDiscoveryCandidates,
  filterRoleDiscoveryCandidates,
  state
} = vi.hoisted(() => {
  const state = {
    persistedHits: [] as Array<{
      sourceUrl: string;
      title: string;
      snippet: string;
      publishedAt: Date | null;
    }>
  };

  let persistenceInFlight = false;

  return {
    findUniqueRoleDictionary: vi.fn(async () => ({
      slug: "actors",
      nameEn: "Actors",
      nameZh: "演员",
      keywords: ["auditions", "casting"],
      role: null
    })),
    findFreshSearchQueryRunByHash: vi.fn(async () => null),
    listSearchHitsForRun: vi.fn(async () => state.persistedHits),
    upsertRoleEvidenceCandidate: vi.fn(async () => null),
    upsertSearchQueryRun: vi.fn(async ({ hits }: { hits: typeof state.persistedHits }) => {
      state.persistedHits = hits.map((hit) => ({
        sourceUrl: hit.sourceUrl,
        title: hit.title,
        snippet: hit.snippet,
        publishedAt: hit.publishedAt ? new Date(hit.publishedAt) : null
      }));

      return { id: "run-1" };
    }),
    persistDiscoveryScoringEvidence: vi.fn(
      async (input: {
        sourceUrl: string;
      }) => {
        if (persistenceInFlight) {
          throw new Error(`Concurrent discovery scoring persistence detected for ${input.sourceUrl}`);
        }

        persistenceInFlight = true;

        await new Promise((resolve) => setTimeout(resolve, 0));

        persistenceInFlight = false;

        return {
          sourceItem: {
            id: input.sourceUrl
          }
        };
      }
    ),
    rankRoleDiscoveryCandidates: vi.fn(
      (hits: Array<{ url: string; title: string; snippet: string; publishedAt: string | null }>) =>
        hits.map((hit, index) => ({
          url: hit.url,
          title: hit.title,
          snippet: hit.snippet,
          publishedAt: hit.publishedAt,
          discoveryScore: 9 - index,
          accepted: true,
          reviewable: false
        }))
    ),
    filterRoleDiscoveryCandidates: vi.fn(
      (hits: Array<{ url: string; title: string; snippet: string; publishedAt: string | null }>) =>
        hits.map((hit) => ({
          url: hit.url,
          title: hit.title,
          snippet: hit.snippet,
          publishedAt: hit.publishedAt,
          discoveryScore: 9,
          accepted: true,
          reviewable: false
        }))
    ),
    state
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    roleDictionary: {
      findUnique: findUniqueRoleDictionary
    }
  }
}));

vi.mock("@/lib/ai/role-discovery-adjudication", () => ({
  adjudicateRoleDiscoveryCandidate: vi.fn()
}));

vi.mock("@/lib/ingest/role-aliases", () => ({
  ROLE_ALIASES: {}
}));

vi.mock("@/lib/role-discovery/cache-keys", () => ({
  buildRoleDiscoveryQueryHash: vi.fn(() => "query-hash")
}));

vi.mock("@/lib/role-discovery/filter-candidates", () => ({
  filterRoleDiscoveryCandidates,
  isLikelyEvergreenExplainer: vi.fn(() => false),
  isLikelyLandingPage: vi.fn(() => false)
}));

vi.mock("@/lib/role-discovery/query-builder", () => ({
  buildRoleDiscoveryQueries: vi.fn(() => ["actors ai automation"])
}));

vi.mock("@/lib/role-discovery/rank-candidates", () => ({
  rankRoleDiscoveryCandidates
}));

vi.mock("@/lib/repositories/role-discovery", () => ({
  findFreshSearchQueryRunByHash,
  listSearchHitsForRun,
  upsertRoleEvidenceCandidate,
  upsertSearchQueryRun
}));

vi.mock("@/lib/repositories/source-items", () => ({
  persistDiscoveryScoringEvidence
}));

import { runRoleDiscovery } from "@/lib/application/discovery/run-role-discovery";

afterEach(() => {
  vi.clearAllMocks();
  state.persistedHits = [];
});

describe("runRoleDiscovery sequential scoring persistence", () => {
  it("persists score-eligible discovery evidence sequentially", async () => {
    const search = vi.fn(async () => [
      {
        url: "https://test-role-discovery.local/actors-ai-workflows",
        title: "Actors see AI reshape audition workflows",
        snippet: "Studios are using AI to automate repetitive casting prep.",
        publishedAt: "2026-04-24T00:00:00.000Z"
      },
      {
        url: "https://test-role-discovery.local/actors-agent-tooling",
        title: "AI tooling changes how talent agents prep actors",
        snippet: "New workflow software reduces manual prep for routine submissions.",
        publishedAt: "2026-04-23T00:00:00.000Z"
      }
    ]);

    const result = await runRoleDiscovery("actors", {
      provider: "test-brave-sequential-persistence",
      client: { search },
      maxQueries: 1,
      maxResultsPerQuery: 5,
      maxTimelineItems: 5
    });

    expect(search).toHaveBeenCalledWith("actors ai automation", 5);
    expect(persistDiscoveryScoringEvidence).toHaveBeenCalledTimes(2);
    expect(result.stats.scoreEligibleCount).toBe(2);
    expect(result.affectedRoleSlugs).toEqual(["actors"]);
  });
});
