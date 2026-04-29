import { JsonLd } from "@/components/shared/json-ld";
import { RelatedRoles } from "@/components/role/related-roles";
import { RiskTrend } from "@/components/role/risk-trend";
import { RiskSummary } from "@/components/role/risk-summary";
import { SignalTimeline } from "@/components/role/signal-timeline";
import { StructuralReasons } from "@/components/role/structural-reasons";
import { getRoleDetail } from "@/lib/application/roles/get-role-detail";
import { buildCanonicalUrl, buildLocaleAlternates, buildRobotsDirectives } from "@/lib/seo/metadata";
import { buildRoleBreadcrumbSchema, buildRoleWebPageSchema } from "@/lib/seo/structured-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

function buildRoleMetaDescription(
  locale: "en" | "zh",
  role: Awaited<ReturnType<typeof getRoleDetail>>
) {
  if (!role) return "";

  const roleName = locale === "zh" ? role.nameZh : role.nameEn;
  const replacementRateText =
    typeof role.replacementRate === "number"
      ? `${role.replacementRate}%`
      : locale === "zh"
        ? "待评估"
        : "pending";

  if (locale === "zh") {
    return `${roleName} 当前 AI 替代率为 ${replacementRateText}，并附带 ${role.seo.timelineCount} 条可核查时间线证据。`;
  }

  return `${roleName} currently has an AI replacement rate of ${replacementRateText}, backed by ${role.seo.timelineCount} inspectable timeline item(s).`;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: "en" | "zh"; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const role = await getRoleDetail(slug);

  if (!role) {
    return {};
  }

  const roleName = locale === "zh" ? role.nameZh : role.nameEn;
  const pathname = `/${locale}/roles/${slug}`;

  return {
    title: locale === "zh" ? `${roleName} AI 替代率 | 职危图谱` : `${roleName} AI replacement rate | Role Radar`,
    description: buildRoleMetaDescription(locale, role),
    alternates: {
      canonical: buildCanonicalUrl(pathname),
      languages: buildLocaleAlternates(pathname)
    },
    robots: buildRobotsDirectives({ index: true })
  };
}

export default async function RoleDetailPage({
  params
}: {
  params: Promise<{ locale: "en" | "zh"; slug: string }>;
}) {
  const { locale, slug } = await params;
  const role = await getRoleDetail(slug);
  if (!role) notFound();
  const pathname = `/${locale}/roles/${slug}`;
  const roleName = locale === "zh" ? role.nameZh : role.nameEn;
  const description = buildRoleMetaDescription(locale, role);

  return (
    <article className="role-page role-board-page page-fade page-shell">
      <div className="role-board-layout">
        <div className="role-board-summary">
          <RiskSummary locale={locale} role={role} />
          <RiskTrend locale={locale} trend={role.trend} />
          <StructuralReasons locale={locale} role={role} />
        </div>
        <div className="role-board-evidence">
          <SignalTimeline locale={locale} signals={role.timelineItems} />
        </div>
      </div>
      <RelatedRoles locale={locale} roles={role.relatedRoles} />
      <JsonLd
        data={buildRoleWebPageSchema({
          locale,
          pathname,
          roleName,
          description,
          replacementRate: role.replacementRate,
          timelineCount: role.seo.timelineCount
        })}
        id={`role-webpage-${locale}-${slug}`}
      />
      <JsonLd
        data={buildRoleBreadcrumbSchema({
          locale,
          pathname,
          roleName
        })}
        id={`role-breadcrumb-${locale}-${slug}`}
      />
    </article>
  );
}
