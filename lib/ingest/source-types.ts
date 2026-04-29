import type { SourceType } from "@prisma/client";

export type SourceClass = "official" | "jobs" | "media";
export type SourceTransport = "rss" | "atom" | "html";
export type SourceStabilityTier = "structured" | "manual_html";
export type SourceMappingMode = "observe_only" | "direct_mapped";

export type SourceCatalogEntry = {
  id: string;
  label: string;
  class: SourceClass;
  transport: SourceTransport;
  tier: SourceStabilityTier;
  enabledByDefault: boolean;
  locale: "en" | "zh";
  url: string;
  mappingMode: SourceMappingMode;
  maxItems?: number;
  roleSlug?: string;
  topicHints?: string[];
  sourceType: SourceType;
};

export type RawSourceItem = {
  sourceUrl: string;
  title: string;
  publishedAt: string;
  summary: string;
  sourceType: SourceType;
  sourceLabel: string;
  sourceCatalogId: string;
  roleSlug?: string;
  topicHints?: string[];
};
