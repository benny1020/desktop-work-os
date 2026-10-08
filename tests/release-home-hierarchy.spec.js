import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";
async function setup(page, preferences) {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00+09:00"));
  if (preferences) await page.addInitScript(value => localStorage.setItem("orbit-prefs", JSON.stringify(value)), preferences);
  await installConnected(page);
  await expect(page.locator(".live-inbox .inbox-work")).toHaveCount(2);
}
async function expectOperableInFirstFold(locator) {
  expect(await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const main = document.querySelector("main").getBoundingClientRect();
    return rect.top >= main.top && rect.bottom <= main.bottom &&
      element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  })).toBe(true);
}
for (const theme of ["light", "dark"]) {
  test(`Home review and deadline actions appear in first fold at 980×720 · ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 980, height: 720 });
    await setup(page);
    if (theme === "dark") await page.getByLabel("Toggle theme").click();
    await expectOperableInFirstFold(page.getByRole("button", { name: "Review changes", exact: true }));
    const overdue = page.locator(".daily-brief .attention-row").filter({ hasText: "Overdue" });
    await expectOperableInFirstFold(overdue.getByRole("button", { name: "Today", exact: true }));
    await page.getByRole("button", { name: "Review changes", exact: true }).click();
    await expect(page.getByRole("group", { name: "Dependency flow diagram" })).toBeVisible();
  });
  test(`Wide Home keeps planning and attention side by side · ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setup(page);
    if (theme === "dark") await page.getByLabel("Toggle theme").click();
    const plan = await page.locator(".daily-plan").boundingBox();
    const attention = await page.locator(".daily-brief").boundingBox();
    expect(attention.x + attention.width).toBeLessThan(plan.x);
    await expectOperableInFirstFold(page.getByRole("button", { name: "Review changes", exact: true }));
    await page.getByRole("button", { name: "Plan your first item", exact: true }).click();
    await expect(page.getByLabel("Quick add personal work")).toBeFocused();
  });
}
test("Disabled attention categories keep available work and saved planning intact", async ({ page }) => {
  await setup(page, { reviews: false, deadlines: false, digest: false });
  await expect(page.locator(".daily-brief .attention-row")).toHaveCount(0);
  await expect(page.locator(".daily-brief .attention-content h2 .pill")).toHaveText("0");
  await expect(page.getByRole("region", { name: "Assistant brief", exact: true })).toHaveCount(0);
  await expect(page.locator(".daily-day-summary")).not.toContainText("review requested");
  await expect(page.locator(".live-inbox")).toContainText("PAY-382 Payment retry review");
  await expect(page.locator(".live-inbox")).toContainText("Jira due 2026-10-04");
  await page.getByLabel("Quick add personal work").fill("Keep my planning draft");
  await page.locator('nav .nav-item[aria-label="My Work"]').click();
  await expect(page.locator(".daily-brief .attention-row")).toHaveCount(0);
  await page.getByLabel("Quick add personal work").fill("Keep my personal plan");
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
  await page.locator('nav .nav-item[aria-label="Home"]').click();
  await expect(page.getByLabel("Quick add personal work")).toHaveValue("Keep my planning draft");
  await expect(page.locator(".daily-plan")).toContainText("Keep my personal plan");
  await page.reload();
  await expect(page.locator(".daily-plan")).toContainText("Keep my personal plan");
  await expect(page.locator(".daily-brief .attention-row")).toHaveCount(0);
  expect(await page.evaluate(() => window.__fixture.calls.some(call => ["jira.edit", "jira.transition", "gitlab.approve"].includes(call.action)))).toBe(false);
});
test("Review alerts off still surface the next deadline and keep My Reviews available", async ({ page }) => {
  await setup(page, { reviews: false, deadlines: true, digest: true });
  await expect(page.locator(".daily-brief .attention-content h2 .pill")).toHaveText("1");
  await expect(page.locator(".daily-brief .attention-row")).toHaveCount(1);
  await expect(page.locator(".daily-brief .attention-recommended")).toContainText("Payment retry implementation");
  await expect(page.getByRole("region", { name: "Assistant brief", exact: true })).toBeVisible();
  await page.locator('nav .nav-item[aria-label="Code"]').click();
  await page.locator("nav .subnav button").filter({ hasText: /^My Reviews$/ }).click();
  await expect(page.getByRole("button", { name: /PAY-382 Payment retry review/ })).toBeVisible();
});
