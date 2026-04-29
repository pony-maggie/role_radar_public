import { describe, expect, it, vi } from "vitest";
import {
  AuthConfigurationError,
  AuthThrottleError,
  createVerificationCode,
  issueVerificationCode,
  normalizeAuthEmail,
  verifyEmailCode
} from "@/lib/auth/email-auth";

describe("createVerificationCode", () => {
  it("returns a six-digit numeric code", () => {
    const code = createVerificationCode();

    expect(code).toMatch(/^\d{6}$/);
  });
});

describe("issueVerificationCode", () => {
  it("stores a verification challenge and returns a dev preview code outside production", async () => {
    const upsertChallenge = vi.fn().mockResolvedValue(undefined);

    const result = await issueVerificationCode(
      {
        email: "  Test@Example.com ",
        repo: {
          upsertChallenge,
          findChallenge: vi.fn().mockResolvedValue(null)
        },
        now: new Date("2026-04-13T00:00:00.000Z"),
        env: { NODE_ENV: "development", AUTH_SECRET: "test-secret" }
      }
    );

    expect(result.email).toBe("test@example.com");
    expect(result.devPreviewCode).toMatch(/^\d{6}$/);
    expect(upsertChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        codeHash: expect.any(String),
        expiresAt: expect.any(Date),
        requestCount: 1,
        requestWindowStartedAt: expect.any(Date),
        lastRequestedAt: expect.any(Date),
        failedAttempts: 0,
        lockedUntil: null
      })
    );
  });

  it("hides the preview code in production", async () => {
    const upsertChallenge = vi.fn().mockResolvedValue(undefined);

    const result = await issueVerificationCode({
      email: "test@example.com",
      repo: {
        upsertChallenge,
        findChallenge: vi.fn().mockResolvedValue(null)
      },
      now: new Date("2026-04-13T00:00:00.000Z"),
      env: { NODE_ENV: "production", AUTH_SECRET: "test-secret" }
    });

    expect(result.devPreviewCode).toBeNull();
  });

  it("rejects a new code request during the cooldown window", async () => {
    await expect(
      issueVerificationCode({
        email: "test@example.com",
        repo: {
          upsertChallenge: vi.fn(),
          findChallenge: vi.fn().mockResolvedValue({
            email: "test@example.com",
            codeHash: "hash",
            expiresAt: new Date("2026-04-13T00:10:00.000Z"),
            consumedAt: null,
            requestCount: 1,
            requestWindowStartedAt: new Date("2026-04-13T00:00:00.000Z"),
            lastRequestedAt: new Date("2026-04-13T00:00:30.000Z"),
            failedAttempts: 0,
            lockedUntil: null
          })
        },
        now: new Date("2026-04-13T00:01:00.000Z"),
        env: { NODE_ENV: "development", AUTH_SECRET: "test-secret" }
      })
    ).rejects.toThrow("Please wait before requesting another code");
  });

  it("rejects code issuance after the hourly request cap is reached", async () => {
    await expect(
      issueVerificationCode({
        email: "test@example.com",
        repo: {
          upsertChallenge: vi.fn(),
          findChallenge: vi.fn().mockResolvedValue({
            email: "test@example.com",
            codeHash: "hash",
            expiresAt: new Date("2026-04-13T00:10:00.000Z"),
            consumedAt: null,
            requestCount: 5,
            requestWindowStartedAt: new Date("2026-04-13T00:00:00.000Z"),
            lastRequestedAt: new Date("2026-04-13T00:00:00.000Z"),
            failedAttempts: 0,
            lockedUntil: null
          })
        },
        now: new Date("2026-04-13T00:30:00.000Z"),
        env: { NODE_ENV: "development", AUTH_SECRET: "test-secret" }
      })
    ).rejects.toThrow("Too many verification code requests. Try again later.");
  });

  it("rejects code issuance in production when AUTH_SECRET is missing", async () => {
    await expect(
      issueVerificationCode({
        email: "test@example.com",
        repo: {
          upsertChallenge: vi.fn(),
          findChallenge: vi.fn().mockResolvedValue(null)
        },
        now: new Date("2026-04-13T00:01:00.000Z"),
        env: { NODE_ENV: "production" }
      })
    ).rejects.toBeInstanceOf(AuthConfigurationError);
  });
});

