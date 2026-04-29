import { prisma } from "@/lib/db/prisma";

export async function listRecentSignals(limit = 6) {
  return prisma.signal.findMany({
    include: { role: true },
    orderBy: { publishedAt: "desc" },
    take: limit
  });
}
