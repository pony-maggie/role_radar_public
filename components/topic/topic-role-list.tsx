import Link from "next/link";

type TopicRoleListItem = {
  slug: string;
  name: string;
  replacementRate: number | null;
  summary: string | null;
};

export function TopicRoleList({
  locale,
  roles
}: {
  locale: "en" | "zh";
  roles: TopicRoleListItem[];
}) {
  if (roles.length === 0) {
    return null;
  }

  return (
    <section className="feature-section section-stack topic-role-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">{locale === "zh" ? "岗位列表" : "Roles in this topic"}</h2>
          <span className="section-note">
            {locale === "zh" ? "按当前专题条件筛出的岗位。" : "Roles currently matched to this topic."}
          </span>
        </div>
      </div>
      <ol className="topic-role-list">
        {roles.map((role, index) => (
          <li key={role.slug} className="topic-role-card">
            <Link className="topic-role-link" href={`/${locale}/roles/${role.slug}`}>
              <div className="topic-role-topline">
                <span className="topic-role-rank">{String(index + 1).padStart(2, "0")}</span>
                <strong className="topic-role-name">{role.name}</strong>
                <span className="percentage-chip topic-role-rate">
                  {typeof role.replacementRate === "number"
                    ? `${role.replacementRate}%`
                    : locale === "zh"
                      ? "待评估"
                      : "Pending"}
                </span>
              </div>
              <p className="topic-role-summary">
                {role.summary ??
                  (locale === "zh"
                    ? "该岗位暂无更多摘要说明。"
                    : "No additional summary is available for this role yet.")}
              </p>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
