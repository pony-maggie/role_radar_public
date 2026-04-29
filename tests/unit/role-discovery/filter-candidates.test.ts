import { describe, expect, it } from "vitest";
import { filterRoleDiscoveryCandidates } from "@/lib/role-discovery/filter-candidates";

const context = {
  roleSlug: "customer-service-representative",
  roleNameEn: "Customer Service Representative",
  roleNameZh: "客户服务专员",
  aliases: ["customer support", "support ops", "客服"],
  tasks: ["ticket triage", "case resolution"]
};

describe("filterRoleDiscoveryCandidates", () => {
  it("keeps concrete workflow evidence for the target role", () => {
    const result = filterRoleDiscoveryCandidates([
      {
        url: "https://example.com/support-ai",
        title: "AI agent automates customer support ticket triage",
        snippet: "Customer support workflow now routes repetitive cases through AI.",
        publishedAt: "2026-04-19T00:00:00.000Z"
      }
    ], context);

    expect(result).toEqual([
      expect.objectContaining({
        url: "https://example.com/support-ai"
      })
    ]);
  });

  it("rejects generic funding noise even when the query likely matched AI", () => {
    const result = filterRoleDiscoveryCandidates([
      {
        url: "https://example.com/funding",
        title: "AI startup raises Series B funding",
        snippet: "Investors back a new foundation model company at a higher valuation.",
        publishedAt: "2026-04-19T00:00:00.000Z"
      }
    ], context);

    expect(result).toEqual([]);
  });

  it("keeps landing pages out of timeline-style candidates", () => {
    const result = filterRoleDiscoveryCandidates([
      {
        url: "https://smartclerk.ai/",
        title: "Smart Clerk - AI-Powered Bookkeeping & Accounting Automation for Small Businesses",
        snippet: "AI bookkeeping software for SMBs.",
        publishedAt: null
      },
      {
        url: "https://booke.ai/en-us",
        title: "The AI Bookkeeper That Logs Into Your QBO & Xero — Like a Team Member | Booke AI | Booke AI",
        snippet: "AI bookkeeping software.",
        publishedAt: null
      },
      {
        url: "https://www.cpapracticeadvisor.com/2025/07/29/smart-clerk-releases-ai-bookkeeping-tool-for-smbs/165830/",
        title: "Smart Clerk Releases AI Bookkeeping Tool for SMBs - CPA Practice Advisor",
        snippet: "A concrete article about AI bookkeeping rollout.",
        publishedAt: "2025-07-28T16:00:00.000Z"
      }
    ], {
      roleSlug: "bookkeeping-clerk",
      roleNameEn: "Bookkeeping Clerk",
      roleNameZh: "记账员",
      aliases: ["ai bookkeeper", "bookkeeping"],
      tasks: ["reconciliation", "invoice handling"]
    });

    expect(result.map((item) => item.url)).toEqual([
      "https://www.cpapracticeadvisor.com/2025/07/29/smart-clerk-releases-ai-bookkeeping-tool-for-smbs/165830/"
    ]);
  });

  it("keeps undated evergreen explainer pages out of the timeline", () => {
    const result = filterRoleDiscoveryCandidates([
      {
        url: "https://willrobotstakemyjob.com/paralegals-and-legal-assistants",
        title: "Will Paralegals and Legal Assistants be replaced by AI & Robots?",
        snippet: "A broad explainer page about long-term automation pressure.",
        publishedAt: null
      },
      {
        url: "https://www.mycase.com/blog/ai/will-ai-replace-paralegals/",
        title: "Will AI Replace Paralegals and Legal Assistants? | MyCase",
        snippet: "A dated article about how legal-assistant workflows may shift.",
        publishedAt: "2024-04-29T16:00:00.000Z"
      }
    ], {
      roleSlug: "paralegals-and-legal-assistants",
      roleNameEn: "Paralegals and Legal Assistants",
      roleNameZh: "律师助理",
      aliases: ["paralegals", "legal assistants"],
      tasks: ["document review", "legal research"]
    });

    expect(result.map((item) => item.url)).toEqual([
      "https://www.mycase.com/blog/ai/will-ai-replace-paralegals/"
    ]);
  });

  it("keeps undated occupation reference pages out of the timeline", () => {
    const result = filterRoleDiscoveryCandidates([
      {
        url: "https://www.bls.gov/ooh/computer-and-information-technology/computer-systems-analysts.htm",
        title: "Computer Systems Analysts : Occupational Outlook Handbook: : U.S. Bureau of Labor Statistics",
        snippet: "Reference page for the occupation.",
        publishedAt: null
      },
      {
        url: "https://theresanaiforthat.com/job/computer-systems-analyst/",
        title: "Top AI Tools For Computer Systems Analysts - 549 Tasks Automated by AI",
        snippet: "Tool index and automation coverage page for the role.",
        publishedAt: null
      },
      {
        url: "https://www.onetonline.org/link/summary/51-9191.00",
        title: "51-9191.00 - Adhesive Bonding Machine Operators and Tenders",
        snippet: "O*NET occupation summary page.",
        publishedAt: null
      },
      {
        url: "https://www.careeronestop.org/Toolkit/Careers/Occupations/occupation-profile.aspx?keyword=Adhesive+Bonding+Machine+Operators+and+Tenders",
        title: "Occupation Profile for Adhesive Bonding Machine Operators and Tenders | CareerOneStop",
        snippet: "Career profile page for the occupation.",
        publishedAt: null
      },
      {
        url: "https://example.com/2026/ai-rollout-systems-analysis",
        title: "Enterprises use AI copilots to compress systems-analysis workflow",
        snippet: "Computer systems analysts are seeing requirements and process-mapping work shift.",
        publishedAt: "2026-04-18T00:00:00.000Z"
      }
    ], {
      roleSlug: "computer-systems-analysts",
      roleNameEn: "Computer Systems Analysts",
      roleNameZh: "计算机系统分析师",
      aliases: ["systems analyst"],
      tasks: ["requirements analysis", "process mapping"]
    });

    expect(result.map((item) => item.url)).toEqual([
      "https://example.com/2026/ai-rollout-systems-analysis"
    ]);
  });

  it("keeps undated labor-market profile pages out of the timeline for sparse occupations", () => {
    const result = filterRoleDiscoveryCandidates([
      {
        url: "https://www.onetonline.org/link/summary/51-9191.00",
        title: "51-9191.00 - Adhesive Bonding Machine Operators and Tenders",
        snippet: "AI automation summary for the occupation.",
        publishedAt: null
      },
      {
        url: "https://www.bls.gov/oes/2023/may/oes519191.htm",
        title: "Adhesive Bonding Machine Operators and Tenders",
        snippet: "AI labor-market profile page for the occupation.",
        publishedAt: null
      },
      {
        url: "https://www.careeronestop.org/Toolkit/Careers/Occupations/occupation-profile.aspx?keyword=Adhesive+Bonding+Machine+Operators+and+Tenders",
        title: "Occupation Profile for Adhesive Bonding Machine Operators and Tenders | CareerOneStop",
        snippet: "AI career profile page for the occupation.",
        publishedAt: null
      },
      {
        url: "https://example.com/2026/factory-automation-adhesive-bonding",
        title: "AI shifts adhesive bonding machine operator workflows on factory lines",
        snippet: "Adhesive bonding machine operators are seeing inspection and setup work partially automated.",
        publishedAt: "2026-04-18T00:00:00.000Z"
      }
    ], {
      roleSlug: "adhesive-bonding-machine-operators-and-tenders",
      roleNameEn: "Adhesive Bonding Machine Operators and Tenders",
      roleNameZh: "粘合机操作员",
      aliases: ["bonding machine operators"],
      tasks: ["inspection", "machine setup"]
    });

    expect(result.map((item) => item.url)).toEqual([
      "https://example.com/2026/factory-automation-adhesive-bonding"
    ]);
  });

  it("keeps undated vendor vertical landing pages out of the timeline", () => {
    const result = filterRoleDiscoveryCandidates([
      {
        url: "https://docsbot.ai/industry/acupuncturist-health-services",
        title: "AI Chatbots for Acupuncturists - DocsBot AI",
        snippet: "Automated messaging and chatbot workflows for acupuncture practices.",
        publishedAt: null
      },
      {
        url: "https://leadsorbit.ai/industries/acupuncture-software",
        title: "Capture, Convert, and Retain Patients with AI-Powered Acupuncture Software",
        snippet: "Software for acupuncture clinics and patient acquisition.",
        publishedAt: null
      },
      {
        url: "https://example.com/2026/acupuncture-clinic-ai-rollout",
        title: "AI scheduling tools spread across acupuncture clinics",
        snippet: "Acupuncturists are seeing appointment and reminder workflows automated.",
        publishedAt: "2026-04-18T00:00:00.000Z"
      }
    ], {
      roleSlug: "acupuncturists",
      roleNameEn: "Acupuncturists",
      roleNameZh: "针灸师",
      aliases: ["acupuncture practitioners"],
      tasks: ["appointment scheduling", "patient follow-up"]
    });

    expect(result.map((item) => item.url)).toEqual([
      "https://example.com/2026/acupuncture-clinic-ai-rollout"
    ]);
  });
});
