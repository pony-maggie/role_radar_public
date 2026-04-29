type RoleDiscoveryInput = {
  slug: string;
  nameEn: string;
  nameZh: string;
  aliases: string[];
  tasks: string[];
};

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function dedupeQueries(values: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const normalized = normalizeQuery(value);
    if (!normalized) continue;

    const compareKey = normalized.toLowerCase();
    if (seen.has(compareKey)) continue;
    seen.add(compareKey);
    deduped.push(normalized);
  }

  return deduped;
}

export function buildRoleDiscoveryQueries(input: RoleDiscoveryInput) {
  return dedupeQueries([
    input.nameEn,
    input.nameZh,
    `${input.nameEn} AI automation`,
    `${input.nameEn} copilot agent`,
    ...input.aliases.map((alias) => `${alias} AI`),
    ...input.tasks.map((task) => `${task} AI`)
  ]).slice(0, 8);
}
