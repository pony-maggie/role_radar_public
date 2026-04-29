import { expect, test } from "@playwright/test";

test("diagnostics page shows classified source item metadata without review actions", async ({ page }) => {
  await page.goto("/en/sources?reviewToken=playwright-review-token");

  await expect(page.getByRole("heading", { name: /Inference diagnostics/i })).toBeVisible();
  const firstCard = page.locator("article").first();
  await expect(firstCard).toBeVisible();
  await expect(
    firstCard.getByText(/(?:gemini|google|minimax|fallback)\s*\/\s*[\w.-]+|N\/A/i)
  ).toBeVisible();
  await expect(firstCard.getByText(/INCREASE|MAINTAIN|DECREASE|N\/A/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Approve/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Reject/i })).toHaveCount(0);
});
