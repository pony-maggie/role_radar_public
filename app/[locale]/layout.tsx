import { DocumentLangSync } from "@/components/shared/document-lang-sync";
import { SiteHeader } from "@/components/shared/site-header";
import { isLocale } from "@/lib/i18n/config";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <div className="site-shell">
      <DocumentLangSync locale={locale} />
      <SiteHeader locale={locale} />
      <main className="site-main">{children}</main>
    </div>
  );
}
