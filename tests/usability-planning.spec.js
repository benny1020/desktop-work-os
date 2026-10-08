import { test, expect } from "@playwright/test";
import { revealPlanningActions } from "./fixtures/planning-controls.mjs";
import { installConnected } from "./fixtures/connected.mjs";

test.beforeEach(async ({ page }) => installConnected(page));
async function add(page, text) {
  await page.getByLabel("Quick add personal work").fill(text);
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
}

test("Keyboard completion and same-time reorder retain focus and visible order", async ({ page }) => {
  await add(page, "Retry implementation");
  await add(page, "Check idempotency");
  await page.getByLabel("Complete Retry implementation", { exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Reopen Retry implementation", { exact: true })).toBeFocused();
  await revealPlanningActions(page, 'Check idempotency');
  const move = page.getByLabel("Move up Check idempotency", { exact: true });
  await move.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".plan-task-main > button")).toHaveText(["Check idempotency", "Retry implementation"]);
  await expect(move).toBeFocused();
  await expect(move).toBeDisabled();
  await revealPlanningActions(page, 'Check idempotency');
  await page.getByLabel("Move down Check idempotency", { exact: true }).click();
  await expect(page.locator(".plan-task-main > button")).toHaveText(["Retry implementation", "Check idempotency"]);
});

test("Editing a time preserves the active input while chronological order updates", async ({ page }) => {
  await add(page, "Review retry 2pm");
  await add(page, "Daily standup 9am");
  await revealPlanningActions(page, 'Review retry');
  const input = page.getByLabel("Time for Review retry", { exact: true });
  await input.focus();
  await input.fill("08:30");
  await expect(input).toBeFocused();
  await expect(page.locator(".plan-task-main > button").first()).toHaveText("Review retry");
  await expect(page.locator(".plan-task").first().locator(".plan-task-compact-meta time")).toHaveText("08:30");
  // Events with different times cannot be misleadingly moved out of chronological order.
  await revealPlanningActions(page, 'Daily standup');
  await expect(page.getByLabel("Move up Daily standup", { exact: true })).toBeDisabled();
});

test("Plan here focuses entry and schedules an adjacent-month day without losing month context", async ({ page }) => {
  await page.getByRole("button", { name: "Calendar", exact: true }).first().click();
  await page.getByLabel("Planning date").fill("2026-10-15");
  await page.getByLabel("Calendar range").selectOption("Month");
  const previousMonth = page.getByRole("region", { name: "Plan for 2026-09-28", exact: true });
  await previousMonth.getByRole("button", { name: "+ Plan here", exact: true }).click();
  await expect(page.getByLabel("Quick add personal work")).toBeFocused();
  await expect(page.getByLabel("Planning date")).toHaveValue("2026-10-15");
  await expect(page.locator("#plan-quick-target")).toContainText("2026-09-28");
  await add(page, "September retrospective");
  await expect(previousMonth).toContainText("September retrospective");
  await expect(page.locator(".planning-grid section")).toHaveCount(42);
});

test("Linked work can be removed from the local plan without changing Jira", async ({ page }) => {
  await page.locator(".live-inbox").getByRole("button", { name: "Add to Today", exact: true }).click();
  await page.getByLabel("Edit plan for PAY-382 Payment retry implementation", { exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete personal work", exact: true }).click();
  await expect(page.locator(".plan-task")).toHaveCount(0);
  const writes = await page.evaluate(() => window.__fixture.calls.filter(c => ["jira.edit", "jira.transition"].includes(c.action)));
  expect(writes).toEqual([]);
});

test("A failed local save keeps the draft and shows its error inside the editor", async ({ page }) => {
  await add(page, "Draft release notes");
  await page.getByLabel("Edit plan for Draft release notes", { exact: true }).click();
  await page.getByLabel("Personal work title", { exact: true }).fill("Revised release notes");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new Error("Storage is full"); };
  });
  await page.getByRole("button", { name: "Save personal work", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Storage is full");
  await expect(page.getByLabel("Personal work title", { exact: true })).toHaveValue("Revised release notes");
});

test("Weekly cards disclose controls on keyboard focus instead of filling the planning grid", async ({ page }) => {
  await add(page, "Review retry policy");
  await page.getByRole("button", { name: "This Week", exact: true }).first().click();
  await page.mouse.move(0, 0);
  const card = page.locator(".planning-grid .plan-task");
  await expect(card.locator(".plan-task-actions")).toBeHidden();
  expect((await card.boundingBox()).height).toBeLessThan(100);
  await card.getByRole("button", { name: "Complete Review retry policy", exact: true }).focus();
  await expect(card.getByLabel("Edit plan for Review retry policy", { exact: true })).toBeVisible();
  await card.getByLabel("Edit plan for Review retry policy", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
});
