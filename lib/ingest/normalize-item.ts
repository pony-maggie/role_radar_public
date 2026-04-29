import type { RawSourceItem } from "./adapter";

export function normalizeItem(item: RawSourceItem) {
  const publishedAt = new Date(item.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) {
    throw new Error(`Invalid publishedAt timestamp: ${item.publishedAt}`);
  }

  return {
    ...item,
    title: item.title.trim(),
    summary: item.summary.trim(),
    publishedAt
  };
}
