import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";
async function setup(page, theme = "light") {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00+09:00"));
  await installConnected(page);
  await expect(page.locator(".live-inbox .inbox-work")).toHaveCount(2);
  if (theme === "dark") await page.getByLabel("Toggle theme").click();
  await page.evaluate(() => document.fonts.ready);
}
async function operable(locator) {
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect(), main = document.querySelector("main").getBoundingClientRect();
    return r.top >= main.top && r.bottom <= main.bottom && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
}
for (const [width, height] of [[1440, 900], [980, 720]]) for (const theme of ["light", "dark"]) {
  test(`Home exposes work decisions and agenda entry at ${width} · ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await setup(page, theme);
    const queue = page.getByRole("complementary", { name: "Work queue" });
    const firstWork = queue.locator(".queue-work-title").first();
    expect((await firstWork.boundingBox()).y).toBeLessThanOrEqual(300);
    await expect.poll(() => operable(queue.getByRole("button", { name: "Review changes", exact: true }))).toBe(true);
    await expect.poll(() => operable(queue.locator(".is-overdue").getByRole("button", { name: "Today", exact: true }))).toBe(true);
    await expect.poll(() => operable(page.getByLabel("Quick add personal work"))).toBe(true);
    expect(await firstWork.locator("b").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(13);
    expect(await firstWork.locator("small").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(11);
    expect((await page.locator(".plan-empty").boundingBox()).height).toBeLessThan(120);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await queue.locator(".is-overdue").getByRole("button", { name: "Today", exact: true }).press("Enter");
    await expect(page.getByRole("region", { name: "Personal agenda" })).toContainText("PAY-382 Payment retry implementation");
    await expect(queue.locator(".is-overdue").getByRole("button", { name: "In Today", exact: true })).toBeDisabled();
  });
}
test("Today prioritizes the timed personal agenda and preserves editing and completion controls", async ({ page }) => {
  await setup(page);
  await page.locator('nav .nav-item[aria-label="My Work"]').click();
  const add = async (value, kind = "task") => {
    await page.getByLabel("Personal item type").selectOption(kind);
    await page.getByLabel("Quick add personal work").fill(value);
    await page.getByRole("button", { name: "Add to plan", exact: true }).press("Enter");
  };
  await add("Release checklist 2pm"); await add("Backend sync 10am", "event");
  const agenda = page.getByRole("region", { name: "Personal agenda" }), queue = page.getByRole("complementary", { name: "Work queue" });
  await expect(agenda.locator(".plan-task").first()).toContainText("Backend sync");
  expect((await agenda.boundingBox()).x + (await agenda.boundingBox()).width).toBeLessThan((await queue.boundingBox()).x);
  await page.setViewportSize({ width: 980, height: 720 });
  expect((await agenda.boundingBox()).y).toBeLessThan((await queue.locator(".attention-content").boundingBox()).y);
  await page.getByLabel("Edit plan for Release checklist", { exact: true }).press("Enter");
  await page.getByLabel("Personal work title", { exact: true }).fill("Release checklist draft");
  await page.keyboard.press("Escape");
  await page.locator('nav .nav-item[aria-label="Home"]').click();
  await page.locator('nav .nav-item[aria-label="My Work"]').click();
  await page.getByLabel("Edit plan for Release checklist", { exact: true }).click();
  await expect(page.getByLabel("Personal work title", { exact: true })).toHaveValue("Release checklist draft");
  await page.getByRole("button", { name: "Save personal work", exact: true }).click();
  await page.getByLabel("Complete Backend sync", { exact: true }).press("Space");
  await expect(page.getByLabel("Reopen Backend sync", { exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Undo completion", exact: true }).click();
  await expect(page.getByLabel("Complete Backend sync", { exact: true })).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.__fixture.calls.filter(c => ["jira.edit", "jira.transition", "gitlab.comment", "gitlab.approve"].includes(c.action)))).toEqual([]);
});

test("Home keeps its service stack independent of a long agenda, and More preserves row geometry", async ({ page }) => {
  await setup(page);
  const feedOffset = async () => (await page.locator(".live-inbox").boundingBox()).y - (await page.locator(".attention-content").boundingBox()).y;
  const feedBefore = await feedOffset();
  for (let i = 1; i <= 8; i++) {
    await page.getByLabel("Quick add personal work").fill(`Release preparation ${i}`);
    await page.getByRole("button", { name: "Add to plan", exact: true }).click();
  }
  expect(await feedOffset()).toBe(feedBefore);
  const first = page.locator(".plan-task").first();
  expect((await first.boundingBox()).height).toBeLessThanOrEqual(68);
  const more = page.getByLabel("More planning actions for Release preparation 1", { exact: true });
  for (const [width, height] of [[1440, 900], [980, 720]]) {
    await page.setViewportSize({ width, height });
    const before = await first.boundingBox();
    await more.press("Enter");
    const time = page.getByLabel("Time for Release preparation 1", { exact: true });
    await expect(time).toBeVisible();
    await time.fill("14:30");
    expect((await first.boundingBox()).height).toBe(before.height);
    await time.press("Escape");
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute("aria-expanded", "false");
  }
  expect(await page.evaluate(() => window.__fixture.calls.some(c => ["jira.edit", "jira.transition", "gitlab.approve"].includes(c.action)))).toBe(false);
});
