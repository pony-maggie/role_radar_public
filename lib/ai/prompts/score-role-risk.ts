type RoleContext = {
  nameEn: string;
  nameZh: string;
  summaryEn: string;
  summaryZh: string;
  keywords?: string[];
  repetitionScore: number;
  ruleClarityScore: number;
  transformationScore: number;
  workflowAutomationScore: number;
  interpersonalScore: number;
  physicalityScore: number;
  ambiguityScore: number;
};

type ClassifiedSourceContext = {
  title: string;
  sourceType: string;
  signalType: string;
  publishedAt: string;
  summaryEn: string;
  inferenceSummaryEn: string;
  impactDirection: string;
  relevance: string;
  signalWeight: number;
};

export function buildRoleRiskPrompt({
  role,
  items
}: {
  role: RoleContext;
  items: ClassifiedSourceContext[];
}) {
  const itemLines = items.length
    ? items
        .map(
          (item, index) =>
            `${index + 1}. [${item.publishedAt}] ${item.sourceType} | signal=${item.signalType} | relevance=${item.relevance} | weight=${item.signalWeight} | impact=${item.impactDirection}\nTitle: ${item.title}\nSummary: ${item.summaryEn}\nInference: ${item.inferenceSummaryEn}`
        )
        .join("\n\n")
    : "No recent classified source items were available.";

  return [
    "You are estimating today's AI replacement rate for one job role.",
    "Return a bounded replacementRate between 0 and 100, a riskBand, a short bilingual-ready summary, and 2-5 structured reasons.",
    "Use the role description and role traits as the anchor, then adjust today's percentage using the recent attached source items.",
    "Start from the role itself even if evidence is sparse. The model should still produce a defensible percentage from the role profile alone.",
    "Think in two layers: (1) structural replaceability from the role profile, (2) evidence adjustment from recent sources.",
    "Structural replaceability rises with repetition, rule clarity, transformation, and workflow automation. Structural replaceability falls with interpersonal intensity, physicality, and ambiguity.",
    "Interpret evidence through source classes and signal types. Strongest signals are capability_update, adoption_case, workflow_restructure, and hiring_shift. Ecosystem_context is weakest.",
    "Weight evidence in this order: official/company workflow or product updates > high-quality AI media reporting > jobs postings.",
    "Official sources can move the score meaningfully when they expand realistic automation scope. Media should mostly confirm or illustrate adoption. Jobs postings are supporting evidence only.",
    "Broad company news, partnerships, funding, benchmark chatter, infra news, or ecosystem context should not spike the score on their own.",
    "One weak media item or one hiring signal should not overwhelm the role-profile baseline.",
    "If evidence is thin or mixed, keep the percentage closer to the role-profile baseline instead of swinging wildly.",
    "It is acceptable for the percentage to change day to day as new items arrive, but the result should still feel defensible to a human reader and should not overreact to one weak source.",
    "",
    `Role EN: ${role.nameEn}`,
    `Role ZH: ${role.nameZh}`,
    `Role summary EN: ${role.summaryEn}`,
    `Role summary ZH: ${role.summaryZh}`,
    `Role keywords: ${(role.keywords ?? []).join(", ") || "none"}`,
    `Role traits: repetition=${role.repetitionScore}, rule_clarity=${role.ruleClarityScore}, transformation=${role.transformationScore}, workflow_automation=${role.workflowAutomationScore}, interpersonal=${role.interpersonalScore}, physicality=${role.physicalityScore}, ambiguity=${role.ambiguityScore}`,
    `Recent item count: ${items.length}`,
    "",
    "Recent classified items:",
    itemLines
  ].join("\n");
}
