export type TopicType = "ranking" | "cluster";

type TopicLocaleText = Readonly<{
  en: string;
  zh: string;
}>;

type TopicFaqEntry = Readonly<{
  questionEn: string;
  questionZh: string;
  answerEn: string;
  answerZh: string;
}>;

type TopicBase = Readonly<{
  slug: string;
  localeTitles: TopicLocaleText;
  localeDescriptions: TopicLocaleText;
  faq: readonly TopicFaqEntry[];
}>;

export type RankingTopicDefinition = TopicBase &
  Readonly<{
    type: "ranking";
    filters: Readonly<{
      limit: number;
      minReplacementRate?: number;
      includeSlugs?: never;
      includeKeywords?: never;
    }>;
  }>;

type ClusterTopicFilters =
  | Readonly<{
      limit: number;
      includeSlugs: readonly string[];
      includeKeywords?: readonly string[];
      minReplacementRate?: never;
    }>
  | Readonly<{
      limit: number;
      includeSlugs?: readonly string[];
      includeKeywords: readonly string[];
      minReplacementRate?: never;
    }>;

export type ClusterTopicDefinition = TopicBase &
  Readonly<{
    type: "cluster";
    filters: ClusterTopicFilters;
  }>;

export type TopicDefinition = RankingTopicDefinition | ClusterTopicDefinition;
