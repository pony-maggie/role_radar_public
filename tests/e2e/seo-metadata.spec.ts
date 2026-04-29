import { expect, test } from "@playwright/test";

test("homepage emits localized metadata and faq schema", async ({ page }) => {
  await page.goto("/zh");
  const html = await page.content();

  await expect(page).toHaveTitle(/职危图谱/);
  await expect(page.locator("meta[name='description']")).toHaveAttribute("content", /AI 替代压力/);
  await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", /\/zh$/);
  await expect(page.locator("link[rel='alternate'][hreflang='en']")).toHaveAttribute("href", /\/en$/);
  expect(html).toContain("FAQPage");
});

test("methodology page exposes public metadata", async ({ page }) => {
  await page.goto("/en/methodology");

  await expect(page).toHaveTitle(/Methodology/);
  await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", /\/en\/methodology$/);
});

test("watchlist stays noindex", async ({ page }) => {
  await page.goto("/en/watchlist");

  await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
});

test("role detail page emits localized metadata and structured data", async ({ page }) => {
  await page.goto("/zh/roles/customer-service-representative");
  const html = await page.content();

  await expect(page).toHaveTitle(/客户服务/);
  await expect(page.locator("meta[name='description']")).toHaveAttribute("content", /68%/);
  await expect(page.locator("link[rel='canonical']")).toHaveAttribute(
    "href",
    /\/zh\/roles\/customer-service-representative$/
  );
  await expect(page.locator("link[rel='alternate'][hreflang='en']")).toHaveAttribute(
    "href",
    /\/en\/roles\/customer-service-representative$/
  );
  expect(html).toContain("BreadcrumbList");
  expect(html).toContain("WebPage");
});

test("robots and sitemap are exposed", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Sitemap:");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain("/en/roles/customer-service-representative");
  expect(sitemapText).toContain("/zh/roles/customer-service-representative");
});
