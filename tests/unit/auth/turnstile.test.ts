import { describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken, TurnstileVerificationError } from "@/lib/auth/turnstile";

describe("verifyTurnstileToken", () => {
  it("skips verification when TURNSTILE_SECRET_KEY is not configured", async () => {
    await expect(
      verifyTurnstileToken({
        token: null,
        remoteIp: null,
        env: { NODE_ENV: "development" },
        fetchImpl: vi.fn()
      })
    ).resolves.toEqual({ enabled: false, success: true });
  });

  it("requires a token when turnstile is enabled", async () => {
    await expect(
      verifyTurnstileToken({
        token: null,
        remoteIp: "203.0.113.10",
        env: { NODE_ENV: "production", TURNSTILE_SECRET_KEY: "secret" },
        fetchImpl: vi.fn()
      })
    ).rejects.toBeInstanceOf(TurnstileVerificationError);
  });

  it("calls cloudflare siteverify and rejects failed responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false })
    });

    await expect(
      verifyTurnstileToken({
        token: "token-123",
        remoteIp: "203.0.113.10",
        env: { NODE_ENV: "production", TURNSTILE_SECRET_KEY: "secret" },
        fetchImpl
      })
    ).rejects.toBeInstanceOf(TurnstileVerificationError);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
