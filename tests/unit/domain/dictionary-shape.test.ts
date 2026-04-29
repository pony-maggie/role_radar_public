import { describe, expect, it } from "vitest";
import { demoRoles } from "@/prisma/seed-data";
import { loadRoleDictionarySource } from "@/lib/dictionaries/role-dictionary-source";

describe("role dictionary snapshot", () => {
  it("builds dictionary entries from the csv source", () => {
    const snapshot = loadRoleDictionarySource();

    expect(snapshot.industries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "all-roles",
          nameEn: "General role catalog",
          nameZh: "通用岗位目录"
        })
      ])
    );

    expect(snapshot.roles.length).toBeGreaterThan(700);
    expect(snapshot.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "actors",
          nameEn: "Actors",
          nameZh: "演员"
        }),
        expect.objectContaining({
          slug: "customer-service-representative",
          socCode: "43-4051",
          industryCode: "all-roles",
          nameZh: "客户服务专员"
        }),
        expect.objectContaining({
          slug: "management-analysts",
          nameEn: "Management Analysts",
          nameZh: "管理分析师"
        }),
        expect.objectContaining({
          slug: "project-management-specialists",
          nameEn: "Project Management Specialists",
          nameZh: "项目管理专员"
        }),
        expect.objectContaining({
          slug: "public-relations-specialists",
          nameEn: "Public Relations Specialists",
          nameZh: "公共关系专员"
        }),
        expect.objectContaining({
          slug: "technical-writers",
          nameEn: "Technical Writers",
          nameZh: "技术写作专员"
        })
      ])
    );
  });

  it("covers every seeded demo role with a stable dictionary slug", () => {
    const snapshot = loadRoleDictionarySource();
    const dictionarySlugs = new Set(snapshot.roles.map((role) => role.slug));

    expect(demoRoles.every((role) => dictionarySlugs.has(role.dictionaryRoleSlug))).toBe(true);
  });
});
