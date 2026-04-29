import type { MetadataRoute } from "next";
import { listIndexableRoleSlugs } from "@/lib/repositories/roles";
import { topicDefinitions } from "@/lib/topics/topic-definitions";

export const dynamic = "force-dynamic";

const locales = ["en", "zh"] as const;

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.ROLE_RADAR_BASE_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function buildAbsoluteUrl(pathname: string) {
  const siteUrl = getSiteUrl();
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${siteUrl}${normalized}`;
}

function buildLocaleAlternates(pathname: string) {
  const suffix = pathname ? (pathname.startsWith("/") ? pathname : `/${pathname}`) : "";
  return {
    languages: {
      en: buildAbsoluteUrl(`/en${suffix}`),
      zh: buildAbsoluteUrl(`/zh${suffix}`),
      "x-default": buildAbsoluteUrl(`/en${suffix}`)
    }
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const roleSlugs = await listIndexableRoleSlugs();

  return [
    ...locales.flatMap((locale) => [
      {
        url: buildAbsoluteUrl(`/${locale}`),
        alternates: buildLocaleAlternates("")
      },
      {
        url: buildAbsoluteUrl(`/${locale}/methodology`),
        alternates: buildLocaleAlternates("/methodology")
      }
    ]),
    ...topicDefinitions.flatMap(({ slug }) =>
      locales.map((locale) => ({
        url: buildAbsoluteUrl(`/${locale}/topics/${slug}`),
        alternates: buildLocaleAlternates(`/topics/${slug}`)
      }))
    ),
    ...roleSlugs.flatMap(({ slug, updatedAt }) =>
      locales.map((locale) => ({
        url: buildAbsoluteUrl(`/${locale}/roles/${slug}`),
        lastModified: updatedAt,
        alternates: buildLocaleAlternates(`/roles/${slug}`)
      }))
    )
  ];
}
