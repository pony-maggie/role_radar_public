import { notFound } from "next/navigation";

const REVIEW_QUEUE_QUERY_KEY = "reviewToken";
const REVIEW_QUEUE_HEADER = "x-review-token";

export function getReviewQueueToken() {
  const token = process.env.REVIEW_QUEUE_TOKEN?.trim();
  return token ? token : null;
}

export function isReviewQueueEnabled() {
  return getReviewQueueToken() !== null;
}

export function getReviewQueueQueryKey() {
  return REVIEW_QUEUE_QUERY_KEY;
}

export function getReviewQueueHeaderName() {
  return REVIEW_QUEUE_HEADER;
}

export function assertReviewTokenFromSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const expected = getReviewQueueToken();
  const provided = searchParams[REVIEW_QUEUE_QUERY_KEY];
  const value = Array.isArray(provided) ? provided[0] : provided;

  if (!expected || !value || value !== expected) {
    notFound();
  }

  return expected;
}

export function hasValidReviewToken(request: Request) {
  const expected = getReviewQueueToken();
  if (!expected) {
    return false;
  }

  return request.headers.get(REVIEW_QUEUE_HEADER) === expected;
}
