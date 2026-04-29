import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  listRoleEvidenceTimeline,
  listSearchHitsForRun,
  upsertRoleEvidenceCandidate,
  upsertSearchQueryRun
} from "@/lib/repositories/role-discovery";

describe("role discovery repositories", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.roleEvidenceCandidate.deleteMany({
      where: {
        sourceUrl: {
          startsWith: "https://test-role-discovery.local/repository-"
        }
      }
    });

    await prisma.searchHit.deleteMany({
      where: {
        run: {
          provider: {
            startsWith: "test-brave-repository"
          }
        }
      }
    });

    await prisma.searchQueryRun.deleteMany({
      where: {
        provider: {
          startsWith: "test-brave-repository"
        }
      }
    });
  });

  it("upserts search query runs by stable query hash", async () => {
    const queryHash = `test-role-query-hash-${Date.now()}`;

    const created = await upsertSearchQueryRun({
      roleSlug: "actors",
      provider: "test-brave-repository",
      queryText: "Actors AI automation",
      queryHash,
      status: "SUCCESS",
      expiresAt: new Date("2099-04-20T00:00:00.000Z"),
      hits: [
        {
          rank: 1,
          sourceUrl: "https://test-role-discovery.local/repository-actors-ai",
          title: "Actors use AI doubles",
          snippet: "Studios adopt AI doubles for some production work.",
          publishedAt: "2026-04-19T00:00:00.000Z"
        }
      ]
    });

    const updated = await upsertSearchQueryRun({
      roleSlug: "actors",
      provider: "test-brave-repository",
      queryText: "Actors AI automation",
      queryHash,
      status: "SUCCESS",
      expiresAt: new Date("2099-04-21T00:00:00.000Z"),
      hits: [
        {
          rank: 1,
          sourceUrl: "https://test-role-discovery.local/repository-actors-ai-updated",
          title: "Actors use updated AI doubles",
          snippet: "Studios refine AI-double workflows.",
          publishedAt: "2026-04-20T00:00:00.000Z"
        }
      ]
    });

    expect(updated.id).toBe(created.id);

    const hits = await listSearchHitsForRun(updated.id);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      sourceUrl: "https://test-role-discovery.local/repository-actors-ai-updated",
      title: "Actors use updated AI doubles"
    });
  });

  it("stores timeline-eligible evidence candidates per role slug", async () => {
    const sourceUrl = `https://test-role-discovery.local/repository-role-evidence-${Date.now()}`;

    await upsertRoleEvidenceCandidate({
      roleSlug: "customer-service-representative",
      sourceUrl,
      title: "Support teams adopt AI ticket triage",
      snippet: "AI agents now handle ticket routing and repetitive support work.",
      sourceLabel: "Role Search",
      evidenceKind: "role_search",
      timelineEligible: true,
      scoreEligible: false,
      attributionConfidence: 0.82,
      modelProvider: "minimax",
      modelName: "MiniMax-M2.7",
      rawJson: {
        source: "test"
      }
    });

    const timeline = await listRoleEvidenceTimeline("customer-service-representative", 10);

    expect(timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceUrl,
          title: "Support teams adopt AI ticket triage",
          sourceLabel: "Role Search",
          modelProvider: "minimax"
        })
      ])
    );
  });

  it("drops invalid publishedAt values instead of crashing persistence", async () => {
    const queryHash = `test-role-query-invalid-date-${Date.now()}`;

    const run = await upsertSearchQueryRun({
      roleSlug: "acupuncturists",
      provider: "test-brave-repository",
      queryText: "Acupuncturists AI automation",
      queryHash,
      status: "SUCCESS",
      expiresAt: new Date("2099-04-20T00:00:00.000Z"),
      hits: [
        {
          rank: 1,
          sourceUrl: "https://test-role-discovery.local/repository-invalid-date",
          title: "AI software for acupuncturists",
          snippet: "Automation platform for acupuncture practices.",
          publishedAt: "Invalid Date"
        }
      ]
    });

    const hits = await listSearchHitsForRun(run.id);
    expect(hits).toEqual([
      expect.objectContaining({
        sourceUrl: "https://test-role-discovery.local/repository-invalid-date",
        publishedAt: null
      })
    ]);
  });
});
