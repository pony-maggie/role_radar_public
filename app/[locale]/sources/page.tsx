import { listInferenceDiagnostics } from "@/lib/repositories/source-items";
import { assertReviewTokenFromSearchParams } from "@/lib/review/access";
import { buildNoIndexMetadata } from "@/lib/seo/metadata";

export const metadata = buildNoIndexMetadata();

const copy = {
  en: {
    title: "Inference diagnostics",
    subtitle: "Recent Gemini-classified source items",
    empty: "No classified source items are available right now.",
    assignedRole: "Assigned role",
    model: "Model",
    impact: "Impact",
    relevance: "Relevance",
    weight: "Signal weight",
    rationale: "Reasoning",
    open: "Open source"
  },
  zh: {
    title: "推理诊断",
    subtitle: "最近由 Gemini 分类的 source item",
    empty: "当前没有可用的分类 source item。",
    assignedRole: "归属岗位",
    model: "模型",
    impact: "影响方向",
    relevance: "相关性",
    weight: "信号权重",
    rationale: "推理说明",
    open: "查看原文"
  }
} as const;

export default async function SourcesPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: "en" | "zh" }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  assertReviewTokenFromSearchParams(await searchParams);
  const diagnostics = await listInferenceDiagnostics();
  const labels = copy[locale];

  return (
    <section className="space-y-6 px-6 py-10 md:px-10">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Operators only</p>
        <h1 className="text-4xl font-semibold tracking-[-0.04em]">{labels.title}</h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          {labels.subtitle}. {diagnostics.length}
        </p>
      </div>

      {diagnostics.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{labels.empty}</p>
      ) : (
        <div className="space-y-4">
          {diagnostics.map((item) => (
            <article
              className="rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6"
              key={item.id}
            >
              <div className="mb-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                <span>{item.sourceLabel}</span>
                <span>{item.publishedAt.slice(0, 10)}</span>
                <span>{item.decisionStatus}</span>
              </div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">{item.sourceTitle}</h2>
              <div className="mt-4 grid gap-3 text-sm text-[var(--muted)] md:grid-cols-2">
                <p>
                  <strong className="mr-2 text-[var(--foreground)]">{labels.assignedRole}</strong>
                  {locale === "zh"
                    ? item.roleNameZh ?? item.roleSlug ?? "Unmapped"
                    : item.roleNameEn ?? item.roleSlug ?? "Unmapped"}
                </p>
                <p>
                  <strong className="mr-2 text-[var(--foreground)]">{labels.model}</strong>
                  {[item.modelProvider, item.modelName].filter(Boolean).join(" / ") || "N/A"}
                </p>
                <p>
                  <strong className="mr-2 text-[var(--foreground)]">{labels.impact}</strong>
                  {item.impactDirection ?? "N/A"}
                </p>
                <p>
                  <strong className="mr-2 text-[var(--foreground)]">{labels.relevance}</strong>
                  {item.relevance ?? "N/A"}
                </p>
                <p>
                  <strong className="mr-2 text-[var(--foreground)]">{labels.weight}</strong>
                  {item.signalWeight ?? "N/A"}
                </p>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                <strong className="mr-2 text-[var(--foreground)]">{labels.rationale}</strong>
                {locale === "zh"
                  ? item.inferenceSummaryZh ?? item.inferenceSummaryEn ?? item.reason
                  : item.inferenceSummaryEn ?? item.reason}
              </p>
              <div className="mt-4">
                <a
                  className="text-sm font-medium text-[var(--foreground)] underline underline-offset-4"
                  href={item.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {labels.open}
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
