import { getDictionary } from "@/lib/i18n/config";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";

export function SiteHeader({ locale }: { locale: "en" | "zh" }) {
  const copy = getDictionary(locale);

  return (
    <header className="site-header">
      <a href={`/${locale}`} className="brand-mark">
        {copy.brand}
      </a>
      <nav className="site-nav" aria-label="Primary">
        <a href={`/${locale}/watchlist`} className="nav-link">
          {copy.navWatchlist}
        </a>
      </nav>
      <LocaleSwitcher locale={locale} />
    </header>
  );
}
