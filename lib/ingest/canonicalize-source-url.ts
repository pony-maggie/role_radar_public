const TRACKING_PARAMS = [/^utm_/i, /^spm$/i, /^from$/i, /^ref$/i];

export function canonicalizeSourceUrl(input: string) {
  const url = new URL(input);
  url.hostname = url.hostname.replace(/^www\./i, "").toLowerCase();

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) {
      url.searchParams.delete(key);
    }
  }

  return url.toString();
}
