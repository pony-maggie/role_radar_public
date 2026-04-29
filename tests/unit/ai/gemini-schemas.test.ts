import { describe, expect, it } from "vitest";
import {
  buildGeminiJsonConfig,
  DEFAULT_GEMINI_MODEL,
  getGeminiSettings
} from "@/lib/ai/gemini-client";
import {
  roleRiskInferenceSchema,
  sourceItemClassificationSchema
} from "@/lib/ai/gemini-schemas";

function makeEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    ...overrides
  };
}

describe("gemini inference schemas", () => {
  it("parses valid source item classification output", () => {
    const parsed = sourceItemClassificationSchema.parse({
      assignedRoleSlug: "customer-service-representative",
      sourceKind: "official",
      signalType: "workflow_restructure",
      relevance: "high",
      impactDirection: "increase",
      explanation: "The item describes a direct support workflow replacement.",
      summaryEn: "AI support workflow expanded",
      summaryZh: null,
      signalWeight: "primary"
    });

    expect(parsed.assignedRoleSlug).toBe("customer-service-representative");
    expect(parsed.signalType).toBe("workflow_restructure");
    expect(parsed.signalWeight).toBe("primary");
  });

  it("parses valid role risk inference output", () => {
    const parsed = roleRiskInferenceSchema.parse({
      replacementRate: 72,
      riskBand: "high",
      summaryEn: "Recent adoption signals indicate rising automation pressure.",
      summaryZh: null,
      reasons: [
        {
          kind: "official",
          titleEn: "Support triage is moving into AI-first workflows.",
          titleZh: null,
          detailEn: "Recent company rollouts show first-line work shifting into AI triage.",
          detailZh: null
        }
      ]
    });

    expect(parsed.replacementRate).toBe(72);
    expect(parsed.riskBand).toBe("high");
  });

  it("rejects malformed inference output", () => {
    expect(() =>
      roleRiskInferenceSchema.parse({
        replacementRate: 180,
        riskBand: "extreme",
        summaryEn: "",
        reasons: []
      })
    ).toThrow();
  });

  it("uses gemini-2.5-flash as the default model and builds json schema config", () => {
    const settings = getGeminiSettings(makeEnv());
    const config = buildGeminiJsonConfig(sourceItemClassificationSchema);

    expect(settings.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(config.responseMimeType).toBe("application/json");
    expect(config.responseJsonSchema).toMatchObject({
      type: "object"
    });
  });
});
