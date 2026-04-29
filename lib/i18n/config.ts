import { en } from "@/lib/i18n/dictionaries/en";
import { zh } from "@/lib/i18n/dictionaries/zh";

export const locales = ["en", "zh"] as const;
export type Locale = (typeof locales)[number];
export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = {
  en,
  zh
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
