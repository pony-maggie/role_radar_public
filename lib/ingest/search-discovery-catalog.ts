export type DiscoverySiteEntry = {
  id: string;
  label: string;
  domain: string;
  locale: "en" | "zh";
  maxResults: number;
  sourceType: "NEWS";
  queryTemplates: string[];
  topicHints: string[];
};

export const discoveryCatalog: DiscoverySiteEntry[] = [
  {
    id: "discovery-jiqizhixin",
    label: "机器之心 Search Discovery",
    domain: "jiqizhixin.com",
    locale: "zh",
    maxResults: 6,
    sourceType: "NEWS",
    queryTemplates: ["AI 职位", "AI 招聘", "AI 自动化", "人工智能 工作流"],
    topicHints: ["ai agents", "automation", "workflow", "research"]
  },
  {
    id: "discovery-qbitai",
    label: "量子位 Search Discovery",
    domain: "qbitai.com",
    locale: "zh",
    maxResults: 6,
    sourceType: "NEWS",
    queryTemplates: ["AI 岗位", "AI coding", "人工智能 自动化", "AI 工作流"],
    topicHints: ["developer tools", "automation", "ai products", "workflows"]
  },
  {
    id: "discovery-aibase",
    label: "AIbase Search Discovery",
    domain: "aibase.com",
    locale: "zh",
    maxResults: 6,
    sourceType: "NEWS",
    queryTemplates: ["AI 应用", "AI 工作流", "人工智能 自动化", "AI 任务 自动化"],
    topicHints: ["ai products", "adoption", "automation", "productivity"]
  },
  {
    id: "discovery-infoq-cn",
    label: "InfoQ CN Search Discovery",
    domain: "infoq.cn",
    locale: "zh",
    maxResults: 6,
    sourceType: "NEWS",
    queryTemplates: ["AI 工程", "AI 工作流", "智能体 自动化", "企业 AI"],
    topicHints: ["engineering", "developer tools", "workflows", "enterprise ai"]
  },
  {
    id: "discovery-the-decoder",
    label: "The Decoder Search Discovery",
    domain: "the-decoder.com",
    locale: "en",
    maxResults: 6,
    sourceType: "NEWS",
    queryTemplates: ["AI workflow", "AI jobs", "agent automation", "enterprise AI"],
    topicHints: ["agent tooling", "enterprise adoption", "productivity", "model launches"]
  }
];
