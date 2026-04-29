export function WatchlistTable({
  emptyMessage,
  latestChangeLabel,
  noRecentSignalsLabel,
  riskLabel,
  roles
}: {
  emptyMessage: string;
  latestChangeLabel: string;
  noRecentSignalsLabel: string;
  riskLabel: string;
  roles: Array<{
    slug: string;
    name: string;
    riskLevel: string;
    replacementRate: number | null;
    latestSignalSummary: string | null;
    latestSignalPublishedAt: string | null;
  }>;
}) {
  if (roles.length === 0) {
    return <p className="page-copy">{emptyMessage}</p>;
  }

  return (
    <ul className="watchlist-list">
      {roles.map((role) => (
        <li key={role.slug} className="watchlist-card">
          <strong className="watchlist-role">{role.name}</strong>
          <p className="watchlist-copy">
            {riskLabel}: <strong>{role.replacementRate !== null ? `${role.replacementRate}%` : role.riskLevel}</strong>
          </p>
          <p className="watchlist-copy">
            {latestChangeLabel}:{" "}
            {role.latestSignalSummary && role.latestSignalPublishedAt
              ? `${role.latestSignalSummary} (${role.latestSignalPublishedAt.slice(0, 10)})`
              : noRecentSignalsLabel}
          </p>
        </li>
      ))}
    </ul>
  );
}
