import { buildPublicPageMetadata } from "@/lib/seo/metadata";

export function buildTopicMetadata(input: {
  locale: "en" | "zh";
  slug: string;
  title: string;
  description: string;
}) {
  return buildPublicPageMetadata({
    locale: input.locale,
    pathname: `/${input.locale}/topics/${input.slug}`,
    title: input.locale === "zh" ? `${input.title} | 职危图谱` : `${input.title} | Role Radar`,
    description: input.description
  });
}
