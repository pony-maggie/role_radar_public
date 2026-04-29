import { getRoleBySlug, listRelatedRoles } from "@/lib/repositories/roles";
import { listRoleEvidenceTimeline } from "@/lib/repositories/role-discovery";
import { listRoleRiskSnapshots } from "@/lib/repositories/role-risk-snapshots";
import { buildRoleRiskTrend } from "@/lib/domain/role-risk-trend";

function getSourceHost(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

function readPublishedAt(rawJson: unknown, fallback: Date) {
  if (!rawJson || typeof rawJson !== "object" || Array.isArray(rawJson)) {
    return fallback;
  }

  const publishedAt = "publishedAt" in rawJson ? rawJson.publishedAt : null;
  if (typeof publishedAt !== "string" || !publishedAt) {
    return fallback;
  }

  const parsed = new Date(publishedAt);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function isNoSourceFallbackSummary(summary: string | null | undefined) {
  if (!summary) return false;

  return [
    "No role-specific source items are attached yet",
    "This role is being tracked with 0 recent source signal",
    "这个岗位暂时还没有挂接到足够的专属资讯",
    "这个岗位当前结合了 0 条近期来源信号"
  ].some((pattern) => summary.includes(pattern));
}

function buildTimelineAwareSummary(locale: "en" | "zh", timelineCount: number) {
  if (locale === "zh") {
    return `这个岗位当前已结合 ${timelineCount} 条时间线资讯和岗位画像推理来给出替代率。`;
  }

  return `This role is currently tracked with ${timelineCount} timeline item${timelineCount === 1 ? "" : "s"} plus a profile-based replacement estimate.`;
}

export async function getRoleDetail(slug: string) {
  const [role, discoveryTimeline, relatedRoles, snapshots] = await Promise.all([
    getRoleBySlug(slug),
    listRoleEvidenceTimeline(slug, 10),
    listRelatedRoles(slug, 6),
    listRoleRiskSnapshots(slug)
  ]);

  if (!role) {
    return null;
  }

  const timelineItems = new Map(
    role.timelineItems.map((item) => [item.sourceUrl, item] as const)
  );

  for (const item of discoveryTimeline) {
    if (timelineItems.has(item.sourceUrl)) {
      continue;
    }

    timelineItems.set(item.sourceUrl, {
      id: item.id,
      sourceTitle: item.title,
      sourceLabel: item.sourceLabel ?? "Role Search",
      sourceHost: getSourceHost(item.sourceUrl),
      sourceUrl: item.sourceUrl,
      sourceType: "ROLE_SEARCH",
      summaryEn: item.snippet,
      summaryZh: item.snippet,
      rationaleEn: item.snippet,
      rationaleZh: item.snippet,
      publishedAt: readPublishedAt(item.rawJson, item.updatedAt)
    });
  }

  const mergedTimelineItems = [...timelineItems.values()]
    .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime())
    .slice(0, 10);
  const timelineCount = mergedTimelineItems.length;
  const fallbackSummaryEn = buildTimelineAwareSummary("en", timelineCount);
  const fallbackSummaryZh = buildTimelineAwareSummary("zh", timelineCount);

  return {
    ...role,
    summaryEn:
      timelineCount > 0 && isNoSourceFallbackSummary(role.summaryEn)
        ? fallbackSummaryEn
        : role.summaryEn,
    summaryZh:
      timelineCount > 0 && isNoSourceFallbackSummary(role.summaryZh)
        ? fallbackSummaryZh
        : role.summaryZh,
    riskSummaryEn:
      timelineCount > 0 && isNoSourceFallbackSummary(role.riskSummaryEn)
        ? fallbackSummaryEn
        : role.riskSummaryEn,
    riskSummaryZh:
      timelineCount > 0 && isNoSourceFallbackSummary(role.riskSummaryZh)
        ? fallbackSummaryZh
        : role.riskSummaryZh,
    relatedRoles,
    trend: buildRoleRiskTrend(snapshots),
    timelineItems: mergedTimelineItems,
    seo: {
      timelineCount,
      latestPublishedAt: mergedTimelineItems[0]?.publishedAt ?? null
    }
  };
}
