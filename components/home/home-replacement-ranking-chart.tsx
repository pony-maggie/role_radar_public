import Link from "next/link";

type ReplacementRankingItem = {
  slug: string;
  name: string;
  replacementRate: number;
};

export function HomeReplacementRankingChart({
  locale,
  title,
  note,
  metricLabel,
  items
}: {
  locale: "en" | "zh";
  title: string;
  note: string;
  metricLabel: string;
  items: ReplacementRankingItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  const maxReplacementRate = Math.max(...items.map((item) => item.replacementRate), 1);

  return (
    <section className="feature-section section-stack replacement-ranking-section">
      <div className="section-header replacement-ranking-header">
        <div>
          <h2 className="section-title">{title}</h2>
          <span className="section-note">{note}</span>
        </div>
        <span className="section-note">{metricLabel}</span>
      </div>
      <ol className="replacement-ranking-list">
        {items.map((item, index) => {
          const barWidth = Math.max(8, (item.replacementRate / maxReplacementRate) * 100);

          return (
            <li key={item.slug} className="replacement-ranking-row">
              <Link className="replacement-ranking-link" href={`/${locale}/roles/${item.slug}`}>
                <div className="replacement-ranking-copy">
                  <span className="replacement-ranking-rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="replacement-ranking-name">{item.name}</span>
                  <strong className="replacement-ranking-value">{item.replacementRate}%</strong>
                </div>
                <div className="replacement-ranking-track" aria-hidden="true">
                  <span
                    className="replacement-ranking-fill"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
