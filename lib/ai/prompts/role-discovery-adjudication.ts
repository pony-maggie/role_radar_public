export function buildRoleDiscoveryAdjudicationPrompt({
  role,
  candidate
}: {
  role: {
    slug: string;
    nameEn: string;
    nameZh: string;
    aliases: string[];
    tasks: string[];
  };
  candidate: {
    url: string;
    title: string;
    snippet: string;
    publishedAt?: string | null;
  };
}) {
  return [
    "Review one search hit for Role Radar.",
    "Decide whether this hit should be attached to the target role timeline.",
    "Accept only when the hit describes concrete AI, automation, agent, copilot, workflow, task, or job-process impact for the target role or a very close adjacent workflow.",
    "Reject funding news, events, awards, generic ecosystem chatter, broad model launches, and company news without role workflow impact.",
    "A nearby workflow match is acceptable for timeline attachment, but it still must mention concrete work, tasks, or process changes.",
    "",
    `Role slug: ${role.slug}`,
    `Role EN: ${role.nameEn}`,
    `Role ZH: ${role.nameZh}`,
    `Role aliases: ${role.aliases.join(", ") || "none"}`,
    `Role tasks: ${role.tasks.join(", ") || "none"}`,
    "",
    `Candidate URL: ${candidate.url}`,
    `Candidate publishedAt: ${candidate.publishedAt ?? "unknown"}`,
    `Candidate title: ${candidate.title}`,
    `Candidate snippet: ${candidate.snippet}`
  ].join("\n");
}