describe("verifyEmailCode", () => {
  it("creates a session when the code matches and the challenge is valid", async () => {
    const challengeStore = new Map<string, { codeHash: string; expiresAt: Date; consumedAt: Date | null }>();
    const sessionStore: Array<{ email: string; sessionTokenHash: string; expiresAt: Date }> = [];
    const issue = await issueVerificationCode({
      email: "test@example.com",
      repo: {
        upsertChallenge: vi.fn().mockImplementation(async (input) => {
          challengeStore.set(input.email, { codeHash: input.codeHash, expiresAt: input.expiresAt, consumedAt: null });
        })
        ,
        findChallenge: vi.fn().mockResolvedValue(null)
      },
      now: new Date("2026-04-13T00:00:00.000Z"),
      env: { NODE_ENV: "development", AUTH_SECRET: "test-secret" }
    });

    const result = await verifyEmailCode({
      email: "test@example.com",
      code: issue.devPreviewCode ?? "",
      repo: {
        findChallenge: vi.fn().mockImplementation(async (email) => {
          const stored = challengeStore.get(email);
          return stored ? { email, ...stored } : null;
        }),
        consumeChallenge: vi.fn().mockImplementation(async (email, consumedAt) => {
          const stored = challengeStore.get(email);
          if (stored) {
            stored.consumedAt = consumedAt;
          }
        }),
        recordFailedAttempt: vi.fn(),
        createSession: vi.fn().mockImplementation(async (input) => {
          sessionStore.push(input);
        })
      },
      now: new Date("2026-04-13T00:01:00.000Z"),
      env: { NODE_ENV: "development", AUTH_SECRET: "test-secret" }
    });

    expect(result.email).toBe("test@example.com");
    expect(result.sessionToken).toMatch(/^[a-f0-9]{64}$/);
    expect(sessionStore).toHaveLength(1);
    expect(sessionStore[0]).toMatchObject({
      email: "test@example.com",
      sessionTokenHash: expect.any(String)
    });
  });

  it("rejects an invalid verification code", async () => {
    const findChallenge = vi.fn().mockResolvedValue({
      email: "test@example.com",
      codeHash: "hash",
      expiresAt: new Date("2026-04-13T00:10:00.000Z"),
      consumedAt: null
    });

    await expect(
      verifyEmailCode({
        email: "test@example.com",
        code: "654321",
        repo: {
          findChallenge,
          consumeChallenge: vi.fn(),
          recordFailedAttempt: vi.fn(),
          createSession: vi.fn()
        },
        now: new Date("2026-04-13T00:00:00.000Z"),
        env: { NODE_ENV: "development", AUTH_SECRET: "test-secret" }
      })
    ).rejects.toThrow("Invalid verification code");
  });

  it("locks verification after too many failed attempts", async () => {
    const recordFailedAttempt = vi.fn();

    await expect(
      verifyEmailCode({
        email: "test@example.com",
        code: "654321",
        repo: {
          findChallenge: vi.fn().mockResolvedValue({
            email: "test@example.com",
            codeHash: "hash",
            expiresAt: new Date("2026-04-13T00:10:00.000Z"),
            consumedAt: null,
            requestCount: 1,
            requestWindowStartedAt: new Date("2026-04-13T00:00:00.000Z"),
            lastRequestedAt: new Date("2026-04-13T00:00:00.000Z"),
            failedAttempts: 4,
            lockedUntil: null
          }),
          consumeChallenge: vi.fn(),
          createSession: vi.fn(),
          recordFailedAttempt
        },
        now: new Date("2026-04-13T00:05:00.000Z"),
        env: { NODE_ENV: "development", AUTH_SECRET: "test-secret" }
      })
    ).rejects.toBeInstanceOf(AuthThrottleError);

    expect(recordFailedAttempt).toHaveBeenCalledWith(
      "test@example.com",
      expect.objectContaining({
        failedAttempts: 5,
        lockedUntil: expect.any(Date)
      })
    );
  });

  it("rejects verification immediately when the challenge is locked", async () => {
    await expect(
      verifyEmailCode({
        email: "test@example.com",
        code: "123456",
        repo: {
          findChallenge: vi.fn().mockResolvedValue({
            email: "test@example.com",
            codeHash: "hash",
            expiresAt: new Date("2026-04-13T00:10:00.000Z"),
            consumedAt: null,
            requestCount: 1,
            requestWindowStartedAt: new Date("2026-04-13T00:00:00.000Z"),
            lastRequestedAt: new Date("2026-04-13T00:00:00.000Z"),
            failedAttempts: 5,
            lockedUntil: new Date("2026-04-13T00:20:00.000Z")
          }),
          consumeChallenge: vi.fn(),
          createSession: vi.fn(),
          recordFailedAttempt: vi.fn()
        },
        now: new Date("2026-04-13T00:05:00.000Z"),
        env: { NODE_ENV: "development", AUTH_SECRET: "test-secret" }
      })
    ).rejects.toBeInstanceOf(AuthThrottleError);
  });
});

describe("normalizeAuthEmail", () => {
  it("normalizes email addresses for auth lookups", () => {
    expect(normalizeAuthEmail("  Test@Example.com ")).toBe("test@example.com");
  });
});
