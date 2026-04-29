import { listTopicRoles } from "@/lib/repositories/roles";
import { topicDefinitions } from "@/lib/topics/topic-definitions";

type TopicLocale = "en" | "zh";

export async function getTopicPage(slug: string, locale: TopicLocale) {
  const topic = topicDefinitions.find((entry) => entry.slug === slug);
  if (!topic) {
    return null;
  }

  const roles = await listTopicRoles(topic.filters);

  return {
    slug: topic.slug,
    title: topic.localeTitles[locale],
    description: topic.localeDescriptions[locale],
    roles: roles.map((role) => ({
      slug: role.slug,
      name: locale === "zh" ? role.nameZh : role.nameEn,
      replacementRate: role.replacementRate,
      summary: locale === "zh" ? role.riskSummaryZh : role.riskSummaryEn
    })),
    faq: topic.faq.map((item) => ({
      question: locale === "zh" ? item.questionZh : item.questionEn,
      answer: locale === "zh" ? item.answerZh : item.answerEn
    }))
  };
}
