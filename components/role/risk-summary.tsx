import type { RatingStatus, RiskLevel } from "@prisma/client";
import { presentRisk } from "@/lib/domain/risk-presentation";

export function RiskSummary({
  locale,
  role
}: {
  locale: "en" | "zh";
  role: {
    nameEn: string;
    nameZh: string;
    replacementRate: number | null;
    riskSummaryEn: string | null;
    riskSummaryZh: string | null;
    riskLevel: RiskLevel;
    ratingStatus: RatingStatus;
    summaryEn: string;
    summaryZh: string;
  };
}) {
  const display = presentRisk({
    riskLevel: role.riskLevel,
    ratingStatus: role.ratingStatus,
    locale
  });

  return (
    <section className="role-lead-card">
      <div className="risk-meta">
        <span>{locale === "zh" ? "职位快照" : "Role snapshot"}</span>
        <span>{locale === "zh" ? "持续更新" : "Updated over time"}</span>
      </div>
      <h1 className="role-name">{locale === "zh" ? role.nameZh : role.nameEn}</h1>
      <div className="hero-metric-block">
        <p className="metric-label">{locale === "zh" ? "AI 替代率" : "AI replacement rate"}</p>
        <strong className={`hero-percentage ${display.className}`}>
          {role.ratingStatus === "RATED" && role.replacementRate !== null
            ? `${role.replacementRate}%`
            : display.label}
        </strong>
      </div>
      <p className="role-summary">{locale === "zh" ? role.summaryZh : role.summaryEn}</p>
      <p className="role-explainer">
        {locale === "zh"
          ? role.riskSummaryZh ?? display.summary
          : role.riskSummaryEn ?? display.summary}
      </p>
    </section>
  );
}
