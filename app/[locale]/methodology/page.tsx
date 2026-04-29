import { buildPublicPageMetadata } from "@/lib/seo/metadata";

export default async function MethodologyPage({
  params
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh";

  return (
    <section>
      <h1>{isZh ? "方法论" : "Methodology"}</h1>
      <p>
        {isZh
          ? "Role Radar 将岗位结构分析与受约束的外部信号结合起来。"
          : "Role Radar combines structural role analysis with bounded external signals."}
      </p>
      <ul>
        <li>{isZh ? "单篇文章不会直接导致岗位等级跃迁。" : "No single article can force a role-level jump."}</li>
        <li>{isZh ? "岗位可以被标记为信号不足。" : "Roles can be marked as insufficient signal."}</li>
        <li>{isZh ? "展示的证据必须可被用户检查。" : "Displayed evidence must remain inspectable."}</li>
      </ul>
    </section>
  );
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;

  return buildPublicPageMetadata({
    locale,
    pathname: `/${locale}/methodology`,
    title: locale === "zh" ? "方法论 | 职危图谱" : "Methodology | Role Radar",
    description:
      locale === "zh"
        ? "了解职危图谱如何结合岗位结构和受约束的外部信号来评估 AI 替代压力。"
        : "Learn how Role Radar combines role structure and bounded external signals to estimate AI replacement pressure."
  });
}
