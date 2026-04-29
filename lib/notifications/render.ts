import type { NotificationPayload } from "@/lib/repositories/notifications";

type RenderedNotification = {
  subjectEn: string;
  subjectZh: string;
  text: string;
  html: string;
  fileStem: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createRoleUrl(roleSlug: string) {
  const baseUrl = (process.env.ROLE_RADAR_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  return `${baseUrl}/en/roles/${roleSlug}`;
}

export function renderNotification(payload: NotificationPayload): RenderedNotification {
  if (payload.kind === "weekly_digest") {
    const subjectEn = `Role Radar weekly digest for ${payload.roles.length} tracked role${payload.roles.length === 1 ? "" : "s"}`;
    const subjectZh = `职危图谱周报：你追踪的 ${payload.roles.length} 个岗位`;
    const textBlocks = payload.roles.map((role) => {
      const headline = `${role.nameEn} / ${role.nameZh}: ${role.replacementRate ?? "pending"}%`;
      const summary = `${role.riskSummaryEn ?? "No fresh summary yet."}\n${role.riskSummaryZh ?? "暂无新的摘要。"}`;
      const updates =
        role.recentItems.length > 0
          ? role.recentItems
              .map((item) => `- ${item.publishedAt.slice(0, 10)} ${item.title}\n  ${item.summaryEn}`)
              .join("\n")
          : "- No material updates this week.\n- 本周暂无显著变化。";

      return `${headline}\n${summary}\n${updates}\n${createRoleUrl(role.slug)}`;
    });

    const htmlBlocks = payload.roles
      .map((role) => {
        const updates =
          role.recentItems.length > 0
            ? `<ul>${role.recentItems
                .map(
                  (item) =>
                    `<li><strong>${escapeHtml(item.title)}</strong> <span>${escapeHtml(item.publishedAt.slice(0, 10))}</span><p>${escapeHtml(item.summaryEn)}</p><p>${escapeHtml(item.summaryZh)}</p></li>`
                )
                .join("")}</ul>`
            : "<p>No material updates this week. / 本周暂无显著变化。</p>";

        return `
          <section style="margin:0 0 24px 0;padding:20px;border:1px solid #d8d4cc;border-radius:16px;">
            <h2 style="margin:0 0 8px 0;font-size:22px;">${escapeHtml(role.nameEn)} / ${escapeHtml(role.nameZh)}</h2>
            <p style="margin:0 0 12px 0;font-size:32px;font-weight:700;">${role.replacementRate ?? "Pending"}%</p>
            <p style="margin:0 0 8px 0;">${escapeHtml(role.riskSummaryEn ?? "No fresh summary yet.")}</p>
            <p style="margin:0 0 16px 0;color:#5f5b54;">${escapeHtml(role.riskSummaryZh ?? "暂无新的摘要。")}</p>
            ${updates}
            <p style="margin:16px 0 0 0;"><a href="${escapeHtml(createRoleUrl(role.slug))}">Open role page</a></p>
          </section>
        `;
      })
      .join("");

    return {
      subjectEn,
      subjectZh,
      text: [`${subjectEn}`, `${subjectZh}`, "", ...textBlocks].join("\n\n"),
      html: `
        <main style="font-family:Georgia, 'Times New Roman', serif;max-width:760px;margin:0 auto;padding:40px 24px;color:#171512;background:#f6f1e8;">
          <p style="letter-spacing:0.16em;text-transform:uppercase;font-size:12px;color:#6c665d;">Role Radar / 职危图谱</p>
          <h1 style="font-size:40px;line-height:1.1;margin:0 0 12px 0;">${escapeHtml(subjectEn)}</h1>
          <p style="font-size:18px;line-height:1.5;color:#4d4942;">${escapeHtml(subjectZh)}</p>
          ${htmlBlocks}
        </main>
      `,
      fileStem: `weekly-digest-${payload.email.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}`
    };
  }

  const direction = payload.delta >= 0 ? "up" : "down";
  const directionZh = payload.delta >= 0 ? "上升" : "下降";
  const subjectEn = `Role Radar alert: ${payload.roleNameEn} moved to ${payload.currentReplacementRate}%`;
  const subjectZh = `职危图谱提醒：${payload.roleNameZh} ${directionZh}至 ${payload.currentReplacementRate}%`;
  const updates =
    payload.recentItems.length > 0
      ? payload.recentItems
          .map((item) => `- ${item.publishedAt.slice(0, 10)} ${item.title}\n  ${item.summaryEn}`)
          .join("\n")
      : "- No linked updates yet.\n- 暂无关联更新。";

  return {
    subjectEn,
    subjectZh,
    text: [
      subjectEn,
      subjectZh,
      "",
      `${payload.roleNameEn} / ${payload.roleNameZh}`,
      `${payload.previousReplacementRate}% -> ${payload.currentReplacementRate}% (${direction} ${Math.abs(payload.delta)} pts)`,
      payload.riskSummaryEn ?? "",
      payload.riskSummaryZh ?? "",
      "",
      updates,
      "",
      createRoleUrl(payload.roleSlug)
    ].join("\n"),
    html: `
      <main style="font-family:Georgia, 'Times New Roman', serif;max-width:760px;margin:0 auto;padding:40px 24px;color:#171512;background:#f6f1e8;">
        <p style="letter-spacing:0.16em;text-transform:uppercase;font-size:12px;color:#6c665d;">Role Radar / 职危图谱</p>
        <h1 style="font-size:40px;line-height:1.1;margin:0 0 12px 0;">${escapeHtml(subjectEn)}</h1>
        <p style="font-size:18px;line-height:1.5;color:#4d4942;">${escapeHtml(subjectZh)}</p>
        <section style="margin:24px 0 0 0;padding:24px;border:1px solid #d8d4cc;border-radius:16px;">
          <h2 style="margin:0 0 8px 0;font-size:22px;">${escapeHtml(payload.roleNameEn)} / ${escapeHtml(payload.roleNameZh)}</h2>
          <p style="margin:0 0 12px 0;font-size:32px;font-weight:700;">${payload.previousReplacementRate}% → ${payload.currentReplacementRate}%</p>
          <p style="margin:0 0 8px 0;">${escapeHtml(payload.riskSummaryEn ?? "")}</p>
          <p style="margin:0 0 16px 0;color:#5f5b54;">${escapeHtml(payload.riskSummaryZh ?? "")}</p>
          ${
            payload.recentItems.length > 0
              ? `<ul>${payload.recentItems
                  .map(
                    (item) =>
                      `<li><strong>${escapeHtml(item.title)}</strong> <span>${escapeHtml(item.publishedAt.slice(0, 10))}</span><p>${escapeHtml(item.summaryEn)}</p><p>${escapeHtml(item.summaryZh)}</p></li>`
                  )
                  .join("")}</ul>`
              : "<p>No linked updates yet. / 暂无关联更新。</p>"
          }
          <p style="margin:16px 0 0 0;"><a href="${escapeHtml(createRoleUrl(payload.roleSlug))}">Open role page</a></p>
        </section>
      </main>
    `,
    fileStem: `significant-change-${payload.roleSlug}`
  };
}
