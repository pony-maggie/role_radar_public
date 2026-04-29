"use client";

import { useState } from "react";

type TrendPoint = {
  bucketLabel: string;
  averageReplacementRate: number;
  pointCount: number;
};

export function RiskTrend({
  locale,
  trend
}: {
  locale: "en" | "zh";
  trend: {
    week: TrendPoint[];
    month: TrendPoint[];
  };
}) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const points = mode === "week" ? trend.week : trend.month;

  return (
    <section className="feature-section section-stack role-trend-panel">
      <div className="section-header">
        <h2 className="section-title">{locale === "zh" ? "替代率趋势" : "Replacement trend"}</h2>
        <span className="section-note">
          {locale === "zh" ? "按周期刷新快照聚合" : "Aggregated from periodic refresh snapshots"}
        </span>
      </div>

      <div className="trend-toggle" role="group" aria-label={locale === "zh" ? "趋势时间范围" : "Trend range"}>
        <button
          type="button"
          className={mode === "week" ? "is-active" : undefined}
          aria-pressed={mode === "week"}
          onClick={() => setMode("week")}
        >
          {locale === "zh" ? "周" : "Week"}
        </button>
        <button
          type="button"
          className={mode === "month" ? "is-active" : undefined}
          aria-pressed={mode === "month"}
          onClick={() => setMode("month")}
        >
          {locale === "zh" ? "月" : "Month"}
        </button>
      </div>

      {points.length ? (
        <ul className="trend-list">
          {points.map((point) => (
            <li key={`${mode}-${point.bucketLabel}`} className="trend-row">
              <span className="trend-label">{point.bucketLabel}</span>
              <div className="trend-bar-track" aria-hidden="true">
                <div className="trend-bar-fill" style={{ width: `${point.averageReplacementRate}%` }} />
              </div>
              <strong className="trend-value">{point.averageReplacementRate}%</strong>
            </li>
          ))}
        </ul>
      ) : (
        <div className="timeline-empty-card">
          <p className="timeline-summary">
            {locale === "zh"
              ? "当前还没有足够的周期刷新历史来展示趋势。"
              : "There is not enough periodic refresh history to show a trend yet."}
          </p>
        </div>
      )}
    </section>
  );
}
