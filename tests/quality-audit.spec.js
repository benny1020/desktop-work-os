import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";

test.use({ viewport: { width: 980, height: 650 } });

test("Opening a review from below the fold starts at its title and navigation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Review changes/ }).click();
  await expect(page.getByRole("heading", { name: "Fix order status mapping", exact: true })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Review overview", exact: true })).toBeInViewport();
  await expect.poll(() => page.locator(".main-content").evaluate((element) => element.scrollTop)).toBe(0);
});

test("Context assistant leaves the preview header close action usable at minimum window size", async ({ page }) => {
  await installConnected(page);
  await page.locator(".attention-row").getByRole("button", { name: /Payment retry review/ }).click();
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await expect(page.getByLabel("Ask Claude")).toBeInViewport();
  await expect(page.getByLabel("Close context preview")).toBeInViewport();
  await page.getByLabel("Close context preview").click({ timeout: 5000 });
  await expect(page.locator(".object-panel")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your workday", exact: true })).toBeVisible();
});

test("Expanded code navigation keeps settings and sidebar collapse in view", async ({ page }) => {
  await page.goto("/");
  await page.locator('nav .nav-item[aria-label="Code"]').click();
  await expect(page.getByLabel("Collapse sidebar", { exact: true })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeInViewport();
  await page.getByLabel("Collapse sidebar", { exact: true }).click();
  await expect(page.locator(".app")).toHaveClass(/sidebar-collapsed/);
  await expect(page.getByLabel("Expand sidebar", { exact: true })).toBeInViewport();
});
