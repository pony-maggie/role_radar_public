import { JsonLd } from "@/components/shared/json-ld";
import { HomeReplacementRankingChart } from "@/components/home/home-replacement-ranking-chart";
import { RoleCardGrid } from "@/components/home/role-card-grid";
import { RoleSearch } from "@/components/home/role-search";
import { getDictionary } from "@/lib/i18n/config";
import { buildPublicPageMetadata } from "@/lib/seo/metadata";
import { buildHomepageFaqSchema } from "@/lib/seo/structured-data";
import { homepageFeaturedTopicSlugs, topicDefinitions } from "@/lib/topics/topic-definitions";
import { getHomepageViewModel } from "@/lib/view-models/homepage";
import Link from "next/link";
import type { Metadata } from "next";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isZh = locale === "zh";

  return buildPublicPageMetadata({
    locale,
    pathname: `/${locale}`,
    title: locale === "zh" ? "AI 替代率职位数据库 | 职危图谱" : "AI Replacement Rate Role Database | Role Radar",
    description: isZh
      ? "查看哪些岗位正在承受真实 AI 替代压力，浏览替代率排行、岗位卡片和可核查的时间线信号。"
      : "Track which roles are facing real AI replacement pressure through ranked role pages, inspectable timelines, and localized job snapshots."
  });
}

export default async function Homepage({
  params
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;
  const copy = getDictionary(locale);
  const viewModel = await getHomepageViewModel(locale);
  const topicBySlug = new Map(topicDefinitions.map((topic) => [topic.slug, topic] as const));
  const featuredTopics = homepageFeaturedTopicSlugs.map((slug) => {
    const topic = topicBySlug.get(slug);

    if (!topic) {
      throw new Error(`Missing homepage featured topic definition: ${slug}`);
    }

    return topic;
  });

  return (
    <section className="home-page page-fade page-shell">
      <header className="home-strip">
        <div className="home-strip-copy">
          <p className="eyebrow">{locale === "zh" ? "AI 岗位替代预警" : "AI role replacement tracker"}</p>
          <h1 className="home-brand-title">{copy.brand}</h1>
          <p className="home-strip-note">{viewModel.heroTitle}</p>
          <p className="home-strip-support">
            {locale === "zh"
              ? "先按岗位浏览，再用模糊搜索直达目标职位。"
              : "Browse roles first, then jump straight to a role with fuzzy search."}
          </p>
        </div>
        <div className="home-strip-search">
          <RoleSearch
            hint={viewModel.searchHint}
            label={viewModel.searchLabel}
            locale={locale}
            placeholder={viewModel.searchPlaceholder}
            suggestions={viewModel.searchSuggestions}
          />
        </div>
      </header>
      <HomeReplacementRankingChart
        items={viewModel.replacementRanking}
        locale={locale}
        metricLabel={viewModel.replacementRankingMetricLabel}
        note={viewModel.replacementRankingNote}
        title={viewModel.replacementRankingTitle}
      />
      <section className="feature-section section-stack topic-role-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">{locale === "zh" ? "专题浏览" : "Browse topics"}</h2>
            <span className="section-note">
              {locale === "zh"
                ? "按专题入口快速查看一组相关岗位。"
                : "Jump into a curated topic page to explore related roles quickly."}
            </span>
          </div>
        </div>
        <ol className="topic-role-list">
          {featuredTopics.map((topic, index) => (
            <li key={topic.slug} className="topic-role-card">
              <Link className="topic-role-link" href={`/${locale}/topics/${topic.slug}`}>
                <div className="topic-role-topline">
                  <span className="topic-role-rank">{String(index + 1).padStart(2, "0")}</span>
                  <strong className="topic-role-name">{topic.localeTitles[locale]}</strong>
                </div>
                <p className="topic-role-summary">{topic.localeDescriptions[locale]}</p>
              </Link>
            </li>
          ))}
        </ol>
      </section>
      <RoleCardGrid
        locale={locale}
        note={viewModel.roleGridNote}
        title={viewModel.roleGridTitle}
        roles={viewModel.roles}
      />
      <JsonLd data={buildHomepageFaqSchema(locale)} id={`homepage-faq-${locale}`} />
    </section>
  );
}
