import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateStructuredJson } from "@/lib/ai/gemini-client";
import { DEFAULT_MINIMAX_MODEL, getMiniMaxSettings } from "@/lib/ai/minimax-client";

function makeEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    ...overrides
  };
}

describe("MiniMax provider metadata", () => {
  it("defaults to the current MiniMax-M2.7 model", () => {
    const settings = getMiniMaxSettings(makeEnv());

    expect(settings.model).toBe(DEFAULT_MINIMAX_MODEL);
  });

  it("preserves minimax provider metadata on fallback results", async () => {
    const schema = z.object({ ok: z.literal(true) });

    const result = await generateStructuredJson({
      prompt: "Return {\"ok\":true}",
      schema,
      env: makeEnv({
        GEMINI_API_KEY: "gemini",
        MINIMAX_API_KEY: "minimax"
      }),
      overrides: {
        geminiGenerate: vi.fn().mockRejectedValue(
          new Error("FAILED_PRECONDITION: User location is not supported for the API use.")
        ),
        minimaxGenerate: vi.fn().mockResolvedValue("{\"ok\":true}")
      }
    });

    expect(result).toEqual({
      data: { ok: true },
      provider: "minimax",
      model: "MiniMax-M2.7"
    });
  });
});
