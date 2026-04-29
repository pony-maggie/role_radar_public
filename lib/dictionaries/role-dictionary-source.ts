import fs from "node:fs";
import path from "node:path";
import { roleTranslationOverrides } from "./role-translation-overrides";

type IndustryDictionaryEntry = {
  code: string;
  nameEn: string;
  nameZh: string;
  level: number;
  sortOrder: number;
  parentCode?: string | null;
};

type RoleDictionaryEntry = {
  sourceCode: string;
  socCode: string | null;
  slug: string;
  nameEn: string;
  nameZh: string;
  industryCode: string;
  keywords: string[];
};

type RoleDictionarySource = {
  source: string;
  industries: IndustryDictionaryEntry[];
  roles: RoleDictionaryEntry[];
};

const csvPath = path.resolve(process.cwd(), "data/dictionaries/role_categories.csv");

const genericIndustry: IndustryDictionaryEntry = {
  code: "all-roles",
  nameEn: "General role catalog",
  nameZh: "通用岗位目录",
  level: 1,
  sortOrder: 1,
  parentCode: null
};

const overrides: Record<
  string,
  {
    slug: string;
    socCode?: string;
    keywords?: string[];
  }
> = {
  Actors: {
    slug: "actors"
  },
  Actuaries: {
    slug: "actuaries"
  },
  Acupuncturists: {
    slug: "acupuncturists"
  },
  "Adapted Physical Education Specialists": {
    slug: "adapted-physical-education-specialists"
  },
  "Adhesive Bonding Machine Operators and Tenders": {
    slug: "adhesive-bonding-machine-operators-and-tenders"
  },
  "Customer Service Representatives": {
    slug: "customer-service-representative",
    socCode: "43-4051",
    keywords: ["customer support", "support agent", "help desk", "call center", "ticket triage"]
  },
  "Executive Secretaries and Executive Administrative Assistants": {
    slug: "executive-secretary-and-administrative-assistant",
    socCode: "43-6011"
  },
  "Legal Secretaries and Administrative Assistants": {
    slug: "legal-secretary-and-administrative-assistant",
    socCode: "43-6012"
  },
  "Market Research Analysts and Marketing Specialists": {
    slug: "market-research-analyst",
    socCode: "13-1161",
    keywords: ["market research", "consumer insights", "survey analysis", "reporting"]
  }
};

const preservedRoleEntries: RoleDictionaryEntry[] = [
  {
    sourceCode: "43-3031",
    socCode: "43-3031",
    slug: "bookkeeping-clerk",
    nameEn: "Bookkeeping Clerk",
    nameZh: "记账员",
    industryCode: genericIndustry.code,
    keywords: ["bookkeeping", "reconciliation", "ledger", "accounts payable", "invoice"]
  },
  {
    sourceCode: "49-9041",
    socCode: "49-9041",
    slug: "industrial-maintenance-technician",
    nameEn: "Industrial Maintenance Technician",
    nameZh: "工业维护技师",
    industryCode: genericIndustry.code,
    keywords: ["maintenance technician", "equipment repair", "preventive maintenance", "field service"]
  }
];

function parseSingleColumnCsv(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(1)
    .map((line) => {
      if (line.startsWith('"') && line.endsWith('"')) {
        return line.slice(1, -1).replace(/""/g, '"');
      }

      return line;
    });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildKeywords(nameEn: string) {
  const base = nameEn
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);

  return [...new Set(base)].slice(0, 8);
}

export function loadRoleDictionarySource(): RoleDictionarySource {
  const rows = parseSingleColumnCsv(fs.readFileSync(csvPath, "utf8"));

  const roles = rows.map((nameEn, index) => {
    const override = overrides[nameEn];
    const slug = override?.slug ?? slugify(nameEn);

    return {
      sourceCode: override?.socCode ?? `csv-role-${index + 1}`,
      socCode: override?.socCode ?? null,
      slug,
      nameEn,
      nameZh: roleTranslationOverrides[nameEn] ?? nameEn,
      industryCode: genericIndustry.code,
      keywords: override?.keywords ?? buildKeywords(nameEn)
    };
  });

  for (const role of preservedRoleEntries) {
    if (!roles.some((entry) => entry.slug === role.slug)) {
      roles.push(role);
    }
  }

  return {
    source: "role_categories_csv_2026_04_12",
    industries: [genericIndustry],
    roles
  };
}
