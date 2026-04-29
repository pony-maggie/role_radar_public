export function HighRiskRoleList({
  locale,
  roles,
  title
}: {
  locale: "en" | "zh";
  title: string;
  roles: Array<{
    slug: string;
    name: string;
    risk: { label: string; summary: string; className: string };
  }>;
}) {
  return (
    <section className="feature-section section-stack">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <span className="section-note">{locale === "zh" ? "按替代压力排序" : "Sorted by replacement pressure"}</span>
      </div>
      <ul className="cards-grid">
        {roles.map((role) => (
          <li key={role.slug} className="role-card">
            <a className="role-card-link" href={`/${locale}/roles/${role.slug}`}>
              <div className="role-card-topline">
                <p className="role-card-title">{role.name}</p>
                <strong className={`percentage-chip ${role.risk.className}`}>{role.risk.label}</strong>
              </div>
              <p className="role-card-copy">{role.risk.summary}</p>
            </a>
            <div className="signal-meta">
              <span>{locale === "zh" ? "岗位快照" : "Role brief"}</span>
              <span>{locale === "zh" ? "查看详情" : "Open detail"}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
