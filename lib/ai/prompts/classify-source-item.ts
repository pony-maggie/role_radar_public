type PromptRoleContext = {
  slug: string;
  nameEn: string;
  nameZh: string;
  keywords: string[];
  matchedKeywords?: string[];
  score?: number;
};

type PromptSourceItem = {
  sourceLabel: string;
  sourceType: string;
  title: string;
  summary: string;
  topicHints?: string[];
};

export function buildSourceItemClassificationPrompt({
  sourceItem,
  roles
}: {
  sourceItem: PromptSourceItem;
  roles: PromptRoleContext[];
}) {
  const roleLines = roles
    .map(
      (role) =>
        `- slug: ${role.slug} | en: ${role.nameEn} | zh: ${role.nameZh} | score: ${role.score ?? 0} | matched: ${
          role.matchedKeywords?.join(", ") || "none"
        } | keywords: ${role.keywords.join(", ")}`
    )
    .join("\n");

  return [
    "Classify this source item into exactly one best-fit role from the provided candidate list.",
    "Balanced attribution: if the item is broad AI/company news, policy news, funding news, benchmark chatter, infra news, or otherwise does not meaningfully change the workflow of one occupation, return assignedRoleSlug as null.",
    "Adjacent-workflow media items may attach to a nearby alias-backed role when the article describes a concrete task cluster, but broad ecosystem or funding coverage should stay unmatched.",
    "Timeline attachment can be broader than scoring: if the item clearly describes a neighboring workflow cluster, attach it to the closest reasonable role even when the role is only adjacent and not a perfect domain match.",
    "Do not force a match just because the company is in AI or because the article mentions users, teams, productivity, developers, enterprises, or operations in general.",
    "Treat this as an occupational workflow test: the winning role must be the job whose day-to-day tasks are most directly affected by the source item.",
    "Attach the item to the closest reasonable role when the content describes the exact role, a similar role, or an adjacent workflow or task cluster that a user would reasonably expect on the role timeline.",
    "Think in product signal types: capability_update, adoption_case, workflow_restructure, hiring_shift, and ecosystem_context.",
    "Only the first four can justify a role attachment. Ecosystem context should usually remain unmatched.",
    "Always return signalType. Use ecosystem_context for broad AI/company chatter that should stay unmatched.",
    "For COMPANY_UPDATE or BLOG items, attach when the source describes a capability_update, adoption_case, or workflow_restructure that reasonably affects work done by a specific occupation.",
    "For NEWS items, attach when the reporting points to an adoption_case or workflow_restructure for a specific role or a narrow role family. If the article mentions tools, tasks, or workflows used by a similar or adjacent role from the candidate list, a broad but playful attachment is acceptable.",
    "For JOB_POSTING items, treat the posting as a hiring_shift signal and map it when the title and summary reasonably describe one occupation from the candidate list. Otherwise return null.",
    "Source classes matter: official > media > jobs for trust. Jobs are auxiliary, but official and jobs sources may use the best reasonable occupation match when the workflow impact is concrete.",
    "Use matched keywords and candidate scores as hints, not proof. Choose the best reasonable occupation match when the workflow impact is concrete; do not require a perfect or overwhelming margin over every other candidate.",
    "Only use the provided candidate list. If none fit reasonably, return assignedRoleSlug as null.",
    "Prefer unmatched for funding news, model launches, or broad ecosystem commentary unless the article spells out a concrete workflow or task overlap for one role.",
    "When in doubt between a concrete role signal and broad ecosystem chatter, prefer the best reasonable occupation match if the source mentions similar work, adjacent workflows, or role-like task descriptions. Keep only clearly weak or speculative assignments unmatched.",
    "",
    `Source label: ${sourceItem.sourceLabel}`,
    `Source type: ${sourceItem.sourceType}`,
    `Title: ${sourceItem.title}`,
    `Summary: ${sourceItem.summary}`,
    `Source topic hints: ${(sourceItem.topicHints ?? []).join(", ") || "none"}`,
    "",
    "Candidate roles:",
    roleLines
  ].join("\n");
}
