export function SignalTimeline({
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
    summaryEn: string;
    summaryZh: string;
    rationaleEn: string;
    rationaleZh: string;
    publishedAt: Date;
  }>;
}) {
  return (
    <section className="feature-section section-stack role-source-board">
      <div className="section-header">
        <h2 className="section-title">{locale === "zh" ? "时间线" : "Timeline"}</h2>
        <span className="section-note">{locale === "zh" ? "按时间倒序展示相关资讯与案例" : "Relevant news and cases, newest first"}</span>
      </div>
      {signals.length ? (
        <ul className="timeline-masonry">
          {signals.map((signal) => (
            <li key={signal.id} className="timeline-item timeline-card">
              <div className="timeline-provenance">
                <div className="timeline-meta timeline-card-meta">
                  <span className="timeline-provenance-label">{locale === "zh" ? "来源" : "Source"}</span>
                  <span className="timeline-source-chip">{signal.sourceLabel ?? signal.sourceType}</span>
                  {signal.sourceHost ? <span>{signal.sourceHost}</span> : null}
                  <span>{signal.publishedAt.toISOString().slice(0, 10)}</span>
                </div>
                <a className="timeline-link" href={signal.sourceUrl} rel="noreferrer" target="_blank">
                  {signal.sourceTitle}
                </a>
              </div>
              <p className="timeline-summary">{locale === "zh" ? signal.summaryZh : signal.summaryEn}</p>
              <a className="timeline-source-link" href={signal.sourceUrl} rel="noreferrer" target="_blank">
                {locale === "zh" ? "打开原文" : "Open original"}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="timeline-empty-card">
          <p className="timeline-summary">
            {locale === "zh"
              ? "当前还没有挂接到这个岗位的真实资讯或招聘信号，替代率暂时主要由岗位性质推理得出。"
              : "No role-specific news or job signals are attached yet, so the current replacement rate is mainly inferred from the role profile."}
          </p>
        </div>
      )}
    </section>
  );
}
