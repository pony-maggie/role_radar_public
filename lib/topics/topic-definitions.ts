import type { TopicDefinition } from "./topic-types";

export const topicDefinitions = [
  {
    slug: "highest-ai-replacement-rates",
    type: "ranking",
    localeTitles: {
      en: "Jobs with the highest AI replacement rates",
      zh: "AI 替代率最高的岗位",
    },
    localeDescriptions: {
      en: "Browse the roles currently showing the highest stored AI replacement rates in Role Radar.",
      zh: "查看当前在职危图谱中 AI 替代率最高的一批岗位。",
    },
    filters: {
      limit: 20,
      minReplacementRate: 55,
    },
    faq: [
      {
        questionEn: "How are these roles chosen?",
        questionZh: "这些岗位是怎么选出来的？",
        answerEn: "They are ordered by the stored replacement rate already computed in Role Radar.",
        answerZh: "这些岗位按职危图谱中已存储的替代率排序。",
      },
    ],
  },
  {
    slug: "which-jobs-are-most-at-risk",
    type: "ranking",
    localeTitles: {
      en: "Which jobs are most at risk from AI",
      zh: "哪些工作最容易被 AI 取代",
    },
    localeDescriptions: {
      en: "See the jobs with the clearest automation exposure and the highest replacement pressure.",
      zh: "查看自动化暴露最明显、替代压力最高的工作岗位。",
    },
    filters: {
      limit: 20,
      minReplacementRate: 45,
    },
    faq: [
      {
        questionEn: "Is this the same as highest replacement rates?",
        questionZh: "这和“AI 替代率最高的岗位”是一回事吗？",
        answerEn: "It overlaps, but this page is phrased for intent that asks about risk rather than raw ranking.",
        answerZh: "两者有重叠，但这个页面更贴近“风险”意图，而不是只看纯排名。",
      },
    ],
  },
  {
    slug: "administrative-and-office-jobs",
    type: "cluster",
    localeTitles: {
      en: "AI impact on administrative and office jobs",
      zh: "AI 对行政与办公室岗位的影响",
    },
    localeDescriptions: {
      en: "Explore administrative and office roles that show clear overlap with automation and workflow tools.",
      zh: "查看与自动化和工作流工具重叠明显的行政与办公室岗位。",
    },
    filters: {
      includeKeywords: ["administrative", "office", "clerical", "assistant", "scheduling"],
      limit: 24,
    },
    faq: [
      {
        questionEn: "Why group these jobs together?",
        questionZh: "为什么把这些岗位放在一起？",
        answerEn: "They share similar workflow-heavy tasks, so the same automation pattern often applies across the cluster.",
        answerZh: "它们共享相似的流程型工作，因此同一类自动化模式通常会覆盖整个集合。",
      },
    ],
  },
  {
    slug: "customer-support-jobs",
    type: "cluster",
    localeTitles: {
      en: "AI impact on customer support jobs",
      zh: "AI 对客服岗位的影响",
    },
    localeDescriptions: {
      en: "Review customer support roles where repetitive handling, routing, and response drafting are most exposed.",
      zh: "查看在重复处理、转接和回复草拟上最容易被影响的客服岗位。",
    },
    filters: {
      includeKeywords: ["customer support", "call center", "service representative", "help desk", "customer success"],
      limit: 24,
    },
    faq: [
      {
        questionEn: "Does this include both phone and online support?",
        questionZh: "这里包含电话客服和在线客服吗？",
        answerEn: "Yes. The cluster is broad enough to cover both channels when the underlying role data matches.",
        answerZh: "包含。只要底层岗位数据匹配，这个集合会同时覆盖电话和在线支持。",
      },
    ],
  },
  {
    slug: "finance-and-accounting-jobs",
    type: "cluster",
    localeTitles: {
      en: "AI impact on finance and accounting jobs",
      zh: "AI 对财务与会计岗位的影响",
    },
    localeDescriptions: {
      en: "Explore finance and accounting roles with heavy reporting, reconciliation, and transaction workflows.",
      zh: "查看那些以报表、对账和交易流程为主的财务与会计岗位。",
    },
    filters: {
      includeKeywords: ["accounting", "bookkeeping", "payroll", "billing", "finance", "financial"],
      limit: 24,
    },
    faq: [
      {
        questionEn: "Why are finance roles often surfaced here?",
        questionZh: "为什么财务岗位经常会出现在这里？",
        answerEn: "Many finance roles contain recurring recordkeeping and reconciliation work that maps well to automation pressure.",
        answerZh: "很多财务岗位包含重复性的记录和对账工作，这些工作很容易对应到自动化压力。",
      },
    ],
  },
  {
    slug: "legal-jobs",
    type: "cluster",
    localeTitles: {
      en: "AI impact on legal jobs",
      zh: "AI 对法律岗位的影响",
    },
    localeDescriptions: {
      en: "Browse legal roles where research, document review, and drafting can be partially automated.",
      zh: "查看那些研究、文书审阅和起草工作容易被部分自动化的法律岗位。",
    },
    filters: {
      includeKeywords: ["legal", "paralegal", "attorney", "lawyer", "lawyers", "contracts", "compliance"],
      limit: 24,
    },
    faq: [
      {
        questionEn: "Are these pages legal advice?",
        questionZh: "这些页面是法律建议吗？",
        answerEn: "No. They describe labor-market exposure, not legal advice or hiring guidance.",
        answerZh: "不是。它们描述的是劳动力市场暴露情况，不是法律建议或招聘建议。",
      },
    ],
  },
] as const satisfies readonly TopicDefinition[];

export type TopicSlug = (typeof topicDefinitions)[number]["slug"];

export const homepageFeaturedTopicSlugs = [
  "highest-ai-replacement-rates",
  "which-jobs-are-most-at-risk",
  "administrative-and-office-jobs"
] as const satisfies readonly TopicSlug[];
