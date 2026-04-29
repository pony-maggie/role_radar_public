const ROLE_RISK_TREND_TIME_ZONE = "Asia/Hong_Kong";
const trendDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ROLE_RISK_TREND_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function getZonedDateParts(date: Date) {
  const parts = trendDateFormatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function toMonthKey(date: Date) {
  const { year, month } = getZonedDateParts(date);
  return `${year}-${padDatePart(month)}`;
}

function toWeekKey(date: Date) {
  const { year, month, day } = getZonedDateParts(date);
  const value = new Date(Date.UTC(year, month - 1, day));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - weekday + 1);
  return formatDateKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function aggregateBuckets(
  snapshots: Array<{ snapshotAt: Date; replacementRate: number | null }>,
  bucketKey: (date: Date) => string
) {
  const buckets = new Map<string, number[]>();

  for (const snapshot of snapshots) {
    if (typeof snapshot.replacementRate !== "number") {
      continue;
    }

    const key = bucketKey(snapshot.snapshotAt);
    const values = buckets.get(key) ?? [];
    values.push(snapshot.replacementRate);
    buckets.set(key, values);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bucketLabel, values]) => ({
      bucketLabel,
      averageReplacementRate: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      pointCount: values.length
    }));
}

export function buildRoleRiskTrend(
  snapshots: Array<{ snapshotAt: Date; replacementRate: number | null }>
) {
  return {
    week: aggregateBuckets(snapshots, toWeekKey),
    month: aggregateBuckets(snapshots, toMonthKey)
  };
}
