import { expect, test } from "@playwright/test";
import { homepageFeaturedTopicSlugs, topicDefinitions } from "@/lib/topics/topic-definitions";

const featuredTopics = homepageFeaturedTopicSlugs.map((slug) => {
  const topic = topicDefinitions.find((entry) => entry.slug === slug);
  if (!topic) {
    throw new Error(`Missing featured topic definition: ${slug}`);
  }

  return topic;
});

test("zh topic page renders title, role links, and faq", async ({ page }) => {
  await page.goto("/zh/topics/highest-ai-replacement-rates");

  await expect(page.getByRole("heading", { name: "AI 替代率最高的岗位" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "岗位列表" })).toBeVisible();
  const roleLink = page.locator(".topic-role-link").first();
  await expect(roleLink).toBeVisible();
  await expect(roleLink).toHaveAttribute("href", /\/zh\/roles\/[a-z0-9-]+$/);
  await expect(roleLink).toContainText("%");
  await expect(page.getByRole("heading", { name: "常见问题" })).toBeVisible();
  await expect(page.getByText("这些岗位是怎么选出来的？")).toBeVisible();
  await expect(page.getByText("这些岗位按职危图谱中已存储的替代率排序。")).toBeVisible();
});

test("en topic page renders localized title and role list", async ({ page }) => {
  await page.goto("/en/topics/highest-ai-replacement-rates");

  await expect(page.getByRole("heading", { name: "Jobs with the highest AI replacement rates" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Roles in this topic" })).toBeVisible();
  await expect(page.locator(".topic-role-link").first()).toHaveAttribute(
    "href",
    /\/en\/roles\/[a-z0-9-]+$/
  );
  await expect(page.getByRole("heading", { name: "FAQ" })).toBeVisible();
  await expect(page.getByText("How are these roles chosen?")).toBeVisible();
  await expect(
    page.getByText("They are ordered by the stored replacement rate already computed in Role Radar.")
  ).toBeVisible();
});

test("topic pages are discoverable from homepage and sitemap", async ({ page, request }) => {
  await page.goto("/zh");
  const topicLink = page.getByRole("link", { name: "AI 替代率最高的岗位" });
  await expect(topicLink).toBeVisible();
  await topicLink.click();
  await expect(page).toHaveURL(/\/zh\/topics\/highest-ai-replacement-rates$/);
  await expect(page.getByRole("heading", { name: "AI 替代率最高的岗位" })).toBeVisible();

  const response = await request.get("/sitemap.xml");
  const text = await response.text();

  expect(text).toContain("/zh/topics/highest-ai-replacement-rates");
  expect(text).toContain("/en/topics/highest-ai-replacement-rates");
});

for (const locale of ["zh", "en"] as const) {
  test(`${locale} homepage exposes featured topic links`, async ({ page }) => {
    await page.goto(`/${locale}`);

    for (const topic of featuredTopics) {
      const link = page.getByRole("link", { name: topic.localeTitles[locale] });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", `/${locale}/topics/${topic.slug}`);
    }
  });
}

test("sitemap includes every topic page with localized alternates", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  const xml = await response.text();
  const urlEntries = Array.from(xml.matchAll(/<url>([\s\S]*?)<\/url>/g), (match) => match[1] ?? "");
  const firstLoc = xml.match(/<loc>([^<]+)<\/loc>/)?.[1];

  if (!firstLoc) {
    throw new Error("Missing sitemap loc entries");
  }

  const siteOrigin = new URL(firstLoc).origin;

  for (const topic of topicDefinitions) {
    for (const locale of ["en", "zh"] as const) {
      const topicUrl = `${siteOrigin}/${locale}/topics/${topic.slug}`;
      const entry = urlEntries.find((urlEntry) => urlEntry.includes(`<loc>${topicUrl}</loc>`));

      if (!entry) {
        throw new Error(`Missing sitemap entry for ${topicUrl}`);
      }

      expect(entry).toMatch(
        new RegExp(`<xhtml:link rel="alternate" hreflang="en" href="${siteOrigin}/en/topics/${topic.slug}"\\s*/>`)
      );
      expect(entry).toMatch(
        new RegExp(`<xhtml:link rel="alternate" hreflang="zh" href="${siteOrigin}/zh/topics/${topic.slug}"\\s*/>`)
      );
      expect(entry).toMatch(
        new RegExp(`<xhtml:link rel="alternate" hreflang="x-default" href="${siteOrigin}/en/topics/${topic.slug}"\\s*/>`)
      );
    }
  }
});
