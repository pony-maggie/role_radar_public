"use client";

import { WatchlistTable } from "@/components/watchlist/watchlist-table";
import type { WatchlistItem } from "@/components/watchlist/watchlist-types";
import type { FormEvent } from "react";
import { useState } from "react";

export function SubscriptionForm({
  email,
  defaultRoleSlug,
  locale,
  roles,
  initialRoles
}: {
  email: string;
  defaultRoleSlug: string;
  locale: "en" | "zh";
  roles: Array<{ slug: string; name: string }>;
  initialRoles: WatchlistItem[];
}) {
  const [roleSlug, setRoleSlug] = useState(defaultRoleSlug);
  const [message, setMessage] = useState("");
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(initialRoles);
  const emailLabel = locale === "zh" ? "已登录邮箱" : "Signed-in email";
  const roleLabel = locale === "zh" ? "岗位" : "Role";
  const buttonLabel = locale === "zh" ? "开始追踪" : "Track role";
  const successMessage = locale === "zh" ? "已开启追踪" : "Tracking enabled";
  const errorMessage = locale === "zh" ? "无法保存追踪项" : "Unable to save watchlist entry";
  const limitMessage =
    locale === "zh" ? "最多只能追踪 3 个岗位。" : "You can track up to 3 roles.";
  const notificationCopy =
    locale === "zh"
      ? "默认会收到周报；当替代率出现明显变化时，也会收到单独提醒。"
      : "You will receive a weekly digest, plus a separate alert when a tracked role moves materially.";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleSlug })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(payload?.error?.includes("Watchlist limit reached") ? limitMessage : errorMessage);
      return;
    }

    const payload = (await response.json()) as { trackedRole: WatchlistItem };
    const nextWatchlist = [payload.trackedRole, ...watchlist.filter((item) => item.slug !== payload.trackedRole.slug)];
    setWatchlist(nextWatchlist);
    setMessage(successMessage);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST"
    });
    window.location.reload();
  }

  return (
    <>
      <form className="watchlist-form watchlist-form-card" onSubmit={handleSubmit}>
        <div className="watchlist-form-grid">
          <label className="watchlist-field">
            <span className="watchlist-label">{emailLabel}</span>
            <input aria-label={emailLabel} className="watchlist-input" value={email} readOnly />
          </label>
          <label className="watchlist-field">
            <span className="watchlist-label">{roleLabel}</span>
            <select
              aria-label={roleLabel}
              className="watchlist-select"
              value={roleSlug}
              onChange={(event) => setRoleSlug(event.target.value)}
            >
              {roles.map((role) => (
                <option key={role.slug} value={role.slug}>
                  {role.name}
                </option>
            ))}
            </select>
          </label>
        </div>
        <div className="watchlist-actions">
          <button className="watchlist-button" type="submit">
            {buttonLabel}
          </button>
          <button className="watchlist-button watchlist-button-secondary" type="button" onClick={handleLogout}>
            {locale === "zh" ? "退出登录" : "Log out"}
          </button>
        </div>
        {message ? <p className="flash-message">{message}</p> : null}
        <p className="page-copy">{notificationCopy}</p>
      </form>
      <WatchlistTable
        emptyMessage={locale === "zh" ? "当前还没有追踪岗位。" : "No tracked roles yet."}
        latestChangeLabel={locale === "zh" ? "最近变化" : "Latest change"}
        noRecentSignalsLabel={locale === "zh" ? "暂无最新信号" : "No recent signals"}
        riskLabel={locale === "zh" ? "风险" : "Risk"}
        roles={watchlist.map((item) => ({
          slug: item.slug,
          name: locale === "zh" ? item.nameZh : item.nameEn,
          riskLevel: item.riskLevel,
          replacementRate: item.replacementRate,
          latestSignalSummary:
            locale === "zh" ? item.latestSignalSummaryZh : item.latestSignalSummaryEn,
          latestSignalPublishedAt: item.latestSignalPublishedAt
        }))}
      />
    </>
  );
}
