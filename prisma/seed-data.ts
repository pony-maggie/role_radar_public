export const demoRoles = [
  {
    id: "role_customer_service_representative",
    dictionaryRoleSlug: "customer-service-representative",
    slug: "customer-service-representative",
    socCode: "43-4051",
    nameEn: "Customer Service Representative",
    nameZh: "客户服务专员",
    summaryEn: "A language-heavy support role with growing AI deflection pressure.",
    summaryZh: "以语言处理为主的支持岗位，正面临持续增强的 AI 分流压力。",
    riskLevel: "HIGH",
    replacementRate: 68,
    riskSummaryEn: "Support triage and resolution workflows are increasingly routed through AI-first systems.",
    riskSummaryZh: "客户支持分诊和处理流程正越来越多地被导向 AI 优先系统。",
    riskReasons: [
      {
        kind: "structure",
        titleEn: "Structured language work",
        titleZh: "结构化语言工作",
        detailEn: "The role spends a large share of time on repeatable text-heavy interactions.",
        detailZh: "这个岗位有相当大一部分时间花在可重复、以文本为主的互动上。"
      },
      {
        kind: "official",
        titleEn: "Official workflow rollout",
        titleZh: "官方工作流落地",
        detailEn: "Recent company updates show first-line support workflows moving into AI-led triage.",
        detailZh: "近期公司更新显示，一线客户支持工作流正在转向 AI 主导分诊。"
      }
    ],
    ratingStatus: "RATED",
    lastRatedAt: "2026-01-01T00:00:00.000Z",
    repetitionScore: 4,
    ruleClarityScore: 4,
    transformationScore: 5,
    workflowAutomationScore: 4,
    interpersonalScore: 2,
    physicalityScore: 1,
    ambiguityScore: 2
  },
  {
    id: "role_bookkeeping_clerk",
    dictionaryRoleSlug: "bookkeeping-clerk",
    slug: "bookkeeping-clerk",
    socCode: "43-3031",
    nameEn: "Bookkeeping Clerk",
    nameZh: "记账员",
    summaryEn: "Structured financial data handling makes this role moderately exposed.",
    summaryZh: "高度结构化的财务数据处理让这个岗位处于中高暴露区间。",
    riskLevel: "MEDIUM",
    replacementRate: 51,
    riskSummaryEn: "AI copilots are compressing repetitive reconciliation work, but exceptions still require humans.",
    riskSummaryZh: "AI 助手正在压缩重复性的对账工作，但异常情况仍需要人工处理。",
    riskReasons: [
      {
        kind: "structure",
        titleEn: "Repeatable financial workflows",
        titleZh: "可重复的财务流程",
        detailEn: "Invoice review and reconciliation are highly structured and easy to compress.",
        detailZh: "发票审核和对账流程高度结构化，容易被压缩。"
      },
      {
        kind: "media",
        titleEn: "Production tooling adoption",
        titleZh: "生产环境工具渗透",
        detailEn: "Recent case studies show bookkeeping teams pushing more routine work into copilots.",
        detailZh: "近期案例显示，记账团队正把更多例行工作交给 AI 助手。"
      }
    ],
    ratingStatus: "RATED",
    lastRatedAt: "2026-01-01T00:00:00.000Z",
    repetitionScore: 4,
    ruleClarityScore: 4,
    transformationScore: 3,
    workflowAutomationScore: 4,
    interpersonalScore: 1,
    physicalityScore: 1,
    ambiguityScore: 2
  },
  {
    id: "role_industrial_maintenance_technician",
    dictionaryRoleSlug: "industrial-maintenance-technician",
    slug: "industrial-maintenance-technician",
    socCode: "49-9041",
    nameEn: "Industrial Maintenance Technician",
    nameZh: "工业维护技师",
    summaryEn: "Physical execution and ambiguous field conditions reduce near-term AI substitution.",
    summaryZh: "物理执行和现场不确定性降低了短期 AI 替代概率。",
    riskLevel: "LOW",
    replacementRate: null,
    riskSummaryEn: null,
    riskSummaryZh: null,
    riskReasons: null,
    ratingStatus: "INSUFFICIENT_SIGNAL",
    lastRatedAt: "2026-01-01T00:00:00.000Z",
    repetitionScore: 2,
    ruleClarityScore: 2,
    transformationScore: 1,
    workflowAutomationScore: 2,
    interpersonalScore: 3,
    physicalityScore: 5,
    ambiguityScore: 4
  }
] as const;

