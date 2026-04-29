import { afterEach, describe, expect, it, vi } from "vitest";
import { getTopicPage } from "@/lib/application/topics/get-topic-page";
import { homepageFeaturedTopicSlugs, topicDefinitions } from "@/lib/topics/topic-definitions";

const { listTopicRolesMock } = vi.hoisted(() => ({
  listTopicRolesMock: vi.fn()
}));

vi.mock("@/lib/repositories/roles", () => ({
  listTopicRoles: listTopicRolesMock
}));

afterEach(() => {
  listTopicRolesMock.mockReset();
});

describe("topic definitions", () => {
  it("defines the first-wave chinese seo landing pages", () => {
    const expectedSlugs = [
      "highest-ai-replacement-rates",
      "which-jobs-are-most-at-risk",
      "administrative-and-office-jobs",
      "customer-support-jobs",
      "finance-and-accounting-jobs",
      "legal-jobs",
    ] as const;

    expect(topicDefinitions).toHaveLength(expectedSlugs.length);
    expect(new Set(topicDefinitions.map((topic) => topic.slug)).size).toBe(topicDefinitions.length);
    expect(topicDefinitions.map((topic) => topic.slug).sort()).toEqual([...expectedSlugs].sort());

    for (const slug of expectedSlugs) {
      const topic = topicDefinitions.find((entry) => entry.slug === slug);

      expect(topic).toBeDefined();
      if (!topic) {
        throw new Error(`Missing topic definition: ${slug}`);
      }

      expect(topic).toMatchObject({
        slug,
        localeTitles: {
          en: expect.any(String),
          zh: expect.any(String),
        },
        localeDescriptions: {
          en: expect.any(String),
          zh: expect.any(String),
        },
        faq: [
          expect.objectContaining({
            questionEn: expect.any(String),
            questionZh: expect.any(String),
            answerEn: expect.any(String),
            answerZh: expect.any(String),
          }),
        ],
      });

      expect(topic.filters.limit).toBeGreaterThan(0);

      if (topic.type === "ranking") {
        expect(topic.filters).not.toHaveProperty("includeSlugs");
        expect(topic.filters).not.toHaveProperty("includeKeywords");
        expect(topic.filters).toMatchObject({
          minReplacementRate: expect.any(Number),
        });
      } else {
        expect(topic.type).toBe("cluster");
        expect(topic.filters).not.toHaveProperty("minReplacementRate");
        expect(Boolean(topic.filters.includeSlugs) || Boolean(topic.filters.includeKeywords)).toBe(true);
      }
    }
  });

  it("keeps homepage featured topics pinned to explicit valid slugs", () => {
    expect(homepageFeaturedTopicSlugs).toEqual([
      "highest-ai-replacement-rates",
      "which-jobs-are-most-at-risk",
      "administrative-and-office-jobs"
    ]);

    for (const slug of homepageFeaturedTopicSlugs) {
      expect(topicDefinitions.some((topic) => topic.slug === slug)).toBe(true);
    }
  });
});

describe("getTopicPage", () => {
  it("returns null for missing topics", async () => {
    const page = await getTopicPage("missing-topic", "zh");

    expect(page).toBeNull();
    expect(listTopicRolesMock).not.toHaveBeenCalled();
  });

  it("calls listTopicRoles with the topic filters", async () => {
    listTopicRolesMock.mockResolvedValue([
      {
        slug: "sample-role",
        nameEn: "Sample Role",
        nameZh: "示例岗位",
        replacementRate: 72,
        riskSummaryEn: "Sample English summary",
        riskSummaryZh: "示例中文摘要"
      }
    ]);

    await getTopicPage("highest-ai-replacement-rates", "zh");

    expect(listTopicRolesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
        minReplacementRate: 55
      })
    );
  });

  it("builds a localized topic page view model", async () => {
    listTopicRolesMock.mockResolvedValue([
      {
        slug: "sample-role",
        nameEn: "Sample Role",
        nameZh: "示例岗位",
        replacementRate: 72,
        riskSummaryEn: "Sample English summary",
        riskSummaryZh: "示例中文摘要"
      }
    ]);

    const page = await getTopicPage("highest-ai-replacement-rates", "zh");

    expect(page).toMatchObject({
      slug: "highest-ai-replacement-rates",
      title: "AI 替代率最高的岗位",
      roles: [
        {
          slug: "sample-role",
          name: "示例岗位",
          replacementRate: 72,
          summary: "示例中文摘要"
        }
      ],
      faq: [
        {
          question: "这些岗位是怎么选出来的？",
          answer: "这些岗位按职危图谱中已存储的替代率排序。"
        }
      ]
    });
    expect(page?.roles.length).toBeGreaterThan(0);
    expect(page?.faq.length).toBeGreaterThan(0);
  });
});
