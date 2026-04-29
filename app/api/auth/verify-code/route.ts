import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AUTH_SESSION_COOKIE,
  AuthThrottleError,
  createAuthCookie,
  verifyEmailCode
} from "@/lib/auth/email-auth";
import { logger } from "@/lib/logging/logger";
import {
  consumeEmailVerificationChallenge,
  createAuthSession,
  getEmailVerificationChallenge,
  recordFailedEmailVerificationAttempt
} from "@/lib/repositories/auth";

const schema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().min(6).max(6)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let result;
  try {
    result = await verifyEmailCode({
      email: parsed.data.email,
      code: parsed.data.code,
      repo: {
        findChallenge: getEmailVerificationChallenge,
        consumeChallenge: consumeEmailVerificationChallenge,
        recordFailedAttempt: recordFailedEmailVerificationAttempt,
        createSession: createAuthSession
      }
    });
  } catch (error) {
    if (error instanceof AuthThrottleError) {
      logger.warn("verification code throttled", {
        email: parsed.data.email
      });
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    logger.warn("verification code rejected", {
      email: parsed.data.email
    });
    return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 401 });
  }

  logger.info("verification code accepted", {
    email: result.email
  });

  const response = NextResponse.json({
    ok: true,
    email: result.email
  });
  const cookie = createAuthCookie(result.sessionToken);
  response.cookies.set(cookie.name, cookie.value, cookie.options);

  return response;
}
