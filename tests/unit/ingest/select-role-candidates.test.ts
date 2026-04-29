import { describe, expect, it } from "vitest";
import { selectRoleCandidates } from "@/lib/ingest/select-role-candidates";

const roles = [
  {
    slug: "ai",
    nameEn: "Data and AI Engineer",
    nameZh: "数据与AI工程师",
    keywords: ["ai agents", "agent orchestration", "llm ops"]
  },
  {
    slug: "models",
    nameEn: "Models",
    nameZh: "模特",
    keywords: ["runway", "fashion", "photoshoot"]
  },
  {
    slug: "computer-occupations-all-other",
    nameEn: "Computer Occupations, All Other",
    nameZh: "其他计算机职业",
    keywords: ["developer tooling", "technical workflows", "engineering systems"]
  },
  {
    slug: "computer-and-information-research-scientists",
    nameEn: "Computer and Information Research Scientists",
    nameZh: "计算机与信息研究科学家",
    keywords: ["machine learning research", "ai systems", "model development"]
  },
  {
    slug: "computer-systems-analysts",
    nameEn: "Computer Systems Analysts",
    nameZh: "计算机系统分析师",
    keywords: ["workflow analysis", "system integration", "enterprise workflows"]
  },
  {
    slug: "computer-and-information-systems-managers",
    nameEn: "Computer and Information Systems Managers",
    nameZh: "计算机与信息系统经理",
    keywords: ["ai transformation", "enterprise ai", "technology management"]
  },
  {
    slug: "art-directors",
    nameEn: "Art Directors",
    nameZh: "艺术总监",
    keywords: ["creative direction", "brand visuals"]
  }
];

describe("selectRoleCandidates", () => {
  it("keeps developer roles in the candidate set when source topic hints match aliases", () => {
    const candidates = selectRoleCandidates(
      {
        sourceLabel: "GitHub Blog AI & ML",
        sourceType: "COMPANY_UPDATE",
        title: "Platform update expands automation across internal teams",
        summary:
          "The release covers rollout guidance, new capabilities, and operating patterns for product groups.",
        topicHints: ["developer tools", "ai agents", "software engineering"]
      },
      roles
    );

    expect(candidates.map((candidate) => candidate.slug)).toContain("computer-occupations-all-other");
  });

  it("surfaces developer-adjacent roles for GitHub Copilot CLI workflows", () => {
    const candidates = selectRoleCandidates(
      {
        sourceLabel: "GitHub Blog AI & ML",
        sourceType: "COMPANY_UPDATE",
        title: "GitHub Copilot CLI combines model families for a second opinion",
        summary:
          "The update expands AI coding assistance, command-line workflows, and developer productivity."
      },
      roles
    );

    expect(candidates[0]?.slug).toBe("computer-occupations-all-other");
    expect(candidates.some((candidate) => candidate.slug === "art-directors")).toBe(false);
    expect(candidates.some((candidate) => candidate.slug === "ai")).toBe(false);
    expect(candidates.some((candidate) => candidate.slug === "models")).toBe(false);
  });

  it("surfaces systems and research roles for enterprise AI workflow updates", () => {
    const candidates = selectRoleCandidates(
      {
        sourceLabel: "Microsoft Source AI",
        sourceType: "COMPANY_UPDATE",
        title: "How AI agents are changing work",
        summary:
          "Microsoft explains enterprise workflow orchestration, AI transformation, and Copilot integration."
      },
      roles
    );

    expect(candidates.map((candidate) => candidate.slug)).toEqual(
      expect.arrayContaining([
        "computer-systems-analysts",
        "computer-and-information-systems-managers"
        ])
    );
  });

  it("surfaces developer and systems roles for secure software ai workflow updates", () => {
    const candidates = selectRoleCandidates(
      {
        sourceLabel: "Microsoft Source AI",
        sourceType: "COMPANY_UPDATE",
        title: "Strengthening secure software at global scale: How MSRC is evolving with AI",
        summary:
          "Microsoft explains how AI is changing secure software workflows, engineering systems, and response operations."
      },
      roles
    );

    expect(candidates.map((candidate) => candidate.slug)).toEqual(
      expect.arrayContaining([
        "computer-occupations-all-other",
        "computer-systems-analysts"
      ])
    );
  });

  it("keeps weaker but still role-relevant developer workflow coverage in the candidate set", () => {
    const candidates = selectRoleCandidates(
      {
        sourceLabel: "VentureBeat AI",
        sourceType: "NEWS",
        title: "AI copilots are reshaping software team release workflow",
        summary:
          "Teams use copilots to review pull requests, summarize changes, and route release work faster."
      },
      roles
    );

    expect(candidates.map((candidate) => candidate.slug)).toEqual(
      expect.arrayContaining([
        "computer-occupations-all-other",
        "computer-systems-analysts"
      ])
    );
  });

  it("keeps lower-scoring adjacent workflow roles in the default candidate window", () => {
    const crowdedRoles = [
      ...Array.from({ length: 16 }, (_, index) => ({
        slug: `distractor-${index + 1}`,
        nameEn: `Distractor ${index + 1}`,
        nameZh: `干扰项${index + 1}`,
        keywords: [`topic${index + 1}`]
      })),
      {
        slug: "bookkeeping-clerk",
        nameEn: "Bookkeeping Clerk",
        nameZh: "记账员",
        keywords: ["reconciliation review"]
      }
    ];

    const candidates = selectRoleCandidates(
      {
        sourceLabel: "Finance Platform Blog",
        sourceType: "COMPANY_UPDATE",
        title: "topic1 topic2 topic3 topic4 topic5 topic6 topic7 topic8",
        summary:
          "topic9 topic10 topic11 topic12 topic13 topic14 topic15 topic16 teams now use AI for reconciliation tasks."
      },
      crowdedRoles
    );

    expect(candidates.map((candidate) => candidate.slug)).toContain("bookkeeping-clerk");
  });

  it("keeps adjacent workflow media items on a nearby role but ignores generic funding chatter", () => {
    const financeRoles = [
      ...roles,
      {
        slug: "bookkeeping-clerk",
        nameEn: "Bookkeeping Clerk",
        nameZh: "记账员",
        keywords: ["bookkeeping", "reconciliation", "invoice"]
      }
    ];

    const adjacentCandidates = selectRoleCandidates(
      {
        sourceLabel: "The Decoder",
        sourceType: "NEWS",
        title: "AI changes reconciliation review workflows for finance teams",
        summary:
          "Teams use AI to speed up reconciliation review and other finance operations workflows."
      },
      financeRoles
    );

    const genericCandidates = selectRoleCandidates(
      {
        sourceLabel: "VentureBeat AI",
        sourceType: "NEWS",
        title: "AI startup raises funding to expand its platform",
        summary: "The piece covers funding, valuation, and broader ecosystem momentum."
      },
      financeRoles
    );

    expect(adjacentCandidates.map((candidate) => candidate.slug)).toContain("bookkeeping-clerk");
    expect(genericCandidates.map((candidate) => candidate.slug)).not.toContain("bookkeeping-clerk");
    expect(genericCandidates.some((candidate) => candidate.slug === "ai")).toBe(false);
    expect(genericCandidates.some((candidate) => candidate.slug === "models")).toBe(false);
  });
});
