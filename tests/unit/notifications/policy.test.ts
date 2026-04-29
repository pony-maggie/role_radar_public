import { describe, expect, it } from "vitest";
import {
  SIGNIFICANT_CHANGE_THRESHOLD,
  formatReplacementDelta,
  hasSignificantReplacementRateChange,
  isWeeklyDigestDue
} from "@/lib/notifications/policy";

describe("isWeeklyDigestDue", () => {
  it("returns true once the digest interval has elapsed", () => {
    expect(
      isWeeklyDigestDue({
        lastDigestSentAt: null,
        oldestSubscriptionCreatedAt: new Date("2026-04-01T00:00:00.000Z"),
        now: new Date("2026-04-08T00:00:00.000Z")
      })
    ).toBe(true);
  });

  it("returns false when the watchlist is still fresh", () => {
    expect(
      isWeeklyDigestDue({
        lastDigestSentAt: new Date("2026-04-06T00:00:00.000Z"),
        oldestSubscriptionCreatedAt: new Date("2026-04-01T00:00:00.000Z"),
        now: new Date("2026-04-08T00:00:00.000Z")
      })
    ).toBe(false);
  });
});

describe("hasSignificantReplacementRateChange", () => {
  it("requires a meaningful delta and a fresh rerate", () => {
    expect(
      hasSignificantReplacementRateChange({
        baselineReplacementRate: 42,
        currentReplacementRate: 42 + SIGNIFICANT_CHANGE_THRESHOLD,
        lastRatedAt: new Date("2026-04-13T00:00:00.000Z"),
        subscriptionCreatedAt: new Date("2026-04-10T00:00:00.000Z"),
        lastAlertSentAt: null
      })
    ).toBe(true);
  });

  it("rejects stale or tiny changes", () => {
    expect(
      hasSignificantReplacementRateChange({
        baselineReplacementRate: 42,
        currentReplacementRate: 45,
        lastRatedAt: new Date("2026-04-13T00:00:00.000Z"),
        subscriptionCreatedAt: new Date("2026-04-10T00:00:00.000Z"),
        lastAlertSentAt: null
      })
    ).toBe(false);

    expect(
      hasSignificantReplacementRateChange({
        baselineReplacementRate: 42,
        currentReplacementRate: 55,
        lastRatedAt: new Date("2026-04-11T00:00:00.000Z"),
        subscriptionCreatedAt: new Date("2026-04-10T00:00:00.000Z"),
        lastAlertSentAt: new Date("2026-04-12T00:00:00.000Z")
      })
    ).toBe(false);
  });
});

describe("formatReplacementDelta", () => {
  it("reports direction and absolute movement", () => {
    expect(formatReplacementDelta(44, 57)).toEqual({
      delta: 13,
      direction: "up",
      absoluteDelta: 13
    });
  });
});
