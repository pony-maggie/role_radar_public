"use client";

import { useState } from "react";
import { ReviewRow } from "./review-row";

type ReviewQueueItem = {
  id: string;
  sourceTitle: string;
  sourceLabel: string;
  publishedAt: string;
  reason: string;
  candidateSlugs: string[];
  matchedKeywords: string[];
  sourceUrl: string;
};

export function ReviewQueue({
  items,
  locale,
  reviewToken
}: {
  items: ReviewQueueItem[];
  locale: "en" | "zh";
  reviewToken: string;
}) {
  const [queue, setQueue] = useState(items);

  const copy =
    locale === "zh"
      ? {
          title: "审核队列",
          subtitle: "待审项",
          empty: "当前没有待审 source item。"
        }
      : {
          title: "Review queue",
          subtitle: "Pending items",
          empty: "There are no pending source items right now."
        };

  return (
    <section>
      <h1>{copy.title}</h1>
      <p>
        {copy.subtitle} {queue.length}
      </p>
      {queue.length === 0 ? <p>{copy.empty}</p> : null}
      <div>
        {queue.map((item) => (
          <ReviewRow
            item={item}
            key={item.id}
            locale={locale}
            reviewToken={reviewToken}
            onResolved={(decisionId) =>
              setQueue((current) => current.filter((entry) => entry.id !== decisionId))
            }
          />
        ))}
      </div>
    </section>
  );
}
