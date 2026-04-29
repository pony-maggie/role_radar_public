import { en } from "@/lib/i18n/dictionaries/en";
import { zh } from "@/lib/i18n/dictionaries/zh";
import { presentRisk } from "@/lib/domain/risk-presentation";
import {
  listHomepageReplacementRanking,
  listHomepageRoles,
  listRoleSearchSuggestions
} from "@/lib/repositories/roles";

function hasLocalizedChineseName(role: { nameEn: string; nameZh: string }) {
  return role.nameZh.trim().length > 0 && role.nameZh !== role.nameEn;
}

export async function getHomepageViewModel(locale: "en" | "zh") {
  const copy = locale === "zh" ? zh : en;
  const [roles, searchSuggestions, replacementRanking] = await Promise.all([
    listHomepageRoles(760),
    listRoleSearchSuggestions(760),
    listHomepageReplacementRanking()
  ]);
  const visibleRoles = locale === "zh" ? roles.filter(hasLocalizedChineseName) : roles;
  const visibleSearchSuggestions =
    locale === "zh" ? searchSuggestions.filter(hasLocalizedChineseName) : searchSuggestions;
  const visibleReplacementRanking =
    locale === "zh" ? replacementRanking.filter(hasLocalizedChineseName) : replacementRanking;

  return {
    heroTitle: copy.heroTitle,
    searchLabel: copy.searchPlaceholder,
    searchPlaceholder: copy.searchPlaceholder,
    searchHint:
      locale === "zh"
        ? "输入关键词做模糊搜索，回车打开首个匹配项"
        : "Type to filter roles fuzzily, then press Enter to open the top match",
    roleGridTitle: locale === "zh" ? "岗位卡片" : "Role cards",
    roleGridNote:
      locale === "zh"
        ? `展示前 24 个岗位，继续加载可浏览全部 ${visibleRoles.length} 个`
        : `Showing the first 24 roles, with load more to browse all ${visibleRoles.length}`,
    replacementRankingTitle: locale === "zh" ? "替代率排行" : "Replacement-rate ranking",
    replacementRankingNote:
      locale === "zh"
        ? "按已存储的替代率降序排列，最多展示 10 个岗位"
        : "Sorted by stored replacement rate, showing the top 10 roles",
    replacementRankingMetricLabel: locale === "zh" ? "替代率" : "Replacement rate",
    replacementRanking: visibleReplacementRanking.map((role) => ({
      slug: role.slug,
      name: locale === "zh" ? role.nameZh : role.nameEn,
      replacementRate: role.replacementRate
    })),
    roles: visibleRoles.map((role) => ({
      slug: role.slug,
      name: locale === "zh" ? role.nameZh : role.nameEn,
      risk: {
        ...presentRisk({
          riskLevel: role.riskLevel,
          ratingStatus: role.ratingStatus,
          locale
        }),
        label:
          role.ratingStatus === "RATED" && role.replacementRate !== null
            ? `${role.replacementRate}%`
            : presentRisk({
                riskLevel: role.riskLevel,
                ratingStatus: role.ratingStatus,
                locale
              }).label,
        summary:
          locale === "zh"
            ? (role.riskSummaryZh ?? presentRisk({
                riskLevel: role.riskLevel,
                ratingStatus: role.ratingStatus,
                locale
              }).summary)
            : (role.riskSummaryEn ?? presentRisk({
                riskLevel: role.riskLevel,
                ratingStatus: role.ratingStatus,
                locale
              }).summary)
      }
    })),
    searchSuggestions: visibleSearchSuggestions.map((role) => ({
      slug: role.slug,
      label: locale === "zh" ? role.nameZh : role.nameEn,
      secondaryLabel: locale === "zh" ? "" : role.nameZh
    }))
  };
}
