import { beforeEach, describe, expect, it, vi } from "vitest";

const sendVerificationCodeEmail = vi.fn().mockResolvedValue({ messageId: "test-message" });

vi.mock("@/lib/email/mailer", () => ({
  sendVerificationCodeEmail
}));

describe("POST /api/auth/request-code", () => {
  beforeEach(() => {
    sendVerificationCodeEmail.mockClear();
  });

  it("sends a verification email and does not echo the code when SMTP is configured", async () => {
    const email = `user-${Date.now()}@example.com`;
    vi.resetModules();
    vi.doMock("@/lib/email/config", () => ({
      isSmtpConfigured: () => true
    }));
    vi.doMock("@/lib/auth/turnstile", async () => {
      const actual = await vi.importActual<typeof import("@/lib/auth/turnstile")>("@/lib/auth/turnstile");
      return {
        ...actual,
        verifyTurnstileToken: vi.fn().mockResolvedValue(undefined)
      };
    });

    const { POST } = await import("@/app/api/auth/request-code/route");

    const response = await POST(
      new Request("http://localhost/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "content-type": "application/json" }
      })
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(sendVerificationCodeEmail).toHaveBeenCalledTimes(1);
  });

  it("returns 429 when the request is throttled", async () => {
    const email = `user-${Date.now()}@example.com`;
    vi.resetModules();
    vi.doMock("@/lib/email/config", () => ({
      isSmtpConfigured: () => false
    }));
    vi.doMock("@/lib/auth/turnstile", async () => {
      const actual = await vi.importActual<typeof import("@/lib/auth/turnstile")>("@/lib/auth/turnstile");
      return {
        ...actual,
        verifyTurnstileToken: vi.fn().mockResolvedValue(undefined)
      };
    });
    vi.doMock("@/lib/auth/email-auth", async () => {
      const actual = await vi.importActual<typeof import("@/lib/auth/email-auth")>("@/lib/auth/email-auth");
      return {
        ...actual,
        issueVerificationCode: vi.fn().mockRejectedValue(
          new actual.AuthThrottleError("Please wait before requesting another code")
        )
      };
    });

    const { POST } = await import("@/app/api/auth/request-code/route");

    const response = await POST(
      new Request("http://localhost/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "content-type": "application/json" }
      })
    );

    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json).toEqual({ error: "Please wait before requesting another code" });
  });

  it("returns 403 when turnstile is enabled and the token is missing", async () => {
    const email = `user-${Date.now()}@example.com`;
    vi.resetModules();
    vi.doMock("@/lib/email/config", () => ({
      isSmtpConfigured: () => false
    }));
    vi.doMock("@/lib/auth/request-code-guard", async () => {
      const actual = await vi.importActual<typeof import("@/lib/auth/request-code-guard")>("@/lib/auth/request-code-guard");
      return {
        ...actual,
        enforceRequestCodeIpThrottle: vi.fn().mockResolvedValue(undefined)
      };
    });
    vi.doMock("@/lib/auth/turnstile", async () => {
      const actual = await vi.importActual<typeof import("@/lib/auth/turnstile")>("@/lib/auth/turnstile");
      return {
        ...actual,
        verifyTurnstileToken: vi.fn().mockRejectedValue(
          new actual.TurnstileVerificationError("Complete the human verification challenge.")
        )
      };
    });

    const { POST } = await import("@/app/api/auth/request-code/route");

    const response = await POST(
      new Request("http://localhost/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.10"
        }
      })
    );

    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json).toEqual({ error: "Complete the human verification challenge." });
  });
});
