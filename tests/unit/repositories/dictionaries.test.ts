import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { importRoleDictionary } from "@/prisma/import-role-dictionary";
import { demoRoles } from "@/prisma/seed-data";

describe("dictionary seed state", () => {
  beforeAll(async () => {
    await importRoleDictionary(prisma);

    for (const role of demoRoles) {
      const dictionaryRole = await prisma.roleDictionary.findUniqueOrThrow({
        where: { slug: role.dictionaryRoleSlug },
        select: { id: true }
      });

      await prisma.role.upsert({
        where: { slug: role.slug },
        create: {
          id: role.id,
          dictionaryRoleId: dictionaryRole.id,
          slug: role.slug,
          socCode: role.socCode,
          nameEn: role.nameEn,
          nameZh: role.nameZh,
          summaryEn: role.summaryEn,
          summaryZh: role.summaryZh,
          riskLevel: role.riskLevel,
          ratingStatus: role.ratingStatus,
          lastRatedAt: new Date(role.lastRatedAt),
          repetitionScore: role.repetitionScore,
          ruleClarityScore: role.ruleClarityScore,
          transformationScore: role.transformationScore,
          workflowAutomationScore: role.workflowAutomationScore,
          interpersonalScore: role.interpersonalScore,
          physicalityScore: role.physicalityScore,
          ambiguityScore: role.ambiguityScore
        },
        update: {
          dictionaryRoleId: dictionaryRole.id
        }
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds dictionary industries and roles from the static snapshot", async () => {
    const industry = await prisma.industryDictionary.findUnique({
      where: { code: "all-roles" }
    });
    const roleDictionary = await prisma.roleDictionary.findUnique({
      where: { slug: "customer-service-representative" }
    });

    expect(industry).toMatchObject({
      code: "all-roles",
      nameEn: "General role catalog"
    });
    expect(roleDictionary).toMatchObject({
      slug: "customer-service-representative",
      socCode: "43-4051",
      industryCode: "all-roles"
    });
  });

  it("links seeded scored roles back to the dictionary table", async () => {
    const role = await prisma.role.findUnique({
      where: { slug: "customer-service-representative" },
      include: {
        dictionaryRole: true
      }
    });

    expect(role?.dictionaryRole).toMatchObject({
      slug: "customer-service-representative",
      socCode: "43-4051"
    });
  });

  it("syncs existing materialized role names from updated dictionary translations", async () => {
    const dictionaryRole = await prisma.roleDictionary.findUniqueOrThrow({
      where: { slug: "actors" },
      select: { id: true }
    });

    await prisma.role.upsert({
      where: { slug: "actors" },
      create: {
        id: "test-role-actors-sync",
        dictionaryRoleId: dictionaryRole.id,
        slug: "actors",
        socCode: null,
        nameEn: "Actors",
        nameZh: "Actors",
        summaryEn: "test",
        summaryZh: "test",
        riskLevel: "MEDIUM",
        ratingStatus: "RATED",
        lastRatedAt: new Date(),
        repetitionScore: 50,
        ruleClarityScore: 50,
        transformationScore: 50,
        workflowAutomationScore: 50,
        interpersonalScore: 50,
        physicalityScore: 50,
        ambiguityScore: 50
      },
      update: {
        nameZh: "Actors"
      }
    });

    await importRoleDictionary(prisma);

    const role = await prisma.role.findUniqueOrThrow({
      where: { slug: "actors" },
      select: {
        nameEn: true,
        nameZh: true
      }
    });

    expect(role).toEqual({
      nameEn: "Actors",
      nameZh: "演员"
    });
  });

  it("imports newly added zh translations for office support roles", async () => {
    await importRoleDictionary(prisma);

    const officeSupportRole = await prisma.roleDictionary.findUniqueOrThrow({
      where: { slug: "office-and-administrative-support-workers-all-other" },
      select: {
        nameEn: true,
        nameZh: true
      }
    });
    const mediaProgrammingRole = await prisma.roleDictionary.findUniqueOrThrow({
      where: { slug: "media-programming-directors" },
      select: {
        nameEn: true,
        nameZh: true
      }
    });

    expect(officeSupportRole).toEqual({
      nameEn: "Office and Administrative Support Workers, All Other",
      nameZh: "其他办公室与行政支持人员"
    });
    expect(mediaProgrammingRole).toEqual({
      nameEn: "Media Programming Directors",
      nameZh: "媒体节目总监"
    });
  });
});
