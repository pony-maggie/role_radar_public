import { AUTH_SESSION_COOKIE, getCookieValue, resolveAuthSession } from "@/lib/auth/email-auth";
import { createSubscription } from "@/lib/repositories/subscriptions";
import { getAuthSessionByTokenHash } from "@/lib/repositories/auth";
import { getRoleBySlug } from "@/lib/repositories/roles";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  roleSlug: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const session = await resolveAuthSession({
    sessionToken: getCookieValue(request.headers.get("cookie"), AUTH_SESSION_COOKIE),
    repo: {
      findSessionByTokenHash: getAuthSessionByTokenHash
    }
  });

  if (!session) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  await getRoleBySlug(parsed.data.roleSlug);
  const role = await prisma.role.findUnique({ where: { slug: parsed.data.roleSlug } });
  if (!role) {
    return NextResponse.json({ error: "Unknown role" }, { status: 404 });
  }

  try {
    await createSubscription(session.email, role.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create watchlist entry";
    const status = message.includes("Watchlist limit reached") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
  const roleWithSignal = await prisma.role.findUnique({
    where: { id: role.id },
    include: {
      signals: {
        orderBy: { publishedAt: "desc" },
        take: 1
      }
    }
  });

  if (!roleWithSignal) {
    return NextResponse.json({ error: "Unknown role" }, { status: 404 });
  }

  const latestSignal = roleWithSignal.signals[0];
  const trackedRole = {
    slug: roleWithSignal.slug,
    nameEn: roleWithSignal.nameEn,
    nameZh: roleWithSignal.nameZh,
    riskLevel: roleWithSignal.riskLevel,
    replacementRate: roleWithSignal.replacementRate,
    latestSignalSummaryEn: latestSignal?.summaryEn ?? null,
    latestSignalSummaryZh: latestSignal?.summaryZh ?? null,
    latestSignalPublishedAt: latestSignal?.publishedAt.toISOString() ?? null
  };

  return NextResponse.json({ ok: true, trackedRole });
}
