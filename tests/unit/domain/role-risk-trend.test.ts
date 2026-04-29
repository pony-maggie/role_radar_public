import { describe, expect, it } from "vitest";
import { buildRoleRiskTrend } from "@/lib/domain/role-risk-trend";

describe("buildRoleRiskTrend", () => {
  it("aggregates snapshots into local-calendar week and month buckets", () => {
    const result = buildRoleRiskTrend([
      { snapshotAt: new Date("2030-04-01T00:30:00+08:00"), replacementRate: 60 },
      { snapshotAt: new Date("2030-04-08T00:00:00+08:00"), replacementRate: 64 },
      { snapshotAt: new Date("2030-05-01T00:00:00+08:00"), replacementRate: 68 },
      { snapshotAt: new Date("2030-05-15T00:00:00+08:00"), replacementRate: null }
    ]);

    expect(result.week).toEqual([
      { bucketLabel: "2030-04-01", averageReplacementRate: 60, pointCount: 1 },
      { bucketLabel: "2030-04-08", averageReplacementRate: 64, pointCount: 1 },
      { bucketLabel: "2030-04-29", averageReplacementRate: 68, pointCount: 1 }
    ]);
    expect(result.month).toEqual([
      { bucketLabel: "2030-04", averageReplacementRate: 62, pointCount: 2 },
      { bucketLabel: "2030-05", averageReplacementRate: 68, pointCount: 1 }
    ]);
  });
});
