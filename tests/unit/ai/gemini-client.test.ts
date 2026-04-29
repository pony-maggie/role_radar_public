import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  DEFAULT_GEMINI_MODEL,
  generateStructuredJson,
  getGeminiSettings
} from "@/lib/ai/gemini-client";

function makeEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    ...overrides
  };
}

describe("getGeminiSettings", () => {
  it("still prefers GEMINI_API_KEY over GOOGLE_API_KEY", () => {
    const settings = getGeminiSettings(makeEnv({
      GEMINI_API_KEY: "gemini-key",
      GOOGLE_API_KEY: "google-key"
    }));

    expect(settings.apiKey).toBe("gemini-key");
  });

  it("uses the default model when none is configured", () => {
    const settings = getGeminiSettings(makeEnv());

    expect(settings.model).toBe(DEFAULT_GEMINI_MODEL);
  });
});

describe("generateStructuredJson", () => {
  it("returns provider metadata when Gemini succeeds", async () => {
    const schema = z.object({ ok: z.literal(true) });
    const geminiGenerate = vi.fn().mockResolvedValue("{\"ok\":true}");

    const result = await generateStructuredJson({
      prompt: "Return {\"ok\":true}",
      schema,
      env: makeEnv({
        GEMINI_API_KEY: "gemini",
        GEMINI_MODEL: "gemini-2.5-flash"
      }),
      overrides: {
        geminiGenerate
      }
    });

    expect(geminiGenerate).toHaveBeenCalledOnce();
    expect(result).toEqual({
      data: { ok: true },
      provider: "gemini",
      model: "gemini-2.5-flash"
    });
  });

  it("falls back to MiniMax when Gemini fails with location unsupported", async () => {
    const schema = z.object({ ok: z.literal(true) });
    const geminiGenerate = vi.fn().mockRejectedValue(
      new Error("FAILED_PRECONDITION: User location is not supported for the API use.")
    );
    const minimaxGenerate = vi.fn().mockResolvedValue("{\"ok\":true}");

    const result = await generateStructuredJson({
      prompt: "Return {\"ok\":true}",
      schema,
      env: makeEnv({
        GEMINI_API_KEY: "gemini",
        MINIMAX_API_KEY: "minimax"
      }),
      overrides: {
        geminiGenerate,
        minimaxGenerate
      }
    });

    expect(geminiGenerate).toHaveBeenCalledOnce();
    expect(minimaxGenerate).toHaveBeenCalledOnce();
    expect(result).toEqual({
      data: { ok: true },
      provider: "minimax",
      model: "MiniMax-M2.7"
    });
  });

  it("calls the OpenAI-compatible MiniMax chat completions endpoint with model and messages", async () => {
    const schema = z.object({ ok: z.literal(true) });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      statusText: "OK",
      json: async () => ({
        choices: [
          {
            message: {
              content: "{\"ok\":true}"
            }
          }
        ],
        model: "MiniMax-M2.7"
      })
    });
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await generateStructuredJson({
        prompt: "Return {\"ok\":true}",
        schema,
        systemInstruction: "Return only JSON.",
        env: makeEnv({
          GEMINI_API_KEY: "gemini",
          MINIMAX_API_KEY: "minimax"
        }),
        overrides: {
          geminiGenerate: vi.fn().mockRejectedValue(
            new Error("FAILED_PRECONDITION: User location is not supported for the API use.")
          )
        }
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.minimaxi.com/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer minimax",
            "Content-Type": "application/json"
          })
        })
      );

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(String(init.body))).toEqual({
        model: "MiniMax-M2.7",
        messages: [
          {
            role: "system",
            content: "Return only JSON."
          },
          {
            role: "user",
            content: 'Return {"ok":true}'
          }
        ]
      });
      expect(result).toEqual({
        data: { ok: true },
        provider: "minimax",
        model: "MiniMax-M2.7"
      });
    } finally {
      vi.unstubAllGlobals();
      if (originalFetch) {
        vi.stubGlobal("fetch", originalFetch);
      }
    }
  });

  it("parses MiniMax JSON responses even when the model prepends a <think> block", async () => {
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
        minimaxGenerate: vi.fn().mockResolvedValue(
          "<think>Reasoning omitted</think>\n\n{\"ok\":true}"
        )
      }
    });

    expect(result).toEqual({
      data: { ok: true },
      provider: "minimax",
      model: "MiniMax-M2.7"
    });
  });

  it("uses the current official minimax default model when falling back", async () => {
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

  it("surfaces an explicit minimax invalid-key failure during fallback", async () => {
    const schema = z.object({ ok: z.literal(true) });
    const geminiGenerate = vi.fn().mockRejectedValue(
      new Error("FAILED_PRECONDITION: User location is not supported for the API use.")
    );
    const minimaxGenerate = vi.fn().mockRejectedValue(
      new Error("MiniMax authentication failed: invalid api key")
    );

    await expect(
      generateStructuredJson({
        prompt: "Return {\"ok\":true}",
        schema,
        env: makeEnv({
          GEMINI_API_KEY: "gemini",
          MINIMAX_API_KEY: "minimax"
        }),
        overrides: {
          geminiGenerate,
          minimaxGenerate
        }
      })
    ).rejects.toThrow("MiniMax authentication failed: invalid api key");

    expect(geminiGenerate).toHaveBeenCalledOnce();
    expect(minimaxGenerate).toHaveBeenCalledOnce();
  });
});
