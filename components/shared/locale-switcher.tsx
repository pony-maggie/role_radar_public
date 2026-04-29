"use client";

import { isLocale } from "@/lib/i18n/config";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function LocaleSwitcher({ locale }: { locale: "en" | "zh" }) {
  const nextLocale = locale === "en" ? "zh" : "en";
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0) {
    return (
      <Link className="locale-link" href={`/${nextLocale}`}>
        {nextLocale.toUpperCase()}
      </Link>
    );
  }

  if (isLocale(parts[0])) {
    parts[0] = nextLocale;
  } else {
    parts.unshift(nextLocale);
  }

  return (
    <Link className="locale-link" href={`/${parts.join("/")}`}>
      {nextLocale.toUpperCase()}
    </Link>
  );
}
