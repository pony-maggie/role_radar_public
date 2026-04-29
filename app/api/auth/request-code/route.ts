import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AuthConfigurationError,
  AuthThrottleError,
  issueVerificationCode
} from "@/lib/auth/email-auth";
import {
  enforceRequestCodeIpThrottle,
  resolveClientIp
} from "@/lib/auth/request-code-guard";
import {
  TurnstileVerificationError,
  verifyTurnstileToken
} from "@/lib/auth/turnstile";
import { isSmtpConfigured } from "@/lib/email/config";
import { sendVerificationCodeEmail } from "@/lib/email/mailer";
import {
  renderVerificationCodeEmail,
  VERIFICATION_CODE_EXPIRES_IN_MINUTES
} from "@/lib/email/templates/verification-code";
import { logger } from "@/lib/logging/logger";
import {
  getAuthThrottleBucket,
  getEmailVerificationChallenge,
  upsertAuthThrottleBucket,
  upsertEmailVerificationChallenge
} from "@/lib/repositories/auth";

const schema = z.object({
  email: z.string().trim().email(),
  turnstileToken: z.string().trim().min(1).optional().nullable()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const remoteIp = resolveClientIp(request.headers);

  let result;
  try {
    await enforceRequestCodeIpThrottle({
      ip: remoteIp,
      repo: {
        findThrottleBucket: getAuthThrottleBucket,
        upsertThrottleBucket: upsertAuthThrottleBucket
      }
    });
    await verifyTurnstileToken({
      token: parsed.data.turnstileToken ?? null,
      remoteIp
    });
    result = await issueVerificationCode({
      email: parsed.data.email,
      repo: {
        upsertChallenge: upsertEmailVerificationChallenge,
        findChallenge: getEmailVerificationChallenge
      }
    });
  } catch (error) {
    if (error instanceof AuthThrottleError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    if (error instanceof AuthConfigurationError) {
      logger.error("verification auth misconfigured", {
        error: error.message
      });
      return NextResponse.json({ error: "Authentication is not configured" }, { status: 500 });
    }

    if (error instanceof TurnstileVerificationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    throw error;
  }

  logger.info("verification code requested", {
    email: result.email
  });

  if (isSmtpConfigured()) {
    const mail = renderVerificationCodeEmail({
      code: result.verificationCode,
      expiresInMinutes: VERIFICATION_CODE_EXPIRES_IN_MINUTES
    });

    try {
      await sendVerificationCodeEmail({
        to: result.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text
      });
      logger.info("verification email sent", {
        email: result.email
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      logger.error("verification email failed", {
        email: result.email,
        error: error instanceof Error ? error.message : String(error)
      });
      return NextResponse.json({ error: "Unable to send verification email" }, { status: 502 });
    }
  }

  if (result.devPreviewCode) {
    logger.warn("smtp not configured; using dev preview code", {
      email: result.email
    });
  }

  return NextResponse.json({
    ok: true,
    devPreviewCode: result.devPreviewCode
  });
}
