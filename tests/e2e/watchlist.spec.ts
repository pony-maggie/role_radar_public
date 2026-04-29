import { expect, test } from "@playwright/test";

test("watchlist requires email verification and then shows tracked roles", async ({ page }) => {
  const email = `watchlist-e2e-${Date.now()}@example.com`;

  await page.goto("/en/watchlist");

  await expect(page.getByRole("heading", { name: /Sign in with an email code/i })).toBeVisible();
  await page.getByLabel(/Email/i).fill(email);
  await page.getByRole("button", { name: /Send code/i }).click();

  const previewCode = await page.locator("strong").last().textContent();
  expect(previewCode).toMatch(/^\d{6}$/);

  await page.getByLabel(/Verification code/i).fill(previewCode ?? "");
  await page.getByRole("button", { name: /Verify and continue/i }).click();

  await expect(page.getByLabel(/Signed-in email/i)).toHaveValue(email);
  await expect(page.locator("li", { hasText: /customer service representative/i })).toHaveCount(0);

  await page.getByLabel(/Role/i).selectOption("customer-service-representative");
  await page.getByRole("button", { name: /Track role/i }).click();

  await expect(page.getByText("Tracking enabled")).toBeVisible();
  await expect(page.locator("li", { hasText: /customer service representative/i })).toBeVisible();
  await expect(page.getByText(/Risk:\s+68%/i)).toBeVisible();
  await expect(
    page.getByText(/Latest change:\s+AI triage is absorbing first-line support work\./i)
  ).toBeVisible();
  await expect(page.getByText(/\(2026-04-01\)/)).toBeVisible();
  await expect(page).toHaveURL(/\/en\/watchlist$/);

  await page.reload();
  await expect(page.getByLabel(/Signed-in email/i)).toHaveValue(email);
  await expect(page.locator("li", { hasText: /customer service representative/i })).toBeVisible();
  await expect(page.getByText(/Risk:\s+68%/i)).toBeVisible();
  await expect(
    page.getByText(/Latest change:\s+AI triage is absorbing first-line support work\./i)
  ).toBeVisible();
  await expect(page.getByText(/\(2026-04-01\)/)).toBeVisible();
  await expect(page).toHaveURL(/\/en\/watchlist$/);
});
