import { describe, expect, it } from "vitest";

import { getSeedOptions } from "@/prisma/seed-options";

describe("seed options", () => {
  it("preserves ingested source data by default", () => {
    expect(getSeedOptions({})).toEqual({
      resetIngestData: false
    });
  });

  it("allows explicit ingest-data reset when requested", () => {
    expect(
      getSeedOptions({
        ROLE_RADAR_RESET_INGEST_DATA: "1"
      })
    ).toEqual({
      resetIngestData: true
    });
  });
});
