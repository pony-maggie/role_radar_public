import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopicFaq } from "@/components/topic/topic-faq";
import { TopicHero } from "@/components/topic/topic-hero";
import { TopicRoleList } from "@/components/topic/topic-role-list";
import { JsonLd } from "@/components/shared/json-ld";
import { getTopicPage } from "@/lib/application/topics/get-topic-page";
import { buildTopicMetadata } from "@/lib/seo/topic-metadata";
import { buildTopicStructuredData } from "@/lib/seo/topic-structured-data";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: "en" | "zh"; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await getTopicPage(slug, locale);

  if (!page) {
    return {};
  }

  return buildTopicMetadata({
    locale,
    slug,
    title: page.title,
    description: page.description
  });
}

export default async function TopicPage({
  params
}: {
  params: Promise<{ locale: "en" | "zh"; slug: string }>;
}) {
  const { locale, slug } = await params;
  const page = await getTopicPage(slug, locale);

  if (!page) {
    notFound();
  }

  return (
    <section className="topic-page page-fade page-shell">
      <TopicHero description={page.description} locale={locale} title={page.title} />
      <TopicRoleList locale={locale} roles={page.roles} />
      <TopicFaq items={page.faq} locale={locale} />
      <JsonLd
        id={`topic-schema-${locale}-${slug}`}
        data={buildTopicStructuredData({
          locale,
          slug,
          title: page.title,
          description: page.description,
          faq: page.faq
        })}
      />
    </section>
  );
}
