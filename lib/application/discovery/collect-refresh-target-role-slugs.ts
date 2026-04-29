export type DiscoveryResultWithRefreshTargets = {
  affectedRoleSlugs?: string[];
  affectedRoles?: Array<
    | string
    | {
        roleSlug?: string | null;
        slug?: string | null;
      }
  >;
  scoreEligibleSignals?: Array<
    | string
    | {
        roleSlug?: string | null;
        assignedRoleSlug?: string | null;
      }
  >;
};

export function collectRefreshTargetRoleSlugs(result: DiscoveryResultWithRefreshTargets) {
  const roleSlugs = new Set<string>();

  const addRoleSlug = (value: string | null | undefined) => {
    if (typeof value === "string" && value.trim().length > 0) {
      roleSlugs.add(value.trim());
    }
  };

  const addFirstNonEmptyRoleSlug = (...values: Array<string | null | undefined>) => {
    for (const value of values) {
      const trimmed = typeof value === "string" ? value.trim() : "";
      if (trimmed.length > 0) {
        roleSlugs.add(trimmed);
        return;
      }
    }
  };

  for (const roleSlug of result.affectedRoleSlugs ?? []) {
    addRoleSlug(roleSlug);
  }

  for (const affectedRole of result.affectedRoles ?? []) {
    if (typeof affectedRole === "string") {
      addRoleSlug(affectedRole);
      continue;
    }

    addFirstNonEmptyRoleSlug(affectedRole.roleSlug, affectedRole.slug);
  }

  for (const signal of result.scoreEligibleSignals ?? []) {
    if (typeof signal === "string") {
      addRoleSlug(signal);
      continue;
    }

    addFirstNonEmptyRoleSlug(signal.roleSlug, signal.assignedRoleSlug);
  }

  return [...roleSlugs];
}
