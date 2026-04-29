import { describe, expect, it } from "vitest";
import { DEFAULT_MINIMAX_MODEL, getMiniMaxSettings } from "@/lib/ai/minimax-client";

function makeEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    ...overrides
  };
}

describe("getMiniMaxSettings", () => {
  it("reads MiniMax settings from env and defaults enabled", () => {
    const settings = getMiniMaxSettings(makeEnv({
      MINIMAX_API_KEY: "test-key",
      MINIMAX_MODEL: "MiniMax-M2.5",
      MINIMAX_ENABLED: "1"
    }));

    expect(settings).toEqual({
      apiKey: "test-key",
      enabled: true,
      model: "MiniMax-M2.5"
    });
  });

  it("uses the default model when none is configured", () => {
    const settings = getMiniMaxSettings(makeEnv());

    expect(settings.model).toBe(DEFAULT_MINIMAX_MODEL);
  });
});
