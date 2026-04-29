"use client";

import Link from "next/link";
import { useState } from "react";

type RoleCard = {
  slug: string;
  name: string;
  risk: { label: string; summary: string; className: string };
};

export function RoleCardGrid({
  locale,
  roles,
  title,
  note
}: {
  locale: "en" | "zh";
  roles: RoleCard[];
  title: string;
  note: string;
}) {
  const [visibleCount, setVisibleCount] = useState(24);
  const nextVisibleCount = Math.min(visibleCount, roles.length);
  const visibleRoles = roles.slice(0, nextVisibleCount);
  const canLoadMore = nextVisibleCount < roles.length;
  const loadMoreLabel = locale === "zh" ? "加载更多" : "Load more";
  const countLabel =
    locale === "zh"
      ? `当前显示 ${visibleRoles.length} / ${roles.length}`
      : `Showing ${visibleRoles.length} of ${roles.length}`;

  return (
    <section className="feature-section section-stack home-role-grid">
      <div className="section-header">
        <div>
          <h2 className="section-title">{title}</h2>
          <span className="section-note">{note}</span>
        </div>
        <span className="section-note">{countLabel}</span>
      </div>
      <ul className="pin-board">
        {visibleRoles.map((role, index) => (
          <li key={role.slug} className={`role-card role-card-variant-${index % 4}`}>
            <Link className="role-card-link" href={`/${locale}/roles/${role.slug}`}>
              <div className="role-card-topline">
                <p className="role-card-title">{role.name}</p>
                <strong className={`percentage-chip ${role.risk.className}`}>{role.risk.label}</strong>
              </div>
              <p className="role-card-copy">{role.risk.summary}</p>
            </Link>
            <div className="signal-meta">
              <span>{locale === "zh" ? "岗位快照" : "Role brief"}</span>
              <span>{locale === "zh" ? "继续浏览" : "Open detail"}</span>
            </div>
          </li>
        ))}
      </ul>
      {canLoadMore ? (
        <button className="load-more-button" type="button" onClick={() => setVisibleCount((count) => count + 24)}>
          {loadMoreLabel}
        </button>
      ) : null}
    </section>
  );
}
