export function EvidenceTable({
  locale,
  signals
}: {
  locale: "en" | "zh";
  signals: Array<{
    id: string;
    sourceTitle: string;
    sourceLabel: string | null;
    sourceHost: string | null;
    sourceUrl: string;
    sourceType: string;
    publishedAt: Date;
    rationaleEn: string;
    rationaleZh: string;
  }>;
}) {
  return (
    <section className="research-card section-stack">
      <div className="section-header">
        <h2 className="section-title">{locale === "zh" ? "证据" : "Evidence"}</h2>
        <span className="section-note">{locale === "zh" ? "来源可查" : "Inspectable sources"}</span>
      </div>
        <ul className="evidence-list">
        {signals.map((signal) => (
          <li key={signal.id} className="evidence-row">
            <div className="evidence-meta">
              <span>{signal.publishedAt.toISOString().slice(0, 10)}</span>
              <span>{signal.sourceLabel ?? signal.sourceType}</span>
              {signal.sourceHost ? <span>{signal.sourceHost}</span> : null}
            </div>
            <a className="evidence-link" href={signal.sourceUrl} rel="noreferrer" target="_blank">
              {signal.sourceTitle}
            </a>
            <p className="evidence-copy">{locale === "zh" ? signal.rationaleZh : signal.rationaleEn}</p>
            <a className="timeline-source-link" href={signal.sourceUrl} rel="noreferrer" target="_blank">
              {locale === "zh" ? "打开原文" : "Open original"}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
