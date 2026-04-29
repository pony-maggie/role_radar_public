import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateStructuredJsonForTask } from "@/lib/ai/task-routing";

function makeEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    ...overrides
  };
}

describe("generateStructuredJsonForTask", () => {
  it("runs role discovery adjudication with MiniMax-first routing", async () => {
    const generator = vi.fn().mockResolvedValue({
      provider: "minimax",
      model: "MiniMax-M2.7",
      data: { ok: true }
    });

    const result = await generateStructuredJsonForTask({
      task: "role_discovery_adjudication",
      prompt: "Return ok",
      schema: z.object({ ok: z.literal(true) }),
      env: makeEnv({
        GEMINI_API_KEY: "gemini-key",
        MINIMAX_API_KEY: "minimax-key"
      }),
      structuredJsonGenerator: generator
    });

    expect(generator).toHaveBeenCalledOnce();
    expect(generator.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        env: expect.objectContaining({
          GEMINI_ENABLED: "0"
        })
      })
    );
    expect(result.provider).toBe("minimax");
  });

  it("falls back to MiniMax for source classification when Gemini-first routing fails", async () => {
    const generator = vi
      .fn()
      .mockRejectedValueOnce(new Error("Gemini unavailable"))
      .mockResolvedValueOnce({
        provider: "minimax",
        model: "MiniMax-M2.7",
        data: { ok: true }
      });

    const result = await generateStructuredJsonForTask({
      task: "source_classification",
      prompt: "Return ok",
      schema: z.object({ ok: z.literal(true) }),
      env: makeEnv({
        GEMINI_API_KEY: "gemini-key",
        MINIMAX_API_KEY: "minimax-key"
      }),
      structuredJsonGenerator: generator
    });

    expect(generator).toHaveBeenCalledTimes(2);
    expect(generator.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        env: expect.objectContaining({
          MINIMAX_ENABLED: "0"
        })
      })
    );
    expect(result.provider).toBe("minimax");
  });
});
