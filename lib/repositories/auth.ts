import { prisma } from "@/lib/db/prisma";

export async function upsertEmailVerificationChallenge(input: {
  email: string;
  codeHash: string;
  expiresAt: Date;
  requestCount: number;
  requestWindowStartedAt: Date;
  lastRequestedAt: Date;
  failedAttempts: number;
  lockedUntil?: Date | null;
}) {
  return prisma.emailVerificationChallenge.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
      consumedAt: null,
      requestCount: input.requestCount,
      requestWindowStartedAt: input.requestWindowStartedAt,
      lastRequestedAt: input.lastRequestedAt,
      failedAttempts: input.failedAttempts,
      lockedUntil: input.lockedUntil ?? null
    },
    update: {
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
      consumedAt: null,
      requestCount: input.requestCount,
      requestWindowStartedAt: input.requestWindowStartedAt,
      lastRequestedAt: input.lastRequestedAt,
      failedAttempts: input.failedAttempts,
      lockedUntil: input.lockedUntil ?? null
    }
  });
}

export async function getEmailVerificationChallenge(email: string) {
  return prisma.emailVerificationChallenge.findUnique({
    where: { email }
  });
}

export async function consumeEmailVerificationChallenge(email: string, consumedAt: Date) {
  return prisma.emailVerificationChallenge.update({
    where: { email },
    data: {
      consumedAt,
      failedAttempts: 0,
      lockedUntil: null
    }
  });
}

export async function recordFailedEmailVerificationAttempt(
  email: string,
  input: {
    failedAttempts: number;
    lockedUntil?: Date | null;
  }
) {
  return prisma.emailVerificationChallenge.update({
    where: { email },
    data: {
      failedAttempts: input.failedAttempts,
      lockedUntil: input.lockedUntil ?? null
    }
  });
}

export async function createAuthSession(input: {
  email: string;
  sessionTokenHash: string;
  expiresAt: Date;
}) {
  return prisma.authSession.upsert({
    where: { sessionTokenHash: input.sessionTokenHash },
    create: {
      email: input.email,
      sessionTokenHash: input.sessionTokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null
    },
    update: {
      email: input.email,
      expiresAt: input.expiresAt,
      revokedAt: null
    }
  });
}

export async function getAuthSessionByTokenHash(sessionTokenHash: string) {
  return prisma.authSession.findUnique({
    where: { sessionTokenHash }
  });
}

export async function revokeAuthSession(sessionTokenHash: string, revokedAt: Date) {
  return prisma.authSession.update({
    where: { sessionTokenHash },
    data: {
      revokedAt
    }
  });
}

export async function getAuthThrottleBucket(action: string, subjectHash: string) {
  return prisma.authThrottleBucket.findUnique({
    where: {
      action_subjectHash: {
        action,
        subjectHash
      }
    }
  });
}

export async function upsertAuthThrottleBucket(input: {
  action: string;
  subjectHash: string;
  requestCount: number;
  windowStartedAt: Date;
  blockedUntil?: Date | null;
}) {
  return prisma.authThrottleBucket.upsert({
    where: {
      action_subjectHash: {
        action: input.action,
        subjectHash: input.subjectHash
      }
    },
    create: {
      action: input.action,
      subjectHash: input.subjectHash,
      requestCount: input.requestCount,
      windowStartedAt: input.windowStartedAt,
      blockedUntil: input.blockedUntil ?? null
    },
    update: {
      requestCount: input.requestCount,
      windowStartedAt: input.windowStartedAt,
      blockedUntil: input.blockedUntil ?? null
    }
  });
}
