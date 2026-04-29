import { listHomepageRoles } from "@/lib/repositories/roles";
import { listWatchlistSummary } from "@/lib/repositories/subscriptions";
import { AUTH_SESSION_COOKIE, resolveAuthSession } from "@/lib/auth/email-auth";
import { getAuthSessionByTokenHash } from "@/lib/repositories/auth";
import { SubscriptionForm } from "@/components/watchlist/subscription-form";
import { EmailVerificationCard } from "@/components/watchlist/email-verification-card";
import { cookies } from "next/headers";
import { buildNoIndexMetadata } from "@/lib/seo/metadata";

export const metadata = buildNoIndexMetadata();

export default async function WatchlistPage({
  params
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const roles = await listHomepageRoles(760);
  const cookieStore = await cookies();
  const session = await resolveAuthSession({
    sessionToken: cookieStore.get(AUTH_SESSION_COOKIE)?.value ?? null,
    repo: {
      findSessionByTokenHash: getAuthSessionByTokenHash
    }
  });
  const title = locale === "zh" ? "追踪列表" : "Watchlist";
  const helperText =
    locale === "zh"
      ? "先用邮箱验证码登录，再开始追踪岗位变化并接收周报或显著变化提醒。"
      : "Sign in with an email code before tracking role changes and receiving weekly digests or major-change alerts.";

  if (!session) {
    return (
      <section className="watchlist-page watchlist-board page-fade page-shell">
        <div className="watchlist-strip">
          <p className="eyebrow">{locale === "zh" ? "持续追踪" : "Keep tracking"}</p>
          <h1 className="watchlist-title">{title}</h1>
          <p className="page-copy">{helperText}</p>
        </div>
        <div className="watchlist-board-grid">
          <EmailVerificationCard locale={locale} turnstileSiteKey={turnstileSiteKey} />
        </div>
      </section>
    );
  }

  const watchlist = await listWatchlistSummary(session.email);

  return (
    <section className="watchlist-page watchlist-board page-fade page-shell">
      <div className="watchlist-strip">
        <p className="eyebrow">{locale === "zh" ? "持续追踪" : "Keep tracking"}</p>
        <h1 className="watchlist-title">{title}</h1>
        <p className="page-copy">{helperText}</p>
      </div>
      <div className="watchlist-board-grid">
        <div className="watchlist-panel research-card">
          <SubscriptionForm
            defaultRoleSlug={roles[0]?.slug ?? ""}
            email={session.email}
            locale={locale}
            initialRoles={watchlist}
            roles={roles.map((role) => ({
              slug: role.slug,
              name: locale === "zh" ? role.nameZh : role.nameEn
            }))}
          />
        </div>
      </div>
    </section>
  );
}
