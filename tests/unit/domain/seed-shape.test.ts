import { describe, expect, it } from "vitest";
import { demoRoles } from "@/prisma/seed-data";

describe("demo role data", () => {
  it("includes bilingual names and a categorical risk level", () => {
    expect(demoRoles[0]).toMatchObject({
      id: "role_customer_service_representative",
      slug: "customer-service-representative",
      riskLevel: "HIGH",
      nameEn: "Customer Service Representative",
      nameZh: "客户服务专员",
      lastRatedAt: "2026-01-01T00:00:00.000Z"
    });
  });
});
