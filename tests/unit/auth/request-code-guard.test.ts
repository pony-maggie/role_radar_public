import { describe, expect, it, vi } from "vitest";
import { AuthThrottleError } from "@/lib/auth/email-auth";
import { enforceRequestCodeIpThrottle } from "@/lib/auth/request-code-guard";

describe("enforceRequestCodeIpThrottle", () => {
  it("allows requests when no prior bucket exists", async () => {
    const upsertThrottleBucket = vi.fn().mockResolvedValue(undefined);

    await expect(
      enforceRequestCodeIpThrottle({
        ip: "203.0.113.10",
        repo: {
          findThrottleBucket: vi.fn().mockResolvedValue(null),
          upsertThrottleBucket
        },
        now: new Date("2026-04-19T00:00:00.000Z"),
        env: { NODE_ENV: "development", AUTH_SECRET: "test-secret" }
      })
    ).resolves.toBeUndefined();

    expect(upsertThrottleBucket).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "request_code",
        requestCount: 1,
        windowStartedAt: expect.any(Date),
        blockedUntil: null
      })
    );
  });

  it("blocks requests when the ip bucket is already locked", async () => {
    await expect(
      enforceRequestCodeIpThrottle({
        ip: "203.0.113.10",
        repo: {
          findThrottleBucket: vi.fn().mockResolvedValue({
            action: "request_code",
            subjectHash: "hash",
            requestCount: 10,
            windowStartedAt: new Date("2026-04-19T00:00:00.000Z"),
            blockedUntil: new Date("2026-04-19T00:20:00.000Z")
          }),
          upsertThrottleBucket: vi.fn()
        },
        now: new Date("2026-04-19T00:05:00.000Z"),
        env: { NODE_ENV: "development", AUTH_SECRET: "test-secret" }
      })
    ).rejects.toBeInstanceOf(AuthThrottleError);
  });

  it("locks the ip bucket after too many requests in the same window", async () => {
    const upsertThrottleBucket = vi.fn().mockResolvedValue(undefined);

    await expect(
      enforceRequestCodeIpThrottle({
        ip: "203.0.113.10",
        repo: {
          findThrottleBucket: vi.fn().mockResolvedValue({
            action: "request_code",
            subjectHash: "hash",
            requestCount: 10,
            windowStartedAt: new Date("2026-04-19T00:00:00.000Z"),
            blockedUntil: null
          }),
          upsertThrottleBucket
        },
        now: new Date("2026-04-19T00:05:00.000Z"),
        env: { NODE_ENV: "development", AUTH_SECRET: "test-secret" }
      })
    ).rejects.toBeInstanceOf(AuthThrottleError);

    expect(upsertThrottleBucket).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "request_code",
        requestCount: 11,
        blockedUntil: expect.any(Date)
      })
    );
  });
});
