const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.ROLE_RADAR_BASE_URL?.trim() ||
  "http://localhost:3000";

export const SITE_URL = siteUrl.replace(/\/+$/, "");
export const SITE_NAME = "Role Radar";
export const PUBLIC_LOCALES = ["en", "zh"] as const;
export type PublicLocale = (typeof PUBLIC_LOCALES)[number];
