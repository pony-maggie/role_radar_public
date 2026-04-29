export function RecentSignalList({
  note,
  title,
  signals
}: {
  note: string;
  title: string;
  signals: Array<{ id: string; title: string; roleName: string; publishedAt: string; summary: string }>;
}) {
  return (
    <section className="feature-section section-stack">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <span className="section-note">{note}</span>
      </div>
      <ul className="signal-list">
        {signals.map((signal) => (
          <li key={signal.id} className="signal-card">
            <p className="signal-card-title">{signal.title}</p>
            <div className="signal-meta">
              <span>{signal.roleName}</span>
              <span>{signal.publishedAt}</span>
            </div>
            <p className="signal-copy">{signal.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
