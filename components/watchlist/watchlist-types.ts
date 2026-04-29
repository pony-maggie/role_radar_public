export type WatchlistItem = {
  slug: string;
  nameEn: string;
  nameZh: string;
  riskLevel: string;
  replacementRate: number | null;
  latestSignalSummaryEn: string | null;
  latestSignalSummaryZh: string | null;
  latestSignalPublishedAt: string | null;
};
