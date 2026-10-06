import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator('nav .nav-item[aria-label="My Work"]').click();
});

test("Demo quick add schedules to the day being viewed and exposes parsed times", async ({ page }) => {
  await page.getByRole("button", { name: "Tomorrow, Oct 4", exact: true }).click();
  await page.getByLabel("Quick add task", { exact: true }).fill("Prepare retry deployment 14:30");
  await expect(page.locator("#demo-quick-target")).toHaveText("Prepare retry deployment · 2025-10-04 at 14:30");
  await page.getByRole("button", { name: "Add task to plan", exact: true }).click();
  await expect(page.locator(".task-row").filter({ hasText: "Prepare retry deployment" })).toContainText("14:30");
  await page.getByRole("button", { name: "Today, Oct 3", exact: true }).click();
  await expect(page.locator(".task-row").filter({ hasText: "Prepare retry deployment" })).toHaveCount(0);
  await page.getByLabel("Quick add task", { exact: true }).fill("Review retry contract tomorrow 2:45pm");
  await expect(page.locator("#demo-quick-target")).toContainText("2025-10-04 at 14:45");
});

test("Demo backlog creates unscheduled tasks, filters by title and discloses completed work", async ({ page }) => {
  await page.getByRole("button", { name: "Backlog", exact: true }).first().click();
  await page.getByLabel("Quick add task", { exact: true }).fill("Investigate graceful worker shutdown");
  await expect(page.locator("#demo-quick-target")).toContainText("Backlog");
  await page.getByRole("button", { name: "Add task to plan", exact: true }).click();
  await page.getByLabel("Search backlog", { exact: true }).fill("worker shutdown");
  const row = page.locator(".task-row");
  await expect(row).toHaveCount(1);
  await row.locator(".check-button").click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "Show completed", exact: true }).click();
  await expect(row).toHaveCount(1);
  await expect(row).toHaveClass(/completed/);
  await page.getByLabel("Search backlog", { exact: true }).fill("does not exist");
  await expect(page.getByRole("heading", { name: "No matching unscheduled work" })).toBeVisible();
  await page.getByRole("button", { name: "Clear backlog search", exact: true }).click();
  await expect(page.getByLabel("Search backlog", { exact: true })).toHaveValue("");
});

test("Demo quick add retains an invalid date draft and supports mouse submission", async ({ page }) => {
  await page.getByLabel("Quick add task", { exact: true }).fill("Read retry policy 2025-02-30");
  await expect(page.locator("#demo-quick-target")).toContainText("Enter a valid date");
  await page.getByRole("button", { name: "Add task to plan", exact: true }).click();
  await expect(page.getByLabel("Quick add task", { exact: true })).toHaveValue("Read retry policy 2025-02-30");
  await page.getByLabel("Quick add task", { exact: true }).fill("Review PAY-382 tomorrow 2pm");
  await page.getByRole("button", { name: "Add task to plan", exact: true }).click();
  await page.getByRole("button", { name: "Tomorrow, Oct 4", exact: true }).click();
  await expect(page.locator(".task-row").filter({ hasText: "PAY-382" })).toContainText("14:00");
});

test("Quick create can reference an existing issue in a document without scheduling the issue instead", async ({ page }) => {
  await page.keyboard.press("Control+n");
  await page.getByRole("button", { name: "Document", exact: true }).click();
  await page.getByLabel("New item title").fill("PAY-382 retry checklist");
  await page.getByRole("button", { name: /Create document/ }).click();
  await expect(page.getByRole("heading", { name: "PAY-382 retry checklist", exact: true })).toBeVisible();
});
