import { describe, expect, it } from "vitest";
import { rankRoleDiscoveryCandidates } from "@/lib/role-discovery/rank-candidates";

const context = {
  roleSlug: "actors",
  roleNameEn: "Actors",
  roleNameZh: "演员",
  aliases: ["performers"],
  tasks: ["voice performance", "script review"]
};

describe("rankRoleDiscoveryCandidates", () => {
  it("ranks stronger workflow evidence ahead of generic role mentions", () => {
    const ranked = rankRoleDiscoveryCandidates([
      {
        url: "https://example.com/generic",
        title: "Actors discuss AI on set",
        snippet: "A broad discussion about AI in the industry.",
        publishedAt: "2026-04-18T00:00:00.000Z"
      },
      {
        url: "https://example.com/workflow",
        title: "Studios use AI doubles to automate voice performance workflows",
        snippet: "Actors and performers are seeing voice-performance tasks compressed by AI tools.",
        publishedAt: "2026-04-17T00:00:00.000Z"
      }
    ], context);

    expect(ranked[0]).toEqual(
      expect.objectContaining({
        url: "https://example.com/workflow"
      })
    );
    expect(ranked[0]!.discoveryScore).toBeGreaterThan(ranked[1]!.discoveryScore);
  });

  it("does not treat role synonyms as workflow evidence", () => {
    const ranked = rankRoleDiscoveryCandidates([
      {
        url: "https://example.com/support-panel",
        title: "Industry panel recap",
        snippet: "Customer support leaders met this week.",
        publishedAt: "2026-04-19T00:00:00.000Z"
      }
    ], {
      roleSlug: "customer-service-representative",
      roleNameEn: "Customer Service Representative",
      roleNameZh: "客户服务专员",
      aliases: ["customer support", "support ops"],
      tasks: ["customer support", "help desk", "call center"]
    });

    expect(ranked).toEqual([
      expect.objectContaining({
        url: "https://example.com/support-panel",
        accepted: false,
        reviewable: false,
        discoveryScore: 2
      })
    ]);
  });
});
