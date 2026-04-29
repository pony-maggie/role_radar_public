import { expect, test } from "@playwright/test";

test("role detail page shows percentage hero and unified timeline", async ({ page }) => {
  await page.goto("/en/roles/customer-service-representative");

  await expect(page.getByText(/AI replacement rate/i)).toBeVisible();
  await expect(page.locator(".hero-percentage").filter({ hasText: "68%" })).toBeVisible();
  await expect(
    page.getByText("Support triage and resolution workflows are increasingly routed through AI-first systems.")
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Why this role is rated this way/i })).toBeVisible();
  await expect(page.getByText("Structured language work")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Timeline/i })).toBeVisible();
  await expect(page.getByText(/^Source$/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Support operations automation specialist/i })).toBeVisible();
  await expect(page.getByText(/OpenAI Careers/i)).toBeVisible();
  await expect(page.getByText(/openai\.com/i).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Open original/i }).first()).toBeVisible();
  await expect(
    page.getByText("The job listing shows support work shifting toward automation management.").first()
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Replacement trend/i })).toBeVisible();
  const weekButton = page.getByRole("button", { name: /Week/i });
  const monthButton = page.getByRole("button", { name: /Month/i });
  const trendSection = page.getByRole("heading", { name: /Replacement trend/i }).locator("xpath=ancestor::section[1]");
  const firstTrendRow = trendSection.getByRole("listitem").first();

  await expect(weekButton).toBeVisible();
  await expect(monthButton).toBeVisible();
  await expect(weekButton).toHaveAttribute("aria-pressed", "true");
  const weekFirstRowText = await firstTrendRow.textContent();
  await monthButton.click();
  await expect(monthButton).toHaveAttribute("aria-pressed", "true");
  await expect(firstTrendRow).not.toHaveText(weekFirstRowText ?? "");
  await expect(page.getByText(/Why it matters/i)).toHaveCount(0);
  await expect(page.getByText(/No role-specific source items are attached yet/i)).toHaveCount(0);
});

test("role detail page shows localized zh copy", async ({ page }) => {
  await page.goto("/zh/roles/customer-service-representative");

  await expect(page.getByText("AI 替代率")).toBeVisible();
  await expect(page.locator(".hero-percentage").filter({ hasText: "68%" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "为什么是这个等级" })).toBeVisible();
  await expect(page.getByText("结构化语言工作")).toBeVisible();
  await expect(page.getByRole("heading", { name: "时间线" })).toBeVisible();
  await expect(page.getByText(/^来源$/).first()).toBeVisible();
  await expect(page.getByText(/OpenAI Careers/i)).toBeVisible();
  await expect(page.getByText("这条招聘信息显示客户支持工作正在向自动化管理迁移。").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "替代率趋势" })).toBeVisible();
  await expect(page.getByRole("button", { name: "周" })).toBeVisible();
  await expect(page.getByRole("button", { name: "月" })).toBeVisible();
});

test("dictionary-backed role pages render a profile-based replacement estimate", async ({ page }) => {
  await page.goto("/en/roles/actors");

  await expect(page.getByRole("heading", { name: /Actors/i })).toBeVisible();
  await expect(page.getByText(/AI replacement rate/i)).toBeVisible();
  await expect(page.getByText(/%/).first()).toBeVisible();
});

test("zh role detail localizes office-support titles and shows related roles", async ({ page }) => {
  await page.goto("/zh/roles/office-and-administrative-support-workers-all-other");

  await expect(page.getByRole("heading", { name: "其他办公室与行政支持人员" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "相关岗位" })).toBeVisible();
  await expect(page.getByRole("link", { name: /办公室与行政支持人员一线主管/ })).toBeVisible();
});
