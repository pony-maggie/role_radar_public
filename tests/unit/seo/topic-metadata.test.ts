import { describe, expect, it } from "vitest";
import { buildTopicMetadata } from "@/lib/seo/topic-metadata";
import { buildTopicStructuredData } from "@/lib/seo/topic-structured-data";

describe("topic seo", () => {
  it("builds localized metadata for a zh topic page", () => {
    const metadata = buildTopicMetadata({
      locale: "zh",
      slug: "highest-ai-replacement-rates",
      title: "AI 替代率最高的岗位",
      description: "查看当前 AI 替代率最高的一批岗位。"
    });

    expect(metadata).toMatchObject({
      title: "AI 替代率最高的岗位 | 职危图谱",
      description: "查看当前 AI 替代率最高的一批岗位。",
      alternates: {
        canonical: "http://localhost:3000/zh/topics/highest-ai-replacement-rates",
        languages: {
          en: "http://localhost:3000/en/topics/highest-ai-replacement-rates",
          zh: "http://localhost:3000/zh/topics/highest-ai-replacement-rates",
          "x-default": "http://localhost:3000/en/topics/highest-ai-replacement-rates"
        }
      }
    });
  });

  it("builds localized metadata for an en topic page", () => {
    const metadata = buildTopicMetadata({
      locale: "en",
      slug: "highest-ai-replacement-rates",
      title: "Highest AI replacement rate roles",
      description: "See the current set of roles with the highest AI replacement rates."
    });

    expect(metadata).toMatchObject({
      title: "Highest AI replacement rate roles | Role Radar",
      description: "See the current set of roles with the highest AI replacement rates.",
      alternates: {
        canonical: "http://localhost:3000/en/topics/highest-ai-replacement-rates",
        languages: {
          en: "http://localhost:3000/en/topics/highest-ai-replacement-rates",
          zh: "http://localhost:3000/zh/topics/highest-ai-replacement-rates",
          "x-default": "http://localhost:3000/en/topics/highest-ai-replacement-rates"
        }
      }
    });
  });

  it("builds collection, breadcrumb, and faq schema for zh topic pages", () => {
    const schema = buildTopicStructuredData({
      locale: "zh",
      slug: "highest-ai-replacement-rates",
      title: "AI 替代率最高的岗位",
      description: "查看当前 AI 替代率最高的一批岗位。",
      faq: [
        {
          question: "这些岗位是怎么选出来的？",
          answer: "这些岗位按职危图谱中已存储的替代率排序。"
        }
      ]
    });

    expect(schema).toHaveLength(3);
    expect(schema[0]).toMatchObject({
      "@type": "CollectionPage",
      name: "AI 替代率最高的岗位",
      description: "查看当前 AI 替代率最高的一批岗位。",
      url: "http://localhost:3000/zh/topics/highest-ai-replacement-rates",
      inLanguage: "zh-CN"
    });
    expect(schema[1]).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        expect.objectContaining({
          position: 1,
          name: "职危图谱"
        }),
        expect.objectContaining({
          position: 2,
          name: "AI 替代率最高的岗位"
        })
      ]
    });
    expect(schema[2]).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [
        expect.objectContaining({
          "@type": "Question",
          name: "这些岗位是怎么选出来的？"
        })
      ]
    });
  });

  it("builds collection, breadcrumb, and faq schema for en topic pages", () => {
    const schema = buildTopicStructuredData({
      locale: "en",
      slug: "highest-ai-replacement-rates",
      title: "Highest AI replacement rate roles",
      description: "See the current set of roles with the highest AI replacement rates.",
      faq: [
        {
          question: "How are these roles chosen?",
          answer: "They are ordered by the stored replacement rate already computed in Role Radar."
        }
      ]
    });

    expect(schema).toHaveLength(3);
    expect(schema[0]).toMatchObject({
      "@type": "CollectionPage",
      name: "Highest AI replacement rate roles",
      description: "See the current set of roles with the highest AI replacement rates.",
      url: "http://localhost:3000/en/topics/highest-ai-replacement-rates",
      inLanguage: "en-US"
    });
    expect(schema[1]).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        expect.objectContaining({
          position: 1,
          name: "Role Radar"
        }),
        expect.objectContaining({
          position: 2,
          name: "Highest AI replacement rate roles"
        })
      ]
    });
    expect(schema[2]).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [
        expect.objectContaining({
          "@type": "Question",
          name: "How are these roles chosen?"
        })
      ]
    });
  });
});
