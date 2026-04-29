import { describe, expect, it } from "vitest";
import { buildRoleDiscoveryQueries } from "@/lib/role-discovery/query-builder";

describe("buildRoleDiscoveryQueries", () => {
  it("builds bilingual role discovery queries from role names, aliases, and tasks", () => {
    const queries = buildRoleDiscoveryQueries({
      slug: "customer-service-representative",
      nameEn: "Customer Service Representative",
      nameZh: "客户服务代表",
      aliases: ["customer support", "客服"],
      tasks: ["ticket triage", "customer response"]
    });

    expect(queries).toContain("Customer Service Representative");
    expect(queries).toContain("客户服务代表");
    expect(queries).toContain("Customer Service Representative AI automation");
    expect(queries).toContain("customer support AI");
    expect(queries).toContain("ticket triage AI");
  });

  it("dedupes repeated inputs and caps the result size", () => {
    const queries = buildRoleDiscoveryQueries({
      slug: "actors",
      nameEn: "Actors",
      nameZh: "Actors",
      aliases: ["Actors", "actors", "performer", "performer"],
      tasks: ["script review", "script review", "audition prep", "voice performance"]
    });

    expect(new Set(queries).size).toBe(queries.length);
    expect(queries.length).toBeLessThanOrEqual(8);
  });
});
