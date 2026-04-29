import type { Metadata } from "next";
import { PUBLIC_LOCALES, SITE_NAME, SITE_URL, type PublicLocale } from "@/lib/seo/site-config";

function normalizePathname(pathname: string) {
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function stripLocalePrefix(pathname: string) {
  const normalized = normalizePathname(pathname);
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  const [first, ...rest] = parts;
  if (PUBLIC_LOCALES.includes(first as PublicLocale)) {
    return rest.length > 0 ? `/${rest.join("/")}` : "";
  }

  return `/${parts.join("/")}`;
}

export function buildCanonicalUrl(pathname: string) {
  return `${SITE_URL}${normalizePathname(pathname)}`;
}

export function buildLocaleAlternates(pathname: string): Record<string, string> {
  const suffix = stripLocalePrefix(pathname);

  return {
    en: buildCanonicalUrl(`/en${suffix}`),
    zh: buildCanonicalUrl(`/zh${suffix}`),
    "x-default": buildCanonicalUrl(`/en${suffix}`)
  };
}

export function buildRobotsDirectives(input: { index: boolean }): NonNullable<Metadata["robots"]> {
  return input.index
    ? { index: true, follow: true }
    : { index: false, follow: false, googleBot: { index: false, follow: false } };
}

export function buildBaseMetadata(): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: SITE_NAME
  };
}

export function buildPublicPageMetadata(input: {
  locale: PublicLocale;
  pathname: string;
  title: string;
  description: string;
}): Metadata {
  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: buildCanonicalUrl(input.pathname),
      languages: buildLocaleAlternates(input.pathname)
    },
    robots: buildRobotsDirectives({ index: true })
  };
}

export function buildNoIndexMetadata(): Metadata {
  return {
    robots: buildRobotsDirectives({ index: false })
  };
}
