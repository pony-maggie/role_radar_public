import { prisma } from "@/lib/db/prisma";

async function ensureDecisionExists(decisionId: string) {
  const decision = await prisma.sourceItemRoleDecision.findUnique({
    where: { id: decisionId },
    select: {
      id: true,
      roleId: true,
      decisionStatus: true
    }
  });

  if (!decision) {
    throw new Error(`Unknown review decision: ${decisionId}`);
  }

  return decision;
}

export async function approveReviewDecision(decisionId: string) {
  const decision = await ensureDecisionExists(decisionId);
  if (!decision.roleId || decision.decisionStatus !== "ACCEPTED") {
    throw new Error(`Decision ${decisionId} is not reviewable yet`);
  }

  return prisma.sourceItemRoleDecision.update({
    where: { id: decisionId },
    data: {
      reviewStatus: "APPROVED",
      reviewedAt: new Date()
    }
  });
}

export async function rejectReviewDecision(decisionId: string) {
  await ensureDecisionExists(decisionId);

  return prisma.sourceItemRoleDecision.update({
    where: { id: decisionId },
    data: {
      reviewStatus: "REJECTED",
      reviewedAt: new Date()
    }
  });
}
