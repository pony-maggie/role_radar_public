import { prisma } from "@/lib/db/prisma";

export const MAX_WATCHLIST_ROLES = 3;

export function normalizeSubscriptionEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function createSubscription(email: string, roleId: string) {
  const normalizedEmail = normalizeSubscriptionEmail(email);

  const existing = await prisma.watchSubscription.findMany({
    where: { email: normalizedEmail },
    select: { roleId: true }
  });

  const alreadyTracked = existing.some((subscription) => subscription.roleId === roleId);
  if (!alreadyTracked && existing.length >= MAX_WATCHLIST_ROLES) {
    throw new Error(`Watchlist limit reached (${MAX_WATCHLIST_ROLES})`);
  }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { replacementRate: true }
  });

  return prisma.watchSubscription.upsert({
    where: { email_roleId: { email: normalizedEmail, roleId } },
    create: {
      email: normalizedEmail,
      roleId,
      lastAlertReplacementRate: role?.replacementRate ?? null
    },
    update: {}
  });
}

export async function listSubscriptions(email: string) {
  const normalizedEmail = normalizeSubscriptionEmail(email);

  return prisma.watchSubscription.findMany({
    where: { email: normalizedEmail },
    include: { role: true },
    orderBy: { createdAt: "desc" }
  });
}

export async function listWatchlistSummary(email: string) {
  const normalizedEmail = normalizeSubscriptionEmail(email);

  const subscriptions = await prisma.watchSubscription.findMany({
    where: { email: normalizedEmail },
    include: {
      role: {
        include: {
          signals: {
            orderBy: { publishedAt: "desc" },
            take: 1
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return subscriptions.map((subscription) => ({
    slug: subscription.role.slug,
    nameEn: subscription.role.nameEn,
    nameZh: subscription.role.nameZh,
    riskLevel: subscription.role.riskLevel,
    replacementRate: subscription.role.replacementRate,
    latestSignalSummaryEn: subscription.role.signals[0]?.summaryEn ?? null,
    latestSignalSummaryZh: subscription.role.signals[0]?.summaryZh ?? null,
    latestSignalPublishedAt: subscription.role.signals[0]?.publishedAt.toISOString() ?? null
  }));
}

export async function listTrackedEmails() {
  const rows = await prisma.watchSubscription.findMany({
    distinct: ["email"],
    select: { email: true }
  });

  return rows.map((row) => row.email);
}

export async function listSubscriptionsForNotifications(email: string) {
  const normalizedEmail = normalizeSubscriptionEmail(email);

  return prisma.watchSubscription.findMany({
    where: { email: normalizedEmail },
    include: {
      role: {
        include: {
          dictionaryRole: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });
}

export async function markWeeklyDigestSent(email: string, sentAt: Date) {
  const normalizedEmail = normalizeSubscriptionEmail(email);

  return prisma.watchSubscription.updateMany({
    where: { email: normalizedEmail },
    data: { lastDigestSentAt: sentAt }
  });
}

export async function markRoleAlertSent(email: string, roleId: string, sentAt: Date, replacementRate: number | null) {
  const normalizedEmail = normalizeSubscriptionEmail(email);

  return prisma.watchSubscription.updateMany({
    where: {
      email: normalizedEmail,
      roleId
    },
    data: {
      lastAlertSentAt: sentAt,
      lastAlertReplacementRate: replacementRate
    }
  });
}
