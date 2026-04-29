import Link from "next/link";
import type { RatingStatus, RiskLevel } from "@prisma/client";
import { presentRisk } from "@/lib/domain/risk-presentation";

type RelatedRole = {
  slug: string;
  nameEn: string;
  nameZh: string;
  replacementRate: number | null;
  riskLevel: RiskLevel;
  ratingStatus: RatingStatus;
};

export function RelatedRoles({
  locale,
  roles
}: {
  locale: "en" | "zh";
  roles: RelatedRole[];
}) {
  const visibleRoles =
    locale === "zh" ? roles.filter((role) => role.nameZh.trim().length > 0 && role.nameZh !== role.nameEn) : roles;

  if (!visibleRoles.length) {
    return null;
  }

  return (
    <section className="feature-section section-stack related-roles-section">
      <div className="section-header">
        <h2 className="section-title">{locale === "zh" ? "相关岗位" : "Related roles"}</h2>
        <span className="section-note">
          {locale === "zh"
            ? "按相近关键词和岗位邻近度推荐"
            : "Suggested from nearby keywords and role similarity"}
        </span>
      </div>
      <ul className="related-role-list">
        {visibleRoles.map((role) => {
          const display = presentRisk({
            riskLevel: role.riskLevel,
            ratingStatus: role.ratingStatus,
            locale
          });

          return (
            <li key={role.slug} className="related-role-card">
              <Link className="related-role-link" href={`/${locale}/roles/${role.slug}`}>
                <span className="related-role-name">{locale === "zh" ? role.nameZh : role.nameEn}</span>
                <span className={`percentage-chip ${display.className}`}>
                  {role.ratingStatus === "RATED" && typeof role.replacementRate === "number"
                    ? `${role.replacementRate}%`
                    : display.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