export const demoRoleRiskSnapshots = [
  {
    roleSlug: "customer-service-representative",
    snapshotAt: "2026-03-01T00:00:00.000Z",
    replacementRate: 60,
    riskLevel: "HIGH",
    ratingStatus: "RATED",
    wasRecomputed: true,
    source: "full_refresh"
  },
  {
    roleSlug: "customer-service-representative",
    snapshotAt: "2026-04-01T00:00:00.000Z",
    replacementRate: 68,
    riskLevel: "HIGH",
    ratingStatus: "RATED",
    wasRecomputed: true,
    source: "full_refresh"
  },
  {
    roleSlug: "bookkeeping-clerk",
    snapshotAt: "2026-03-01T00:00:00.000Z",
    replacementRate: 47,
    riskLevel: "MEDIUM",
    ratingStatus: "RATED",
    wasRecomputed: true,
    source: "full_refresh"
  },
  {
    roleSlug: "bookkeeping-clerk",
    snapshotAt: "2026-04-01T00:00:00.000Z",
    replacementRate: 51,
    riskLevel: "MEDIUM",
    ratingStatus: "RATED",
    wasRecomputed: true,
    source: "full_refresh"
  }
] as const;

export const demoSignals = [
  {
    id: "signal_company_support_ai",
    roleSlug: "customer-service-representative",
    sourceUrl: "https://example.com/company-support-ai",
    sourceTitle: "Support workflow moves to AI-first triage",
    sourceType: "COMPANY_UPDATE",
    signalType: "ADOPTION",
    strength: "HIGH",
    publishedAt: "2026-04-01T00:00:00.000Z",
    summaryEn: "AI triage is absorbing first-line support work.",
    summaryZh: "AI 分诊正在吸收一线支持工作。",
    rationaleEn: "Direct workflow replacement evidence maps to this role.",
    rationaleZh: "这是与该岗位直接对应的流程替代证据。"
  },
  {
    id: "signal_bookkeeping_ai_workflows",
    roleSlug: "bookkeeping-clerk",
    sourceUrl: "https://example.com/bookkeeping-ai-workflows",
    sourceTitle: "Bookkeeping teams shift reconciliation workflows to AI copilots",
    sourceType: "NEWS",
    signalType: "TOOLING",
    strength: "MEDIUM",
    publishedAt: "2026-03-20T00:00:00.000Z",
    summaryEn: "AI copilots are taking over recurring reconciliation tasks.",
    summaryZh: "AI 助手正在接管重复性的对账任务。",
    rationaleEn: "Recurring bookkeeping workflows are being automated in production.",
    rationaleZh: "重复性记账流程正在生产环境中被自动化。"
  }
] as const;

export const demoSourceItems = [
  {
    id: "source_item_company_support_ai",
    sourceCatalogId: "demo-company-support",
    sourceLabel: "Demo Company Updates",
    sourceUrl: "https://example.com/company-support-ai",
    sourceType: "COMPANY_UPDATE",
    title: "Support workflow moves to AI-first triage",
    summaryEn: "AI triage is absorbing first-line support work.",
    summaryZh: "AI 分诊正在吸收一线支持工作。",
    publishedAt: "2026-04-01T00:00:00.000Z",
    mappingMode: "DIRECT_MAPPED"
  },
  {
    id: "source_item_bookkeeping_ai_workflows",
    sourceCatalogId: "demo-bookkeeping-news",
    sourceLabel: "Demo Industry News",
    sourceUrl: "https://example.com/bookkeeping-ai-workflows",
    sourceType: "NEWS",
    title: "Bookkeeping teams shift reconciliation workflows to AI copilots",
    summaryEn: "AI copilots are taking over recurring reconciliation tasks.",
    summaryZh: "AI 助手正在接管重复性的对账任务。",
    publishedAt: "2026-03-20T00:00:00.000Z",
    mappingMode: "DIRECT_MAPPED"
  },
  {
    id: "source_item_bookkeeping_pending_review",
    sourceCatalogId: "media-fintech-ops",
    sourceLabel: "Fintech Ops Review",
    sourceUrl: "https://example.com/bookkeeping-ai-rollout-review",
    sourceType: "NEWS",
    title: "Bookkeeping AI rollout needs manual review",
    summaryEn: "Finance teams test AI copilots for reconciliation and invoice handling.",
    summaryZh: "财务团队正在测试用于对账和发票处理的 AI 助手。",
    publishedAt: "2026-04-08T00:00:00.000Z",
    mappingMode: "OBSERVE_ONLY"
  },
  {
    id: "source_item_support_jobs_shift",
    sourceCatalogId: "jobs-openai-careers",
    sourceLabel: "OpenAI Careers",
    sourceUrl: "https://openai.com/jobs/support-operations-automation",
    sourceType: "JOB_POSTING",
    title: "Support operations automation specialist",
    summaryEn: "A job listing focused on workflow automation for support operations.",
    summaryZh: "一个聚焦客户支持运营工作流自动化的招聘职位。",
    publishedAt: "2026-04-09T00:00:00.000Z",
    mappingMode: "DIRECT_MAPPED"
  }
] as const;

