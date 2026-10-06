import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-06T12:00:00+09:00"));
  await installConnected(page);
});
const nav = async (page, view) => {
  const entry = page.locator("nav .subnav button").filter({ hasText: new RegExp(`^${view}$`) });
  if (!(await entry.count())) await page.locator('nav .nav-item[aria-label="My Work"]').click();
  await entry.click();
};
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("orbit.connected.plan.v1"))?.tasks || []);
async function add(page, text) {
  await page.getByLabel("Quick add personal work").fill(text);
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
}
async function noExternalWrites(page) {
  expect(await page.evaluate(() => window.__fixture.calls.filter(({ action }) => /^(jira\.(edit|transition|comment|moveSprint)|gitlab\.(comment|approve)|claude\.)/.test(action)))).toEqual([]);
}
const issueRow = (page) => page.locator('.live-inbox [data-linked-work="PAY-382"]');

test("Sidebar Today restores today's work while Calendar retains its exact month context", async ({ page }) => {
  const today = await page.getByLabel("Planning date").inputValue();
  await add(page, "Daily priority");
  await page.getByRole("button", { name: "Calendar", exact: true }).first().click();
  await page.getByLabel("Calendar range").selectOption("Month");
  await page.getByLabel("Planning date").fill("2026-11-12");
  await nav(page, "Today");
  await expect(page.getByLabel("Planning date")).toHaveValue(today);
  await expect(page.locator(".plan-task")).toContainText("Daily priority");
  await nav(page, "Calendar");
  await expect(page.getByLabel("Planning date")).toHaveValue("2026-11-12");
  await expect(page.getByLabel("Calendar range")).toHaveValue("Month");
  await noExternalWrites(page);
});

test("Remounting Today through another section starts at today without discarding the Calendar range", async ({ page }) => {
  await nav(page, "Today");
  const today = await page.getByLabel("Planning date").inputValue();
  await add(page, "Review before standup");
  await page.getByLabel("Planning date").fill("2026-11-12");
  await page.locator('nav .nav-item[aria-label="Projects"]').click();
  await nav(page, "Today");
  await expect(page.getByLabel("Planning date")).toHaveValue(today);
  await expect(page.locator(".plan-task")).toContainText("Review before standup");
});

test("Clicking sidebar Today again recovers today from a manually advanced date", async ({ page }) => {
  await nav(page, "Today");
  const today = await page.getByLabel("Planning date").inputValue();
  await add(page, "Visible daily priority");
  await page.getByLabel("Next planning period").click();
  await expect(page.locator(".plan-task")).toHaveCount(0);
  await nav(page, "Today");
  await expect(page.getByLabel("Planning date")).toHaveValue(today);
  await expect(page.locator(".plan-task")).toContainText("Visible daily priority");
});

test("Undo deletion keeps a replacement linked task instead of creating an unfinished duplicate", async ({ page }) => {
  await issueRow(page).getByRole("button", { name: "Add to Today", exact: true }).click();
  await page.getByLabel("Edit plan for PAY-382 Payment retry implementation", { exact: true }).click();
  await page.getByRole("button", { name: "Delete personal work", exact: true }).click();
  await issueRow(page).getByRole("button", { name: "Add to Today", exact: true }).click();
  await page.getByLabel("Time for PAY-382 Payment retry implementation", { exact: true }).fill("14:30");
  const replacement = (await stored(page))[0];
  await page.getByRole("button", { name: "Undo removal", exact: true }).click();
  expect(await stored(page)).toEqual([replacement]);
  await expect(page.locator(".plan-notice")).toContainText("removed copy was not restored");
  await noExternalWrites(page);
});

