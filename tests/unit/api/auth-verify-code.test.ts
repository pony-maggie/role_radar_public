import { beforeEach, describe, expect, it, vi } from "vitest";

describe("POST /api/auth/verify-code", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 429 when verification is temporarily locked", async () => {
    const email = `user-${Date.now()}@example.com`;
    vi.doMock("@/lib/auth/email-auth", async () => {
      const actual = await vi.importActual<typeof import("@/lib/auth/email-auth")>("@/lib/auth/email-auth");
      return {
        ...actual,
        verifyEmailCode: vi.fn().mockRejectedValue(
          new actual.AuthThrottleError("Too many verification attempts. Try again later.")
        )
      };
    });

    const { POST } = await import("@/app/api/auth/verify-code/route");

    const response = await POST(
      new Request("http://localhost/api/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ email, code: "123456" }),
        headers: { "content-type": "application/json" }
      })
    );

    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json).toEqual({ error: "Too many verification attempts. Try again later." });
  });
});
