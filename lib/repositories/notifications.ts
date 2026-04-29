import type { NotificationDispatch, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  formatReplacementDelta,
  hasSignificantReplacementRateChange,
  isWeeklyDigestDue
} from "@/lib/notifications/policy";
import { listTimelineSourceItemsForRoleSlugSince } from "@/lib/repositories/source-items";
import {
  listSubscriptionsForNotifications,
  listTrackedEmails,
  markRoleAlertSent,
  markWeeklyDigestSent,
  normalizeSubscriptionEmail
} from "@/lib/repositories/subscriptions";

type TimelineItem = Awaited<ReturnType<typeof listTimelineSourceItemsForRoleSlugSince>>[number];

type WeeklyDigestRolePayload = {
  slug: string;
  nameEn: string;
  nameZh: string;
  replacementRate: number | null;
  riskLevel: string;
  riskSummaryEn: string | null;
  riskSummaryZh: string | null;
  recentItems: Array<{
    title: string;
    summaryEn: string;
    summaryZh: string;
    publishedAt: string;
    sourceUrl: string;
  }>;
};

type WeeklyDigestPayload = {
  kind: "weekly_digest";
  email: string;
  windowStart: string | null;
  windowEnd: string;
  roles: WeeklyDigestRolePayload[];
};

type SignificantChangePayload = {
  kind: "significant_change";
  email: string;
  roleSlug: string;
  roleNameEn: string;
  roleNameZh: string;
  previousReplacementRate: number;
  currentReplacementRate: number;
  delta: number;
  riskLevel: string;
  riskSummaryEn: string | null;
  riskSummaryZh: string | null;
  recentItems: Array<{
    title: string;
    summaryEn: string;
    summaryZh: string;
    publishedAt: string;
    sourceUrl: string;
  }>;
};

export type NotificationPayload = WeeklyDigestPayload | SignificantChangePayload;

function toRecentItemPayload(items: TimelineItem[]) {
  return items.map((item) => ({
    title: item.sourceTitle,
    summaryEn: item.summaryEn,
    summaryZh: item.summaryZh,
    publishedAt: item.publishedAt.toISOString(),
    sourceUrl: item.sourceUrl
  }));
}

async function hasPendingDispatch(email: string, kind: NotificationDispatch["kind"], roleId?: string | null) {
  const existing = await prisma.notificationDispatch.findFirst({
    where: {
      email,
      kind,
      roleId: roleId ?? null,
      status: "PENDING"
    },
    select: { id: true }
  });

  return Boolean(existing);
}

function buildDigestSubjects(roleCount: number) {
  return {
    subjectEn: `Role Radar weekly digest for ${roleCount} tracked role${roleCount === 1 ? "" : "s"}`,
    subjectZh: `职危图谱周报：你追踪的 ${roleCount} 个岗位`
  };
}

function buildAlertSubjects(roleNameEn: string, roleNameZh: string, replacementRate: number) {
  return {
    subjectEn: `Role Radar alert: ${roleNameEn} moved to ${replacementRate}%`,
    subjectZh: `职危图谱提醒：${roleNameZh} 升至 ${replacementRate}%`
  };
}

async function createDispatch(input: {
  email: string;
  roleId?: string | null;
  kind: NotificationDispatch["kind"];
  subjectEn: string;
  subjectZh: string;
  payload: Prisma.InputJsonValue;
  windowStart?: Date | null;
  windowEnd?: Date | null;
}) {
  return prisma.notificationDispatch.create({
    data: {
      email: input.email,
      roleId: input.roleId ?? null,
      kind: input.kind,
      subjectEn: input.subjectEn,
      subjectZh: input.subjectZh,
      payload: input.payload,
      windowStart: input.windowStart ?? null,
      windowEnd: input.windowEnd ?? null
    }
  });
}