test("Reopening completed linked work cannot duplicate a newer unfinished plan", async ({ page }) => {
  await issueRow(page).getByRole("button", { name: "Add to Today", exact: true }).click();
  const first = (await stored(page))[0].id;
  await page.getByLabel("Complete PAY-382 Payment retry implementation", { exact: true }).click();
  await issueRow(page).getByRole("button", { name: "Add to Today", exact: true }).click();
  const replacement = (await stored(page)).find((task) => !task.done);
  await page.locator(`[data-plan-task-id="${first}"]`).getByRole("button", { name: "Reopen PAY-382 Payment retry implementation", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("already has an unfinished item");
  const all = await stored(page);
  expect(all.find((task) => task.id === first).done).toBe(true);
  expect(all.filter((task) => !task.done)).toEqual([replacement]);
  await noExternalWrites(page);
});

test("All loaded review requests are reachable from Home and can be placed directly in a selected week day", async ({ page }) => {
  await page.evaluate(() => {
    const original = window.__fixture.invoke.bind(window.__fixture);
    window.__fixture.invoke = async (action, args) => {
      const result = await original(action, args);
      if (action === "gitlab.mrs") return { ...result, items: Array.from({ length: 8 }, (_, index) => ({ ...result.items[0], id: 100 + index, iid: 20 + index, title: `Review payment change ${index + 1}` })) };
      return result;
    };
  });
  await page.getByRole("button", { name: "Refresh work", exact: true }).click();
  await expect(page.locator(".daily-brief .attention-row").filter({ hasText: "Review payment change 8" })).toHaveCount(0);
  await page.getByRole("button", { name: "Show 3 more attention items", exact: true }).click();
  await expect(page.locator(".daily-brief .attention-row").filter({ hasText: "Review payment change 8" })).toBeVisible();
  await page.getByRole("button", { name: "This Week", exact: true }).first().click();
  await page.getByLabel("Planning date").fill("2026-10-09");
  await expect(page.locator(".available-review")).toHaveCount(8);
  const row = page.locator('.live-inbox [data-linked-work="mr:42:27"]');
  await row.getByRole("button", { name: "Add review to 2026-10-09", exact: true }).click();
  expect((await stored(page)).find((task) => task.object?.iid === 27)).toMatchObject({ date: "2026-10-09", object: { type: "mr", projectId: 42, iid: 27 } });
  await expect(page.getByRole("region", { name: "Plan for 2026-10-09", exact: true })).toContainText("Review payment change 8");
  await noExternalWrites(page);
});

test("Calendar Plan here targets a specific adjacent month day for available issue and review work", async ({ page }) => {
  await page.getByRole("button", { name: "Calendar", exact: true }).first().click();
  await page.getByLabel("Planning date").fill("2026-10-15");
  await page.getByLabel("Calendar range").selectOption("Month");
  await page.getByRole("region", { name: "Plan for 2026-09-28", exact: true }).getByRole("button", { name: "+ Plan here", exact: true }).click();
  await issueRow(page).getByRole("button", { name: "Add to 2026-09-28", exact: true }).click();
  await page.locator('.live-inbox [data-linked-work="mr:42:7"]').getByRole("button", { name: "Add review to 2026-09-28", exact: true }).click();
  expect((await stored(page)).map((task) => task.date)).toEqual(["2026-09-28", "2026-09-28"]);
  await expect(page.getByLabel("Planning date")).toHaveValue("2026-10-15");
  await noExternalWrites(page);
});

test("Row Tomorrow provides guarded undo and keeps edits made after the move", async ({ page }) => {
  const today = await page.getByLabel("Planning date").inputValue();
  await add(page, "Review retry semantics");
  await page.getByLabel("Tomorrow Review retry semantics", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo schedule move", exact: true })).toBeVisible();
  await expect(page.locator(".plan-notice")).toContainText("Moved Review retry semantics");
  await page.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  expect((await stored(page))[0].date).toBe(today);
  await page.getByLabel("Tomorrow Review retry semantics", { exact: true }).click();
  await page.getByLabel("Next planning period").click();
  await page.getByLabel("Time for Review retry semantics", { exact: true }).fill("14:30");
  const changed = (await stored(page))[0];
  await page.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  expect((await stored(page))[0]).toEqual(changed);
});

test("Chronological drag explains why differently timed tasks cannot be reordered", async ({ page }) => {
  await add(page, "Morning retry review 9am");
  await add(page, "Untimed release checklist");
  const before = await stored(page);
  await page.locator(".plan-task").filter({ hasText: "Untimed release checklist" }).dragTo(page.locator(".plan-task").filter({ hasText: "Morning retry review" }));
  expect(await stored(page)).toEqual(before);
  await expect(page.locator(".plan-notice")).toContainText("Timed items stay in chronological order");
  await expect(page.locator(".plan-task-main > button")).toHaveText(["09:00Morning retry review", "Untimed release checklist"]);
});

test("An exact loaded Jira key quick entry creates one linked task and reschedules it with guarded undo", async ({ page }) => {
  await expect(issueRow(page)).toBeVisible();
  await page.getByLabel("Quick add personal work").fill("PAY-382 tomorrow 2pm");
  await expect(page.locator("#plan-quick-target")).toContainText("Linked Jira task · PAY-382 Payment retry implementation");
  await add(page, "PAY-382 tomorrow 2pm");
  const first = (await stored(page))[0];
  expect(first).toMatchObject({ title: "PAY-382 Payment retry implementation", time: "14:00", object: { type: "issue", key: "PAY-382", origin: "https://jira.fixture.test" } });
  await page.getByLabel("Quick add personal work").fill("PAY-382 2026-10-09 11am");
  await expect(page.locator("#plan-quick-target")).toContainText(`Move existing plan from ${first.date} to 2026-10-09 at 11:00`);
  await add(page, "PAY-382 2026-10-09 11am");
  expect(await stored(page)).toHaveLength(1);
  expect((await stored(page))[0]).toMatchObject({ id: first.id, date: "2026-10-09", time: "11:00" });
  await page.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  expect((await stored(page))[0]).toEqual(first);
  await page.getByLabel("Quick add personal work").fill("PAY-38 tomorrow");
  await expect(page.locator("#plan-quick-target")).toContainText("Personal task · PAY-38");
  await add(page, "PAY-38 tomorrow");
  expect((await stored(page)).find((task) => task.title === "PAY-38").object).toBeUndefined();
  await noExternalWrites(page);
});

test("Undo drag scheduling restores the original backlog order without overwriting a newer reorder", async ({ page }) => {
  await page.getByRole("button", { name: "Backlog", exact: true }).first().click();
  for (const title of ["Review retry budget", "Check worker shutdown", "Write deployment notes"]) await add(page, title);
  const original = await stored(page);
  await page.getByRole("button", { name: "This Week", exact: true }).first().click();
  const target = page.getByRole("region", { name: "Plan for 2026-10-07", exact: true });
  const row = (id) => page.locator(`[data-plan-task-id="${id}"]`);
  await row(original[0].id).dragTo(target);
  await page.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  expect(await stored(page)).toEqual(original);
  await row(original[0].id).dragTo(target);
  await row(original[2].id).dragTo(row(original[1].id));
  const newerOrder = (await stored(page)).map((task) => task.id);
  await page.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  expect((await stored(page)).map((task) => task.id)).toEqual(newerOrder);
  expect((await stored(page)).find((task) => task.id === original[0].id).date).toBe("");
});

test("Weekly linked tasks distinguish the Jira deadline from a later local schedule", async ({ page }) => {
  await page.getByRole("button", { name: "This Week", exact: true }).first().click();
  await page.getByLabel("Planning date").fill("2026-10-09");
  await issueRow(page).getByRole("button", { name: "Add to 2026-10-09", exact: true }).click();
  const task = page.locator(".planning-grid .plan-task");
  await expect(task).toContainText("Jira due 2026-10-04");
  await expect(task).toContainText("Planned after deadline");
  await expect(issueRow(page)).toContainText("Planned after deadline");
  const current = await stored(page);
  expect(current[0].date).toBe("2026-10-09");
  expect(await page.evaluate(() => window.__fixture.issue.fields.duedate)).toBe("2026-10-04");
  await noExternalWrites(page);
  await page.screenshot({ path: "artifacts/todo-planning-deadline-1440.png", animations: "disabled" });
  await page.setViewportSize({ width: 980, height: 720 });
  await page.getByLabel("Toggle theme").click();
  const darkText = await page.evaluate(() => getComputedStyle(document.documentElement).color);
  await expect.poll(() => task.locator(".plan-task-main > button").evaluate((element) => getComputedStyle(element).color)).toBe(darkText);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/todo-planning-deadline-980.png", animations: "disabled" });
});

test("Storage failure during linked quick scheduling retains the old record and input draft", async ({ page }) => {
  await expect(issueRow(page)).toBeVisible();
  await add(page, "PAY-382 tomorrow 2pm");
  const before = await stored(page);
  await page.getByLabel("Quick add personal work").fill("PAY-382 2026-10-09 11am");
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw Error("Storage is full"); }; });
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Storage is full");
  await expect(page.getByLabel("Quick add personal work")).toHaveValue("PAY-382 2026-10-09 11am");
  expect(await stored(page)).toEqual(before);
});
