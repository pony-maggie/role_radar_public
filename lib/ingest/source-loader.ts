import { fetchHtmlItems } from "./fetch-html";
import { fetchJobsItems } from "./fetch-jobs";
import { fetchRssItems } from "./fetch-rss";
import { sourceCatalog } from "./source-catalog";
import type { SourceCatalogEntry } from "./source-types";
import type { RawSourceItem } from "./source-types";

type ListConfiguredSourcesOptions = {
  includeManual?: boolean;
  ids?: string[];
};

export function listConfiguredSources(options?: ListConfiguredSourcesOptions) {
  const idFilter = options?.ids?.length ? new Set(options.ids) : null;

  return sourceCatalog.filter((source) => {
    if (idFilter) {
      return idFilter.has(source.id);
    }

    return options?.includeManual || source.enabledByDefault;
  });
}

export async function fetchCatalogSourceItems(
  source: SourceCatalogEntry
): Promise<RawSourceItem[]> {
  if (source.class === "jobs") {
    return fetchJobsItems(source);
  }

  if (source.transport === "html") {
    return fetchHtmlItems(source);
  }

  return fetchRssItems(source);
}
