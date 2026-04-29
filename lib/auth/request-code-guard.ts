import {
  getAuthThrottleBucket,
  upsertAuthThrottleBucket
} from "@/lib/repositories/auth";
import { AuthThrottleError, getAuthSecret } from "@/lib/auth/email-auth";
import crypto from "node:crypto";

const REQUEST_CODE_ACTION = "request_code";
const REQUEST_CODE_IP_WINDOW_MS = 15 * 60 * 1000;
const REQUEST_CODE_IP_MAX_REQUESTS = 10;
const REQUEST_CODE_IP_BLOCK_MS = 30 * 60 * 1000;

type GuardEnv = {
  NODE_ENV?: string;
  AUTH_SECRET?: string;
};

export type RequestCodeGuardRepository = {
  findThrottleBucket: typeof getAuthThrottleBucket;
  upsertThrottleBucket: typeof upsertAuthThrottleBucket;
};

function hashSubject(ip: string, env: GuardEnv) {
  const secret = getAuthSecret(env);
  return crypto.createHash("sha256").update(`${secret}:${ip}`).digest("hex");
}

function isExpired(date: Date, now: Date) {
  return date.getTime() <= now.getTime();
}

export function resolveClientIp(headers: Headers) {
  const forwarded = headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for") ?? headers.get("x-real-ip");
  if (!forwarded) return null;
  const first = forwarded.split(",")[0]?.trim() ?? "";
  return first || null;
}

export async function enforceRequestCodeIpThrottle({
  ip,
  repo,
  now = new Date(),
  env = process.env
}: {
  ip: string | null;
  repo: RequestCodeGuardRepository;
  now?: Date;
  env?: GuardEnv;
}) {
  if (!ip) {
    return;
  }

  const subjectHash = hashSubject(ip, env);
  const bucket = await repo.findThrottleBucket(REQUEST_CODE_ACTION, subjectHash);

  if (bucket?.blockedUntil && !isExpired(bucket.blockedUntil, now)) {
    throw new AuthThrottleError("Too many requests from this network. Try again later.");
  }

  let windowStartedAt = bucket?.windowStartedAt ?? now;
  let requestCount = bucket?.requestCount ?? 0;

  if (now.getTime() - windowStartedAt.getTime() >= REQUEST_CODE_IP_WINDOW_MS) {
    windowStartedAt = now;
    requestCount = 0;
  }

  if (requestCount >= REQUEST_CODE_IP_MAX_REQUESTS) {
    await repo.upsertThrottleBucket({
      action: REQUEST_CODE_ACTION,
      subjectHash,
      requestCount: requestCount + 1,
      windowStartedAt,
      blockedUntil: new Date(now.getTime() + REQUEST_CODE_IP_BLOCK_MS)
    });
    throw new AuthThrottleError("Too many requests from this network. Try again later.");
  }

  await repo.upsertThrottleBucket({
    action: REQUEST_CODE_ACTION,
    subjectHash,
    requestCount: requestCount + 1,
    windowStartedAt,
    blockedUntil: null
  });
}
