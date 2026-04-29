import { describe, expect, it } from "vitest";

import { deriveItemStrategy } from "@/lib/ingest/item-strategy";

describe("item strategy derivation", () => {
  it("maps official company updates into the official capability lane", () => {
    expect(
      deriveItemStrategy({
        sourceClass: "official",
        sourceType: "COMPANY_UPDATE"
      })
    ).toMatchObject({
      strategyId: "official_capability_update",
      defaultSignalType: "capability_update",
      canAffectReplacementRate: true,
      attributionBias: "balanced"
    });
  });

  it("maps media news into the media adoption lane", () => {
    expect(
      deriveItemStrategy({
        sourceClass: "media",
        sourceType: "NEWS"
      })
    ).toMatchObject({
      strategyId: "media_adoption_case",
      defaultSignalType: "adoption_case",
      canAffectReplacementRate: true,
      attributionBias: "conservative"
    });
  });

  it("maps job postings into the hiring-shift lane", () => {
    expect(
      deriveItemStrategy({
        sourceClass: "jobs",
        sourceType: "JOB_POSTING"
      })
    ).toMatchObject({
      strategyId: "jobs_hiring_shift",
      defaultSignalType: "hiring_shift",
      canAffectReplacementRate: true,
      attributionBias: "balanced"
    });
  });

  it("treats broad ecosystem classifications as non-rate-affecting even on official sources", () => {
    expect(
      deriveItemStrategy({
        sourceClass: "official",
        sourceType: "COMPANY_UPDATE",
        classification: {
          sourceKind: "other",
          signalType: "ecosystem_context"
        }
      })
    ).toMatchObject({
      strategyId: "broad_ecosystem_context",
      defaultSignalType: "ecosystem_context",
      canAffectReplacementRate: false,
      attributionBias: "conservative"
    });
  });

  it("falls back to broad ecosystem context for non-core source classes", () => {
    expect(
      deriveItemStrategy({
        sourceClass: "ecosystem",
        sourceType: "NEWS"
      })
    ).toMatchObject({
      strategyId: "broad_ecosystem_context",
      defaultSignalType: "ecosystem_context",
      canAffectReplacementRate: false,
      attributionBias: "conservative"
    });
  });
});
