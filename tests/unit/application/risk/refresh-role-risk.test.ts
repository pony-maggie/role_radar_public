import { describe, expect, it } from "vitest";
import { refreshRoleRiskUseCase } from "@/lib/application/risk/refresh-role-risk";

describe("refreshRoleRiskUseCase", () => {
  it("throws for an unknown role slug", async () => {
    await expect(refreshRoleRiskUseCase("missing-role-slug-for-test")).rejects.toThrow(
      "Unknown role: missing-role-slug-for-test"
    );
  });
});
