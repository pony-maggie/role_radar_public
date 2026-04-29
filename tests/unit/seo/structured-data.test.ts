import { describe, expect, it } from "vitest";
import {
  buildHomepageFaqSchema,
  buildRoleBreadcrumbSchema,
  buildRoleWebPageSchema
} from "@/lib/seo/structured-data";

describe("seo structured data", () => {
  it("returns a localized homepage FAQPage payload", () => {
    const schema = buildHomepageFaqSchema("zh");

    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.inLanguage).toBe("zh-CN");
    expect(schema.mainEntity).toHaveLength(3);
    expect(schema.mainEntity[0]?.name).toContain("AI");
  });

  it("returns a role-detail WebPage payload with localized fields", () => {
    const schema = buildRoleWebPageSchema({
      locale: "en",
      pathname: "/en/roles/customer-service-representative",
      roleName: "Customer Service Representative",
      description: "Customer Service Representative currently has a 68% AI replacement rate.",
      replacementRate: 68,
      timelineCount: 4
    });

    expect(schema["@type"]).toBe("WebPage");
    expect(schema.name).toContain("Customer Service Representative");
    expect(schema.description).toContain("68%");
    expect(schema.url).toContain("/en/roles/customer-service-representative");
    expect(schema.about).toMatchObject({
      "@type": "Occupation",
      name: "Customer Service Representative"
    });
  });

  it("returns a localized role-detail breadcrumb payload", () => {
    const schema = buildRoleBreadcrumbSchema({
      locale: "zh",
      pathname: "/zh/roles/customer-service-representative",
      roleName: "客户服务专员"
    });

    expect(schema["@type"]).toBe("BreadcrumbList");
    expect(schema.itemListElement).toHaveLength(3);
    expect(schema.itemListElement[2]?.name).toBe("客户服务专员");
  });
});
