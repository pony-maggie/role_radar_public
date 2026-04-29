import { NextResponse } from "next/server";
import {
  AUTH_SESSION_COOKIE,
  getCookieValue,
  hashSessionToken
} from "@/lib/auth/email-auth";
import { revokeAuthSession } from "@/lib/repositories/auth";

export async function POST(request: Request) {
  const sessionToken = getCookieValue(request.headers.get("cookie"), AUTH_SESSION_COOKIE);
  if (sessionToken) {
    await revokeAuthSession(
      hashSessionToken(sessionToken, {
        NODE_ENV: process.env.NODE_ENV,
        AUTH_SECRET: process.env.AUTH_SECRET
      }),
      new Date()
    ).catch(() => null);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/"
  });
  return response;
}
