import { describe, expect, it } from "vitest";
import attributionFixtures from "@/data/regression/source-item-attribution-regression.json";
import roleRiskFixtures from "@/data/regression/role-risk-regression.json";

describe("source-item attribution regression fixtures", () => {
  it("keeps a precision-first real-source regression set with 20+ items", () => {
    expect(attributionFixtures.length).toBeGreaterThanOrEqual(20);

    for (const fixture of attributionFixtures) {
      expect(fixture.id).toBeTruthy();
      expect(fixture.sourceLabel).toBeTruthy();
      expect(fixture.sourceUrl).toMatch(/^https?:\/\//);
      expect(fixture.title).toBeTruthy();
      expect(fixture.summary).toBeTruthy();
      expect(typeof fixture.expectedAssignedRoleSlug === "string" || fixture.expectedAssignedRoleSlug === null).toBe(
        true
      );
      expect(fixture.note).toBeTruthy();
    }
  });
});

describe("role-risk regression fixtures", () => {
  it("defines bounded rate expectations for scored seed roles", () => {
    expect(roleRiskFixtures.length).toBeGreaterThanOrEqual(3);

    for (const fixture of roleRiskFixtures) {
      expect(fixture.roleSlug).toBeTruthy();
      expect(fixture.expectedReplacementRateMin).toBeGreaterThanOrEqual(0);
      expect(fixture.expectedReplacementRateMax).toBeLessThanOrEqual(100);
      expect(fixture.expectedReplacementRateMin).toBeLessThanOrEqual(fixture.expectedReplacementRateMax);
      expect(["low", "medium", "high", "severe"]).toContain(fixture.expectedRiskBand);
      expect(fixture.items.length).toBeGreaterThan(0);
    }
  });
});
