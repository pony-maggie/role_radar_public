import { createHash } from "node:crypto";

type RoleDiscoveryQueryHashInput = {
  roleSlug: string;
  provider: string;
  queryText: string;
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function buildRoleDiscoveryQueryHash(input: RoleDiscoveryQueryHashInput) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        roleSlug: input.roleSlug,
        provider: input.provider,
        queryText: normalizeText(input.queryText)
      })
    )
    .digest("hex");
}
