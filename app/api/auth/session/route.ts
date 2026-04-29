import { AUTH_SESSION_COOKIE, getCookieValue, resolveAuthSession } from "@/lib/auth/email-auth";
import { getAuthSessionByTokenHash } from "@/lib/repositories/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const sessionToken = getCookieValue(request.headers.get("cookie"), AUTH_SESSION_COOKIE);
  const session = await resolveAuthSession({
    sessionToken,
    repo: {
      findSessionByTokenHash: getAuthSessionByTokenHash
    }
  });

  return NextResponse.json({
    ok: true,
    session
  });
}
