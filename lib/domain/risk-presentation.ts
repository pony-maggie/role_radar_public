import type { RatingStatus, RiskLevel } from "@prisma/client";

const ratedPresentation = {
  LOW: {
    percentage: 18,
    summaryEn: "Most of the work still depends on physical execution, ambiguity, or human handoffs.",
    summaryZh: "这个岗位的大部分工作仍受物理执行、情境判断或人工交接保护。"
  },
  MEDIUM: {
    percentage: 43,
    summaryEn: "Structured recurring tasks are increasingly compressible, but the whole role is not yet AI-first.",
    summaryZh: "结构化的重复任务正在被压缩，但整个岗位还没有进入 AI 优先阶段。"
  },
  HIGH: {
    percentage: 68,
    summaryEn: "Core workflows are already being re-routed through AI systems in production settings.",
    summaryZh: "核心工作流已经在真实业务中被重新导向到 AI 系统。"
  },
  SEVERE: {
    percentage: 86,
    summaryEn: "A large share of the role can now be absorbed by AI-led workflows with minimal human lift.",
    summaryZh: "这个岗位中相当大一部分工作已经可以被 AI 主导流程吸收，只需极少人工介入。"
  }
} satisfies Record<
  RiskLevel,
  {
    percentage: number;
    summaryEn: string;
    summaryZh: string;
  }
>;

type PresentRiskInput = {
  riskLevel: RiskLevel;
  ratingStatus: RatingStatus;
  locale?: "en" | "zh";
};

export function presentRisk({ riskLevel, ratingStatus, locale = "en" }: PresentRiskInput) {
  if (ratingStatus === "INSUFFICIENT_SIGNAL") {
    return {
      percentage: null,
      label: locale === "zh" ? "信号待补" : "Signal pending",
      summary:
        locale === "zh"
          ? "当前确认信号还不足以给出可信的 AI 替代率，页面只展示已知动态。"
          : "Confirmed signal volume is still too thin for a reliable AI replacement rate, so the page only shows known movement.",
      className: "risk-insufficient"
    };
  }

  const presentation = ratedPresentation[riskLevel];

  return {
    percentage: presentation.percentage,
    label: `${presentation.percentage}%`,
    summary: locale === "zh" ? presentation.summaryZh : presentation.summaryEn,
    className: `risk-${riskLevel.toLowerCase()}`
  };
}
