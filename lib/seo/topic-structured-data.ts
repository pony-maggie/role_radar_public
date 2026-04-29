import { buildCanonicalUrl } from "@/lib/seo/metadata";

export function buildTopicStructuredData(input: {
  locale: "en" | "zh";
  slug: string;
  title: string;
  description: string;
  faq: ReadonlyArray<{
    question: string;
    answer: string;
  }>;
}) {
  const pathname = `/${input.locale}/topics/${input.slug}`;
  const topicUrl = buildCanonicalUrl(pathname);
  const homepageUrl = buildCanonicalUrl(`/${input.locale}`);
  const inLanguage = input.locale === "zh" ? "zh-CN" : "en-US";
  const homepageName = input.locale === "zh" ? "职危图谱" : "Role Radar";

  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: input.title,
      description: input.description,
      url: topicUrl,
      inLanguage
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: homepageName,
          item: homepageUrl
        },
        {
          "@type": "ListItem",
          position: 2,
          name: input.title,
          item: topicUrl
        }
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: input.faq.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer
        }
      }))
    }
  ];
}