export async function queueDueNotifications(now = new Date()) {
  const emails = await listTrackedEmails();
  let queued = 0;

  for (const rawEmail of emails) {
    const email = normalizeSubscriptionEmail(rawEmail);
    const subscriptions = await listSubscriptionsForNotifications(email);
    if (subscriptions.length === 0) {
      continue;
    }

    const lastDigestSentAt = subscriptions
      .map((subscription) => subscription.lastDigestSentAt)
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
    const oldestSubscriptionCreatedAt = subscriptions[0]?.createdAt ?? null;

    if (
      isWeeklyDigestDue({
        lastDigestSentAt,
        oldestSubscriptionCreatedAt,
        now
      }) &&
      !(await hasPendingDispatch(email, "WEEKLY_DIGEST"))
    ) {
      const windowStart = lastDigestSentAt ?? oldestSubscriptionCreatedAt;
      const roles: WeeklyDigestRolePayload[] = [];

      for (const subscription of subscriptions) {
        const recentItems = await listTimelineSourceItemsForRoleSlugSince(
          subscription.role.slug,
          windowStart,
          2
        );

        roles.push({
          slug: subscription.role.slug,
          nameEn: subscription.role.nameEn,
          nameZh: subscription.role.nameZh,
          replacementRate: subscription.role.replacementRate,
          riskLevel: subscription.role.riskLevel,
          riskSummaryEn: subscription.role.riskSummaryEn,
          riskSummaryZh: subscription.role.riskSummaryZh,
          recentItems: toRecentItemPayload(recentItems)
        });
      }

      const subjects = buildDigestSubjects(roles.length);
      await createDispatch({
        email,
        kind: "WEEKLY_DIGEST",
        subjectEn: subjects.subjectEn,
        subjectZh: subjects.subjectZh,
        payload: {
          kind: "weekly_digest",
          email,
          windowStart: windowStart?.toISOString() ?? null,
          windowEnd: now.toISOString(),
          roles
        },
        windowStart,
        windowEnd: now
      });
      queued += 1;
    }

    for (const subscription of subscriptions) {
      if (
        !hasSignificantReplacementRateChange({
          baselineReplacementRate: subscription.lastAlertReplacementRate,
          currentReplacementRate: subscription.role.replacementRate,
          lastRatedAt: subscription.role.lastRatedAt,
          subscriptionCreatedAt: subscription.createdAt,
          lastAlertSentAt: subscription.lastAlertSentAt
        })
      ) {
        continue;
      }

      if (await hasPendingDispatch(email, "SIGNIFICANT_CHANGE", subscription.roleId)) {
        continue;
      }

      if (subscription.role.replacementRate === null || subscription.lastAlertReplacementRate === null) {
        continue;
      }

      const recentItems = await listTimelineSourceItemsForRoleSlugSince(
        subscription.role.slug,
        subscription.lastAlertSentAt ?? subscription.createdAt,
        3
      );
      const delta = formatReplacementDelta(
        subscription.lastAlertReplacementRate,
        subscription.role.replacementRate
      );
      const subjects = buildAlertSubjects(
        subscription.role.nameEn,
        subscription.role.nameZh,
        subscription.role.replacementRate
      );

      await createDispatch({
        email,
        roleId: subscription.roleId,
        kind: "SIGNIFICANT_CHANGE",
        subjectEn: subjects.subjectEn,
        subjectZh: subjects.subjectZh,
        payload: {
          kind: "significant_change",
          email,
          roleSlug: subscription.role.slug,
          roleNameEn: subscription.role.nameEn,
          roleNameZh: subscription.role.nameZh,
          previousReplacementRate: subscription.lastAlertReplacementRate,
          currentReplacementRate: subscription.role.replacementRate,
          delta: delta.delta,
          riskLevel: subscription.role.riskLevel,
          riskSummaryEn: subscription.role.riskSummaryEn,
          riskSummaryZh: subscription.role.riskSummaryZh,
          recentItems: toRecentItemPayload(recentItems)
        },
        windowStart: subscription.lastAlertSentAt ?? subscription.createdAt,
        windowEnd: now
      });
      queued += 1;
    }
  }

  return queued;
}

export async function listPendingDispatches(limit = 20) {
  const dispatches = await prisma.notificationDispatch.findMany({
    where: { status: "PENDING" },
    include: {
      role: {
        select: {
          id: true,
          slug: true,
          replacementRate: true
        }
      }
    },
    orderBy: { queuedAt: "asc" },
    take: limit
  });

  return dispatches.map((dispatch) => ({
    ...dispatch,
    payload: dispatch.payload as NotificationPayload
  }));
}

export async function markDispatchSent(input: {
  dispatchId: string;
  sentAt?: Date;
  deliveryMode: string;
  previewPath?: string | null;
}) {
  const sentAt = input.sentAt ?? new Date();
  const existing = await prisma.notificationDispatch.findUnique({
    where: { id: input.dispatchId },
    select: {
      id: true,
      email: true,
      roleId: true,
      kind: true,
      payload: true
    }
  });

  if (!existing) {
    throw new Error(`Unknown notification dispatch: ${input.dispatchId}`);
  }

  const dispatch = await prisma.notificationDispatch.update({
    where: { id: existing.id },
    data: {
      status: "SENT",
      sentAt,
      deliveryMode: input.deliveryMode,
      previewPath: input.previewPath ?? null,
      errorMessage: null
    }
  });

  if (dispatch.kind === "WEEKLY_DIGEST") {
    await markWeeklyDigestSent(dispatch.email, sentAt);
  } else if (dispatch.roleId) {
    const payload = existing.payload as NotificationPayload;
    await markRoleAlertSent(
      dispatch.email,
      dispatch.roleId,
      sentAt,
      payload.kind === "significant_change" ? payload.currentReplacementRate : null
    );
  }

  return dispatch;
}

export async function markDispatchFailed(dispatchId: string, errorMessage: string) {
  return prisma.notificationDispatch.update({
    where: { id: dispatchId },
    data: {
      status: "FAILED",
      errorMessage
    }
  });
}
