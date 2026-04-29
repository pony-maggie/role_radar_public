import { deriveRiskLevelFromReplacementRate } from "@/lib/domain/replacement-rate";
import type { RoleRiskReason } from "@/lib/ai/gemini-schemas";

type DictionaryRoleInput = {
  slug: string;
  nameEn: string;
  nameZh: string;
  keywords: string[];
};

function normalizeTerms(values: string[]) {
  return values.join(" ").toLowerCase();
}

function hasAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

export function inferRoleProfileFromDictionary(role: DictionaryRoleInput, sourceCount = 0) {
  const text = normalizeTerms([role.slug, role.nameEn, ...role.keywords]);
  let replacementRate = 34;

  const repeatedTextWork = [
    "customer support",
    "customer service",
    "ticket",
    "triage",
    "bookkeeping",
    "accounting",
    "reconciliation",
    "invoice",
    "data entry",
    "technical writer",
    "editing",
    "editor",
    "journalist",
    "reporter",
    "claims",
    "clerks",
    "billing",
    "administrative",
    "research analyst",
    "marketing"
  ];
  const softwareWork = ["software", "developer", "programming", "coding", "code", "systems analyst"];
  const physicalWork = [
    "maintenance",
    "technician",
    "repair",
    "industrial",
    "mechanic",
    "construction",
    "field",
    "healthcare",
    "nurse",
    "surgeon"
  ];
  const humanJudgment = [
    "manager",
    "negotiation",
    "lawyer",
    "compliance",
    "public relations",
    "sales managers",
    "human resources"
  ];

  if (hasAny(text, repeatedTextWork)) replacementRate += 18;
  if (hasAny(text, softwareWork)) replacementRate += 22;
  if (hasAny(text, physicalWork)) replacementRate -= 16;
  if (hasAny(text, humanJudgment)) replacementRate -= 8;
  if (sourceCount > 0) replacementRate += Math.min(10, sourceCount * 2);

  replacementRate = Math.max(8, Math.min(88, Math.round(replacementRate)));
  const riskLevel = deriveRiskLevelFromReplacementRate(replacementRate);

  const summaryEn =
    sourceCount > 0
      ? `This role is being tracked with ${sourceCount} recent source signal${sourceCount === 1 ? "" : "s"} and a profile-based replacement estimate.`
      : "No role-specific source items are attached yet, so the current score is inferred from the role profile and current AI capability trends.";
  const summaryZh =
    sourceCount > 0
      ? `这个岗位当前结合了 ${sourceCount} 条近期来源信号和岗位画像推理来给出替代率。`
      : "这个岗位暂时还没有挂接到足够的专属资讯，因此当前分数主要由岗位性质和当前 AI 能力趋势推理得出。";

  const reasons: RoleRiskReason[] = [
    {
      kind: "structure",
      titleEn: "Role-profile inference",
      titleZh: "岗位画像推理",
      detailEn: hasAny(text, softwareWork)
        ? "The role is tightly coupled to digital production workflows where AI coding and automation tools are advancing quickly."
        : hasAny(text, repeatedTextWork)
          ? "The role contains repeatable, language-heavy, or rules-based workflows that AI systems can increasingly compress."
          : "The role profile includes some repeatable digital work, but not enough to imply immediate large-scale replacement.",
      detailZh: hasAny(text, softwareWork)
        ? "这个岗位高度依赖数字化生产流程，而 AI 编码与自动化工具的进展非常快。"
        : hasAny(text, repeatedTextWork)
          ? "这个岗位包含较多可重复、语言密集或规则清晰的工作流，越来越容易被 AI 压缩。"
          : "这个岗位虽然包含部分可数字化工作，但还不足以推导出短期内大规模替代。"
    },
    {
      kind: "structure",
      titleEn: "Human and physical constraints",
      titleZh: "人类判断与物理约束",
      detailEn: hasAny(text, physicalWork)
        ? "Physical execution and field variability materially reduce near-term substitution pressure."
        : hasAny(text, humanJudgment)
          ? "Human judgment, negotiation, or people management still slows full AI substitution."
          : "The role remains exposed where the work is mostly digital and structured, with fewer physical barriers.",
      detailZh: hasAny(text, physicalWork)
        ? "物理执行和现场变化显著降低了这个岗位的短期 AI 替代压力。"
        : hasAny(text, humanJudgment)
          ? "人类判断、协商和管理成分仍然会拖慢这个岗位被完全替代。"
          : "当工作大多是数字化、结构化流程时，这个岗位的暴露度会更高。"
    }
  ];

  if (sourceCount === 0) {
    reasons.push({
      kind: "media",
      titleEn: "No role-specific sources yet",
      titleZh: "尚无岗位专属来源",
      detailEn: "This percentage is currently anchored by role nature rather than attached role-specific news items.",
      detailZh: "当前百分比主要锚定岗位性质，而不是已挂接的岗位专属新闻资讯。"
    });
  }

  return {
    replacementRate,
    riskLevel,
    ratingStatus: "RATED" as const,
    summaryEn,
    summaryZh,
    reasons,
    repetitionScore: hasAny(text, repeatedTextWork) ? 4 : 2,
    ruleClarityScore: hasAny(text, repeatedTextWork) ? 4 : 2,
    transformationScore: hasAny(text, softwareWork) ? 5 : 3,
    workflowAutomationScore: hasAny(text, softwareWork) || hasAny(text, repeatedTextWork) ? 4 : 2,
    interpersonalScore: hasAny(text, humanJudgment) ? 4 : 2,
    physicalityScore: hasAny(text, physicalWork) ? 5 : 1,
    ambiguityScore: hasAny(text, humanJudgment) ? 4 : 2
  };
}
