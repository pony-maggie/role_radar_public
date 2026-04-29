import { expect, test } from "@playwright/test";

test("homepage shows a 24-card role grid with load more", async ({ page }) => {
  await page.goto("/en");

  await expect(page.getByRole("heading", { name: /Role Radar/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Role cards/i })).toBeVisible();
  await expect(page.getByText(/Browse roles first/i)).toBeVisible();
  await expect(page.getByText(/Type a role name/i)).toBeVisible();
  await expect(page.locator(".role-card")).toHaveCount(24);
  await expect(page.getByRole("button", { name: /Load more/i })).toBeVisible();

  await page.getByRole("button", { name: /Load more/i }).click();
  await expect(page.locator(".role-card")).toHaveCount(48);
  await expect(page.getByText(/Showing 48 of/i)).toBeVisible();
});

test("homepage places the replacement ranking between search and cards", async ({ page }) => {
  await page.goto("/en");

  await expect(page.getByRole("heading", { name: /Replacement-rate ranking/i })).toBeVisible();
  await expect(page.locator(".replacement-ranking-row")).toHaveCount(10);

  const order = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll("*"));
    const indexOf = (selector: string) => {
      const node = document.querySelector(selector);
      return node ? elements.indexOf(node) : -1;
    };

    return {
      search: indexOf(".home-strip-search"),
      ranking: indexOf(".replacement-ranking-section"),
      cards: indexOf(".home-role-grid")
    };
  });

  expect(order.search).toBeGreaterThanOrEqual(0);
  expect(order.ranking).toBeGreaterThan(order.search);
  expect(order.cards).toBeGreaterThan(order.ranking);

  const firstRankingLink = page.locator(".replacement-ranking-link").first();
  const firstRankingName = await firstRankingLink.locator(".replacement-ranking-name").innerText();

  await firstRankingLink.click();

  await expect(page).toHaveURL(/\/en\/roles\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { name: firstRankingName })).toBeVisible();
});

test("homepage search filters fuzzily and opens the top match with Enter", async ({ page }) => {
  await page.goto("/en");

  await page.getByLabel(/Search a role/i).fill("cust ser");
  await expect(page.getByRole("option", { name: /Customer Service Representative/i })).toBeVisible();

  await page.getByLabel(/Search a role/i).press("Enter");

  await expect(page).toHaveURL(/\/en\/roles\/customer-service-representative$/);
  await expect(page.getByRole("heading", { name: /Customer Service Representative/i })).toBeVisible();
});

test("homepage search lets a clicked suggestion open the selected role", async ({ page }) => {
  await page.goto("/en");

  await page.getByLabel(/Search a role/i).fill("book");
  await expect(page.getByRole("option", { name: /Bookkeeping Clerk/i })).toBeVisible({
    timeout: 10000
  });
  await page.getByRole("option", { name: /Bookkeeping Clerk/i }).click();

  await expect(page).toHaveURL(/\/en\/roles\/bookkeeping-clerk$/);
  await expect(page.getByRole("heading", { name: /Bookkeeping Clerk/i })).toBeVisible();
});

test("zh homepage search shows localized office-support role labels", async ({ page }) => {
  await page.goto("/zh");

  await page.getByRole("combobox").fill("office");
  await expect(page.getByRole("option", { name: /其他办公室与行政支持人员/ })).toBeVisible();
  await expect(page.getByText("Office and Administrative Support Workers, All Other")).toHaveCount(0);
});
