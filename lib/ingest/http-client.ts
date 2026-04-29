import type { SourceCatalogEntry } from "./source-types";

type FetchLike = typeof fetch;

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRY_COUNT = 2;

const defaultIngestHeaders = {
  Accept: "text/html,application/xhtml+xml,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "User-Agent":
    "RoleRadarIngest/1.0 (+https://github.com/openai) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

export async function fetchSourceText(
  source: SourceCatalogEntry,
  fetchFn: FetchLike = fetch,
  init?: {
    accept?: string;
    timeoutMs?: number;
    retries?: number;
  }
) {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = init?.retries ?? DEFAULT_RETRY_COUNT;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn(source.url, {
        headers: {
          ...defaultIngestHeaders,
          ...(init?.accept ? { Accept: init.accept } : {}),
          Referer: source.url
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (isRetryableStatus(response.status) && attempt < retries) {
          await sleep(600 * (attempt + 1));
          continue;
        }

        throw new Error(`Failed to fetch ${source.label}: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      const message = error instanceof Error ? error.message : String(error);
      const timedOut = error instanceof Error && error.name === "AbortError";
      const retryable = timedOut || /Failed to fetch .*: (408|425|429|500|502|503|504)/.test(message);
      if (!retryable || attempt >= retries) {
        if (timedOut) {
          throw new Error(`Failed to fetch ${source.label}: timeout`);
        }

        throw error;
      }

      await sleep(600 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${source.label}`);
}
