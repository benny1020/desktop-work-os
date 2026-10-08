import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";

test("Escape closes the nested assistant before discarding the retained object context", async ({ page }) => {
  await installConnected(page);
  await page.locator(".attention-row").getByRole("button", { name: /Payment retry review/ }).click();
  await page.keyboard.press("Meta+j");
  await expect(page.locator(".object-panel").getByLabel("Ask Claude")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".object-panel .live-assistant")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Dependency flow diagram" })).toBeVisible();
});

test("Closing an object opened from notifications restores a surviving keyboard target", async ({ page }) => {
  await installConnected(page);
  await page.getByLabel("Notifications", { exact: true }).click();
  await page.getByLabel("Connected attention center").getByRole("button", { name: /Payment retry review/ }).click();
  await expect(page.getByRole("group", { name: "Dependency flow diagram" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Notifications", { exact: true })).toBeFocused();
});

test("Global search is available from a connected preview and preserves that preview", async ({ page }) => {
  await installConnected(page);
  await page.locator(".attention-row").getByRole("button", { name: /Payment retry review/ }).click();
  await page.keyboard.press("Meta+k");
  await expect(page.getByLabel("Connected global search")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("group", { name: "Dependency flow diagram" })).toBeVisible();
});

test("A search result joins the current context stack and Back returns to the reviewed MR", async ({ page }) => {
  await installConnected(page);
  await page.locator(".attention-row").getByRole("button", { name: /Payment retry review/ }).click();
  await page.keyboard.press("Meta+k");
  await page.getByLabel("Connected global search").fill("PAY-382");
  await page.locator("[cmdk-item]").filter({ hasText: "PAY-382 Payment retry implementation" }).click();
  await expect(page.getByLabel("Live issue inspector")).toBeVisible();
  await expect(page.locator(".object-panel-header")).toContainText("2 contexts");
  await page.getByLabel("Back in context").click();
  await expect(page.getByRole("group", { name: "Dependency flow diagram" })).toBeVisible();
  await expect(page.locator(".object-panel-header")).toContainText("Payment retry review");
  await expect(page.locator(".object-panel-header")).toContainText("Quick preview");
});
