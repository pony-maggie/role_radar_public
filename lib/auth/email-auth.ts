import crypto from "node:crypto";
import {
  consumeEmailVerificationChallenge,
  createAuthSession,
  getAuthSessionByTokenHash,
  getEmailVerificationChallenge,
  recordFailedEmailVerificationAttempt,
  upsertEmailVerificationChallenge
} from "@/lib/repositories/auth";

const VERIFICATION_CODE_LENGTH = 6;
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
const VERIFICATION_REQUEST_COOLDOWN_MS = 60 * 1000;
const VERIFICATION_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const MAX_VERIFICATION_REQUESTS_PER_WINDOW = 5;
const MAX_VERIFICATION_FAILURES = 5;
const VERIFICATION_LOCKOUT_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const AUTH_SESSION_COOKIE = "role_radar_session";

type AuthEnv = {
  NODE_ENV?: string;
  AUTH_SECRET?: string;
};

export type AuthRepository = {
  upsertChallenge: typeof upsertEmailVerificationChallenge;
  findChallenge: typeof getEmailVerificationChallenge;
  consumeChallenge: typeof consumeEmailVerificationChallenge;
  recordFailedAttempt: typeof recordFailedEmailVerificationAttempt;
  createSession: typeof createAuthSession;
  findSessionByTokenHash: typeof getAuthSessionByTokenHash;
};

export class AuthThrottleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthThrottleError";
  }
}

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

export function getAuthSecret(env: AuthEnv = process.env) {
  const secret = env.AUTH_SECRET?.trim();
  if (secret) {
    return secret;
  }

  if (env.NODE_ENV === "production") {
    throw new AuthConfigurationError("AUTH_SECRET is required in production");
  }

  return "role-radar-auth-dev";
}

export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createVerificationCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(VERIFICATION_CODE_LENGTH, "0");
}

function hashValue(value: string, secret: string) {
  return crypto.createHash("sha256").update(`${secret}:${value}`).digest("hex");
}

export function hashSessionToken(sessionToken: string, env: AuthEnv = process.env) {
  return hashValue(sessionToken, getAuthSecret(env));
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createVerificationCodeHash(email: string, code: string, secret: string) {
  return hashValue(`${normalizeAuthEmail(email)}:${code}`, secret);
}

function createSessionTokenHash(sessionToken: string, secret: string) {
  return hashValue(sessionToken, secret);
}

function isExpired(date: Date, now: Date) {
  return date.getTime() <= now.getTime();
}

export async function issueVerificationCode({
  email,
  repo,
  now = new Date(),
  env = process.env
}: {
  email: string;
  repo: Pick<AuthRepository, "upsertChallenge" | "findChallenge">;
  now?: Date;
  env?: AuthEnv;
}) {
  const normalizedEmail = normalizeAuthEmail(email);
  const existingChallenge = await repo.findChallenge(normalizedEmail);

  if (existingChallenge?.lockedUntil && !isExpired(existingChallenge.lockedUntil, now)) {
    throw new AuthThrottleError("Too many verification attempts. Try again later.");
  }

  if (
    existingChallenge?.lastRequestedAt &&
    now.getTime() - existingChallenge.lastRequestedAt.getTime() < VERIFICATION_REQUEST_COOLDOWN_MS
  ) {
    throw new AuthThrottleError("Please wait before requesting another code");
  }

  let requestWindowStartedAt = existingChallenge?.requestWindowStartedAt ?? now;
  let requestCount = existingChallenge?.requestCount ?? 0;

  if (now.getTime() - requestWindowStartedAt.getTime() >= VERIFICATION_REQUEST_WINDOW_MS) {
    requestWindowStartedAt = now;
    requestCount = 0;
  }

  if (requestCount >= MAX_VERIFICATION_REQUESTS_PER_WINDOW) {
    throw new AuthThrottleError("Too many verification code requests. Try again later.");
  }

  const code = createVerificationCode();
  const secret = getAuthSecret(env);
  const expiresAt = new Date(now.getTime() + VERIFICATION_CODE_TTL_MS);

  await repo.upsertChallenge({
    email: normalizedEmail,
    codeHash: createVerificationCodeHash(normalizedEmail, code, secret),
    expiresAt,
    requestCount: requestCount + 1,
    requestWindowStartedAt,
    lastRequestedAt: now,
    failedAttempts: 0,
    lockedUntil: null
  });

  return {
    email: normalizedEmail,
    expiresAt,
    verificationCode: code,
    devPreviewCode: env.NODE_ENV === "production" ? null : code
  };
}

export async function verifyEmailCode({
  email,
  code,
  repo,
  now = new Date(),
  env = process.env
}: {
  email: string;
  code: string;
  repo: Pick<AuthRepository, "findChallenge" | "consumeChallenge" | "recordFailedAttempt" | "createSession">;
  now?: Date;
  env?: AuthEnv;
}) {
  const normalizedEmail = normalizeAuthEmail(email);
  const challenge = await repo.findChallenge(normalizedEmail);
  if (!challenge || challenge.consumedAt || isExpired(challenge.expiresAt, now)) {
    throw new Error("Invalid verification code");
  }

  if (challenge.lockedUntil && !isExpired(challenge.lockedUntil, now)) {
    throw new AuthThrottleError("Too many verification attempts. Try again later.");
  }

  const secret = getAuthSecret(env);
  const expectedHash = createVerificationCodeHash(normalizedEmail, code.trim(), secret);
  if (expectedHash !== challenge.codeHash) {
    const failedAttempts = (challenge.failedAttempts ?? 0) + 1;
    const lockedUntil =
      failedAttempts >= MAX_VERIFICATION_FAILURES
        ? new Date(now.getTime() + VERIFICATION_LOCKOUT_MS)
        : null;

    await repo.recordFailedAttempt(normalizedEmail, {
      failedAttempts,
      lockedUntil
    });

    if (lockedUntil) {
      throw new AuthThrottleError("Too many verification attempts. Try again later.");
    }

    throw new Error("Invalid verification code");
  }

  const sessionToken = createSessionToken();
  const sessionTokenHash = createSessionTokenHash(sessionToken, secret);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await repo.consumeChallenge(normalizedEmail, now);
  await repo.createSession({
    email: normalizedEmail,
    sessionTokenHash,
    expiresAt
  });

  return {
    email: normalizedEmail,
    sessionToken,
    expiresAt
  };
}

export async function resolveAuthSession({
  sessionToken,
  repo,
  now = new Date(),
  env = process.env
}: {
  sessionToken: string | null | undefined;
  repo: Pick<AuthRepository, "findSessionByTokenHash">;
  now?: Date;
  env?: AuthEnv;
}) {
  if (!sessionToken) {
    return null;
  }

  const secret = getAuthSecret(env);
  const session = await repo.findSessionByTokenHash(createSessionTokenHash(sessionToken, secret));
  if (!session || session.revokedAt || isExpired(session.expiresAt, now)) {
    return null;
  }

  return {
    email: session.email,
    expiresAt: session.expiresAt
  };
}

export function createAuthCookie(sessionToken: string) {
  return {
    name: AUTH_SESSION_COOKIE,
    value: sessionToken,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_TTL_MS / 1000
    }
  };
}

export function getCookieValue(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(name.length + 1));
}
