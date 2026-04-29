"use client";

import { useState, useTransition } from "react";

type ReviewRowProps = {
  item: {
    id: string;
    sourceTitle: string;
    sourceLabel: string;
    publishedAt: string;
    reason: string;
    candidateSlugs: string[];
    matchedKeywords: string[];
    sourceUrl: string;
  };
  locale: "en" | "zh";
  reviewToken: string;
  onResolved: (decisionId: string) => void;
};

export function ReviewRow({ item, locale, onResolved, reviewToken }: ReviewRowProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const labels =
    locale === "zh"
      ? {
          approve: "批准",
          reject: "拒绝",
          candidates: "候选岗位",
          matchedKeywords: "命中关键词",
          why: "判定原因",
          open: "查看原文",
          pending: "处理中…",
          unknown: "请求失败，请重试。"
        }
      : {
          approve: "Approve",
          reject: "Reject",
          candidates: "Candidates",
          matchedKeywords: "Matched keywords",
          why: "Why it was queued",
          open: "Open source",
          pending: "Working…",
          unknown: "Request failed. Try again."
        };

  function submit(action: "approve" | "reject") {
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/review-decisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-review-token": reviewToken
        },
        body: JSON.stringify({
          decisionId: item.id,
          action
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? labels.unknown);
        return;
      }

      onResolved(item.id);
    });
  }

  return (
    <article className="review-row" data-testid={`review-row-${item.id}`}>
      <div className="review-row__meta">
        <span>{item.sourceLabel}</span>
        <span>{item.publishedAt.slice(0, 10)}</span>
      </div>
      <h2>{item.sourceTitle}</h2>
      <p>
        <strong>{labels.candidates}:</strong> {item.candidateSlugs.join(", ") || "none"}
      </p>
      <p>
        <strong>{labels.matchedKeywords}:</strong> {item.matchedKeywords.join(", ") || "none"}
      </p>
      <p>
        <strong>{labels.why}:</strong> {item.reason}
      </p>
      <div className="review-row__actions">
        <button disabled={isPending} onClick={() => submit("approve")} type="button">
          {isPending ? labels.pending : labels.approve}
        </button>
        <button disabled={isPending} onClick={() => submit("reject")} type="button">
          {labels.reject}
        </button>
        <a href={item.sourceUrl} rel="noreferrer" target="_blank">
          {labels.open}
        </a>
      </div>
      {error ? <p>{error}</p> : null}
    </article>
  );
}
