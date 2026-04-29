export const WEEKLY_DIGEST_INTERVAL_DAYS = 7;
export const SIGNIFICANT_CHANGE_THRESHOLD = 8;

export function isWeeklyDigestDue({
  lastDigestSentAt,
  oldestSubscriptionCreatedAt,
  now
}: {
  lastDigestSentAt: Date | null;
  oldestSubscriptionCreatedAt: Date | null;
  now: Date;
}) {
  const basis = lastDigestSentAt ?? oldestSubscriptionCreatedAt;
  if (!basis) {
    return false;
  }

  return now.getTime() - basis.getTime() >= WEEKLY_DIGEST_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
}

export function hasSignificantReplacementRateChange({
  baselineReplacementRate,
  currentReplacementRate,
  lastRatedAt,
  subscriptionCreatedAt,
  lastAlertSentAt
}: {
  baselineReplacementRate: number | null;
  currentReplacementRate: number | null;
  lastRatedAt: Date | null;
  subscriptionCreatedAt: Date;
  lastAlertSentAt: Date | null;
}) {
  if (baselineReplacementRate === null || currentReplacementRate === null || !lastRatedAt) {
    return false;
  }

  const delta = Math.abs(currentReplacementRate - baselineReplacementRate);
  const freshnessBoundary = lastAlertSentAt ?? subscriptionCreatedAt;

  return delta >= SIGNIFICANT_CHANGE_THRESHOLD && lastRatedAt.getTime() > freshnessBoundary.getTime();
}

export function formatReplacementDelta(previousRate: number, currentRate: number) {
  const delta = currentRate - previousRate;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return {
    delta,
    direction,
    absoluteDelta: Math.abs(delta)
  };
}
