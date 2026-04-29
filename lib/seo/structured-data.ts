type Locale = "en" | "zh";
import { SITE_URL } from "@/lib/seo/site-config";

function buildAbsoluteUrl(pathname: string) {
  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function buildHomepageFaqSchema(locale: Locale) {
  const isZh = locale === "zh";

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: isZh ? "zh-CN" : "en",
    mainEntity: [
      {
        "@type": "Question",
        name: isZh ? "职危图谱的 AI 替代率是怎么得出的？" : "How does Role Radar estimate AI replacement rate?",
        acceptedAnswer: {
          "@type": "Answer",
          text: isZh
            ? "我们把岗位结构分析和可核查的时间线信号结合起来，输出一个持续更新的替代率估计。"
            : "Role Radar combines structural role analysis with inspectable timeline signals to produce a continuously updated replacement-rate estimate."
        }
      },
      {
        "@type": "Question",
        name: isZh ? "单篇新闻会直接改变岗位替代率吗？" : "Can one article directly change a role's replacement rate?",
        acceptedAnswer: {
          "@type": "Answer",
          text: isZh
            ? "不会。单条来源只会作为受约束信号的一部分，岗位分数不会被一篇文章直接拉动。"
            : "No. A single source item is only one bounded signal and cannot force a role-level jump by itself."
        }
      },
      {
        "@type": "Question",
        name: isZh ? "我能看到支撑判断的来源吗？" : "Can I inspect the evidence behind the estimate?",
        acceptedAnswer: {
          "@type": "Answer",
          text: isZh
            ? "可以。岗位详情页会展示可核查的时间线来源，帮助你理解这个岗位为什么被评成当前等级。"
            : "Yes. Every role detail page shows inspectable timeline sources so you can understand why the role is rated the way it is."
        }
      }
    ]
  };
}

export function buildRoleWebPageSchema(input: {
  locale: Locale;
  pathname: string;
  roleName: string;
  description: string;
  replacementRate: number | null;
  timelineCount: number;
}) {
  const isZh = input.locale === "zh";

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    inLanguage: isZh ? "zh-CN" : "en",
    name: isZh ? `${input.roleName} AI 替代率` : `${input.roleName} AI replacement rate`,
    description: input.description,
    url: buildAbsoluteUrl(input.pathname),
    about: {
      "@type": "Occupation",
      name: input.roleName,
      occupationalCategory: isZh ? "岗位风险追踪" : "Role risk tracking"
    },
    isPartOf: {
      "@type": "WebSite",
      name: isZh ? "职危图谱" : "Role Radar",
      url: buildAbsoluteUrl(`/${input.locale}`)
    },
    mainEntity: {
      "@type": "DefinedTerm",
      name: input.roleName,
      description: input.description,
      termCode: input.replacementRate === null ? "UNRATED" : String(input.replacementRate)
    },
    mentions: {
      "@type": "Thing",
      name: isZh ? `时间线证据 ${input.timelineCount} 条` : `${input.timelineCount} timeline item(s)`
    }
  };
}

export function buildRoleBreadcrumbSchema(input: {
  locale: Locale;
  pathname: string;
  roleName: string;
}) {
  const homepageName = input.locale === "zh" ? "职危图谱" : "Role Radar";
  const listingName = input.locale === "zh" ? "岗位数据库" : "Role database";

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: homepageName,
        item: buildAbsoluteUrl(`/${input.locale}`)
      },
      {
        "@type": "ListItem",
        position: 2,
        name: listingName,
        item: buildAbsoluteUrl(`/${input.locale}`)
      },
      {
        "@type": "ListItem",
        position: 3,
        name: input.roleName,
        item: buildAbsoluteUrl(input.pathname)
      }
    ]
  };
}
