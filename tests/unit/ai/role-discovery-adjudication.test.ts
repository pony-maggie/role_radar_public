import { describe, expect, it, vi } from "vitest";
import { adjudicateRoleDiscoveryCandidate } from "@/lib/ai/role-discovery-adjudication";

function makeEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    ...overrides
  };
}

const input = {
  role: {
    slug: "actors",
    nameEn: "Actors",
    nameZh: "演员",
    aliases: ["performers"],
    tasks: ["voice performance", "script review"]
  },
  candidate: {
    url: "https://example.com/actors-ai",
    title: "Actors discuss AI dubbing tools",
    snippet: "Studios are exploring AI dubbing across more productions.",
    publishedAt: "2026-04-19T00:00:00.000Z"
  }
};

describe("adjudicateRoleDiscoveryCandidate", () => {
  it("prefers MiniMax for role-discovery adjudication when available", async () => {
    const structuredJsonGenerator = vi.fn().mockResolvedValue({
      data: {
        accepted: true,
        confidence: 0.77,
        reason: "The hit clearly describes actor workflows affected by AI dubbing."
      },
      provider: "minimax",
      model: "MiniMax-M2.7"
    });

    const result = await adjudicateRoleDiscoveryCandidate(input, {
      env: makeEnv({
        GEMINI_API_KEY: "gemini-key",
        MINIMAX_API_KEY: "minimax-key"
      }),
      structuredJsonGenerator
    });

    expect(structuredJsonGenerator).toHaveBeenCalledOnce();
    expect(structuredJsonGenerator.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        env: expect.objectContaining({
          GEMINI_ENABLED: "0"
        })
      })
    );
    expect(result).toEqual({
      accepted: true,
      confidence: 0.77,
      reason: "The hit clearly describes actor workflows affected by AI dubbing.",
      provider: "minimax",
      model: "MiniMax-M2.7"
    });
  });

  it("falls back to Gemini when MiniMax-first adjudication fails", async () => {
    const structuredJsonGenerator = vi
      .fn()
      .mockRejectedValueOnce(new Error("MiniMax authentication failed: invalid api key"))
      .mockResolvedValueOnce({
        data: {
          accepted: false,
          confidence: 0.42,
          reason: "The hit is too broad to attach confidently."
        },
        provider: "gemini",
        model: "gemini-2.5-flash"
      });

    const result = await adjudicateRoleDiscoveryCandidate(input, {
      env: makeEnv({
        GEMINI_API_KEY: "gemini-key",
        MINIMAX_API_KEY: "minimax-key"
      }),
      structuredJsonGenerator
    });

    expect(structuredJsonGenerator).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      accepted: false,
      confidence: 0.42,
      reason: "The hit is too broad to attach confidently.",
      provider: "gemini",
      model: "gemini-2.5-flash"
    });
  });
});
