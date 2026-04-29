import { describe, expect, it } from "vitest";
import { collectRefreshTargetRoleSlugs } from "@/lib/application/discovery/collect-refresh-target-role-slugs";

describe("collectRefreshTargetRoleSlugs", () => {
  it("dedupes affected-role slugs from all supported discovery result fields", () => {
    expect(
      collectRefreshTargetRoleSlugs({
        affectedRoleSlugs: ["actors"],
        affectedRoles: [{ roleSlug: "actors" }, { slug: "customer-service-representative" }],
        scoreEligibleSignals: [{ assignedRoleSlug: "customer-service-representative" }, "actors"]
      })
    ).toEqual(["actors", "customer-service-representative"]);
  });

  it("falls back to the next non-empty slug when a preferred field is blank", () => {
    expect(
      collectRefreshTargetRoleSlugs({
        affectedRoles: [{ roleSlug: "", slug: "customer-service-representative" }],
        scoreEligibleSignals: [{ roleSlug: " ", assignedRoleSlug: "actors" }]
      })
    ).toEqual(["customer-service-representative", "actors"]);
  });
});
