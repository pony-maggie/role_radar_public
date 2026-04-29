import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  createRoleRiskSnapshot,
  listRoleRiskSnapshots
} from "@/lib/repositories/role-risk-snapshots";

const TEST_OLDER_SNAPSHOT_AT = new Date("2026-06-01T00:00:00.000Z");
const TEST_NEWER_SNAPSHOT_AT = new Date("2026-07-15T12:34:56.000Z");
const TEST_OLDER_REPLACEMENT_RATE = 61;
const TEST_NEWER_REPLACEMENT_RATE = 73;

describe("role risk snapshots", () => {
  afterEach(async () => {
    await prisma.roleRiskSnapshot.deleteMany({
      where: {
        OR: [
          {
            snapshotAt: TEST_OLDER_SNAPSHOT_AT,
            replacementRate: TEST_OLDER_REPLACEMENT_RATE,
            source: "test_full_refresh_snapshot_primary"
          },
          {
            snapshotAt: TEST_NEWER_SNAPSHOT_AT,
            replacementRate: TEST_NEWER_REPLACEMENT_RATE,
            source: "test_full_refresh_snapshot_primary"
          },
          {
            snapshotAt: TEST_NEWER_SNAPSHOT_AT,
            replacementRate: 49,
            source: "test_full_refresh_snapshot_secondary"
          },
          {
            source: "test_full_refresh_snapshot_repository"
          }
        ]
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("enforces one snapshot per role and timestamp", async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { slug: "customer-service-representative" }
    });

    await prisma.roleRiskSnapshot.create({
      data: {
        roleId: role.id,
        snapshotAt: TEST_NEWER_SNAPSHOT_AT,
        replacementRate: TEST_NEWER_REPLACEMENT_RATE,
        riskLevel: "HIGH",
        ratingStatus: "RATED",
        wasRecomputed: false,
        source: "test_full_refresh_snapshot_primary"
      }
    });

    await expect(
      prisma.roleRiskSnapshot.create({
        data: {
          roleId: role.id,
          snapshotAt: TEST_NEWER_SNAPSHOT_AT,
          replacementRate: 74,
          riskLevel: "HIGH",
          ratingStatus: "RATED",
          wasRecomputed: true,
          source: "test_full_refresh_snapshot_duplicate"
        }
      })
    ).rejects.toThrow();
  });

  it("creates and lists snapshots newest first for one role", async () => {
    const role = await prisma.role.findUniqueOrThrow({
      where: { slug: "customer-service-representative" }
    });
    const originalSnapshots = await prisma.roleRiskSnapshot.findMany({
      where: { roleId: role.id },
      orderBy: { snapshotAt: "asc" }
    });

    await prisma.roleRiskSnapshot.deleteMany({
      where: { roleId: role.id }
    });

    try {
      await createRoleRiskSnapshot({
        roleId: role.id,
        snapshotAt: new Date("2026-04-01T00:00:00.000Z"),
        replacementRate: 61,
        riskLevel: "HIGH",
        ratingStatus: "RATED",
        wasRecomputed: true,
        source: "full_refresh"
      });
      await createRoleRiskSnapshot({
        roleId: role.id,
        snapshotAt: new Date("2026-05-01T00:00:00.000Z"),
        replacementRate: 66,
        riskLevel: "HIGH",
        ratingStatus: "RATED",
        wasRecomputed: false,
        source: "full_refresh"
      });

      const snapshots = await listRoleRiskSnapshots("customer-service-representative");

      expect(snapshots.map((snapshot) => snapshot.replacementRate)).toEqual([66, 61]);
      expect(snapshots[0]?.wasRecomputed).toBe(false);
    } finally {
      await prisma.roleRiskSnapshot.deleteMany({
        where: { roleId: role.id }
      });

      for (const snapshot of originalSnapshots) {
        await prisma.roleRiskSnapshot.create({
          data: {
            roleId: snapshot.roleId,
            snapshotAt: snapshot.snapshotAt,
            replacementRate: snapshot.replacementRate,
            riskLevel: snapshot.riskLevel,
            ratingStatus: snapshot.ratingStatus,
            wasRecomputed: snapshot.wasRecomputed,
            source: snapshot.source
          }
        });
      }
    }
  });
});
