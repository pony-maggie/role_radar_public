import { prisma } from "@/lib/db/prisma";
import type { RatingStatus, RiskLevel } from "@prisma/client";

type CreateRoleRiskSnapshotInput = {
  roleId: string;
  snapshotAt: Date;
  replacementRate: number | null;
  riskLevel: RiskLevel;
  ratingStatus: RatingStatus;
  wasRecomputed: boolean;
  source: string;
};

export async function createRoleRiskSnapshot(input: CreateRoleRiskSnapshotInput) {
  return prisma.roleRiskSnapshot.create({
    data: input
  });
}

export async function listRoleRiskSnapshots(roleSlug: string) {
  return prisma.roleRiskSnapshot.findMany({
    where: {
      role: {
        slug: roleSlug
      }
    },
    orderBy: {
      snapshotAt: "desc"
    }
  });
}
