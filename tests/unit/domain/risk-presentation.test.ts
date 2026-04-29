import { describe, expect, it } from "vitest";
import { presentRisk } from "@/lib/domain/risk-presentation";

describe("presentRisk", () => {
  it("maps rated levels to bounded percentage displays", () => {
    expect(presentRisk({ riskLevel: "LOW", ratingStatus: "RATED" })).toMatchObject({
      percentage: 18,
      label: "18%"
    });
    expect(presentRisk({ riskLevel: "MEDIUM", ratingStatus: "RATED" })).toMatchObject({
      percentage: 43,
      label: "43%"
    });
    expect(presentRisk({ riskLevel: "HIGH", ratingStatus: "RATED" })).toMatchObject({
      percentage: 68,
      label: "68%"
    });
    expect(presentRisk({ riskLevel: "SEVERE", ratingStatus: "RATED" })).toMatchObject({
      percentage: 86,
      label: "86%"
    });
  });

  it("returns an insufficient-signal fallback without a percentage", () => {
    expect(presentRisk({ riskLevel: "LOW", ratingStatus: "INSUFFICIENT_SIGNAL" })).toMatchObject({
      percentage: null,
      label: "Signal pending"
    });
  });
});