export const demoSourceItemDecisions = [
  {
    id: "source_item_decision_company_support_ai",
    sourceItemId: "source_item_company_support_ai",
    roleSlug: "customer-service-representative",
    decisionStatus: "ACCEPTED",
    confidence: "HIGH",
    reason: "Seeded from approved company-update signal",
    candidateSlugs: ["customer-service-representative"],
    matchedKeywords: ["support agent", "triage"],
    reviewStatus: "APPROVED",
    reviewedAt: "2026-04-01T00:00:00.000Z",
    modelProvider: "google",
    modelName: "gemini-2.5-flash",
    assignedRoleSlug: "customer-service-representative",
    inferenceSummaryEn: "The official update directly affects customer support triage workflows.",
    inferenceSummaryZh: "官方更新直接影响客户支持分诊工作流。",
    impactDirection: "INCREASE",
    relevance: "HIGH",
    signalWeight: 0.95,
    rawJson: {
      roleSlug: "customer-service-representative",
      impactDirection: "increase"
    }
  },
  {
    id: "source_item_decision_bookkeeping_ai_workflows",
    sourceItemId: "source_item_bookkeeping_ai_workflows",
    roleSlug: "bookkeeping-clerk",
    decisionStatus: "ACCEPTED",
    confidence: "MEDIUM",
    reason: "Seeded from approved industry-news signal",
    candidateSlugs: ["bookkeeping-clerk"],
    matchedKeywords: ["reconciliation", "bookkeeping"],
    reviewStatus: "APPROVED",
    reviewedAt: "2026-03-20T00:00:00.000Z",
    modelProvider: "google",
    modelName: "gemini-2.5-flash",
    assignedRoleSlug: "bookkeeping-clerk",
    inferenceSummaryEn: "The media report shows recurring bookkeeping work moving into AI copilots.",
    inferenceSummaryZh: "媒体报道显示重复性的记账工作正在转向 AI 助手。",
    impactDirection: "INCREASE",
    relevance: "MEDIUM",
    signalWeight: 0.7,
    rawJson: {
      roleSlug: "bookkeeping-clerk",
      impactDirection: "increase"
    }
  },
  {
    id: "source_item_decision_bookkeeping_pending_review",
    sourceItemId: "source_item_bookkeeping_pending_review",
    roleSlug: "bookkeeping-clerk",
    decisionStatus: "ACCEPTED",
    confidence: "HIGH",
    reason: "Unique high-confidence candidate",
    candidateSlugs: ["bookkeeping-clerk"],
    matchedKeywords: ["reconciliation", "invoice"],
    reviewStatus: "PENDING",
    reviewedAt: null,
    modelProvider: "google",
    modelName: "gemini-2.5-flash",
    assignedRoleSlug: "bookkeeping-clerk",
    inferenceSummaryEn: "The article points to AI pressure on bookkeeping reconciliation work.",
    inferenceSummaryZh: "这篇文章指向 AI 对记账对账工作的压力。",
    impactDirection: "INCREASE",
    relevance: "HIGH",
    signalWeight: 0.75,
    rawJson: {
      roleSlug: "bookkeeping-clerk",
      impactDirection: "increase"
    }
  },
  {
    id: "source_item_decision_support_jobs_shift",
    sourceItemId: "source_item_support_jobs_shift",
    roleSlug: "customer-service-representative",
    decisionStatus: "ACCEPTED",
    confidence: "MEDIUM",
    reason: "Seeded from classified jobs signal",
    candidateSlugs: ["customer-service-representative"],
    matchedKeywords: ["support operations", "automation"],
    reviewStatus: "PENDING",
    reviewedAt: null,
    modelProvider: "google",
    modelName: "gemini-2.5-flash",
    assignedRoleSlug: "customer-service-representative",
    inferenceSummaryEn: "The job listing shows support work shifting toward automation management.",
    inferenceSummaryZh: "这条招聘信息显示客户支持工作正在向自动化管理迁移。",
    impactDirection: "INCREASE",
    relevance: "MEDIUM",
    signalWeight: 0.45,
    rawJson: {
      roleSlug: "customer-service-representative",
      impactDirection: "increase"
    }
  }
] as const;
