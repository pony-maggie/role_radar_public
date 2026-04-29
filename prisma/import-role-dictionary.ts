import type { PrismaClient } from "@prisma/client";
import { loadRoleDictionarySource } from "@/lib/dictionaries/role-dictionary-source";

export async function importRoleDictionary(prisma: PrismaClient) {
  const snapshot = loadRoleDictionarySource();

  for (const industry of snapshot.industries) {
    await prisma.industryDictionary.upsert({
      where: { code: industry.code },
      create: {
        source: snapshot.source,
        code: industry.code,
        nameEn: industry.nameEn,
        nameZh: industry.nameZh,
        level: industry.level,
        parentCode: industry.parentCode ?? null,
        sortOrder: industry.sortOrder
      },
      update: {
        source: snapshot.source,
        nameEn: industry.nameEn,
        nameZh: industry.nameZh,
        level: industry.level,
        parentCode: industry.parentCode ?? null,
        sortOrder: industry.sortOrder
      }
    });
  }

  await prisma.roleDictionary.updateMany({
    data: {
      isActive: false
    }
  });

  for (const role of snapshot.roles) {
    const dictionaryRole = await prisma.roleDictionary.upsert({
      where: { slug: role.slug },
      create: {
        source: snapshot.source,
        sourceCode: role.sourceCode,
        socCode: role.socCode ?? null,
        slug: role.slug,
        nameEn: role.nameEn,
        nameZh: role.nameZh,
        industryCode: role.industryCode,
        keywords: role.keywords,
        isActive: true
      },
      update: {
        source: snapshot.source,
        sourceCode: role.sourceCode,
        socCode: role.socCode ?? null,
        nameEn: role.nameEn,
        nameZh: role.nameZh,
        industryCode: role.industryCode,
        keywords: role.keywords,
        isActive: true
      }
    });

    await prisma.role.updateMany({
      where: {
        dictionaryRoleId: dictionaryRole.id
      },
      data: {
        nameEn: dictionaryRole.nameEn,
        nameZh: dictionaryRole.nameZh
      }
    });
  }

  return {
    industries: snapshot.industries.length,
    roles: snapshot.roles.length,
    source: snapshot.source
  };
}
