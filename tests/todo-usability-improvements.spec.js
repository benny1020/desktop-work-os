import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-06T12:00:00+09:00"));
  await installConnected(page);
});
async function add(page, text) {
  await page.getByLabel("Quick add personal work").fill(text);
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
}
async function tasks(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("orbit.connected.plan.v1")).tasks);
}
async function localOnly(page) {
  expect(await page.evaluate(() => window.__fixture.calls.filter((call) => ["jira.edit", "jira.transition", "claude.chat"].includes(call.action)))).toEqual([]);
}

test("Quick entry previews the actual parsed title, date and time before saving", async ({ page }) => {
  await page.getByLabel("Quick add personal work").fill("Check payment retries tomorrow 2pm");
  const preview = page.locator("#plan-quick-target");
  const today = await page.getByLabel("Planning date").inputValue();
  const tomorrow = await page.evaluate((day) => { const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, today);
  await expect(preview).toHaveText(`Personal task · Check payment retries · ${tomorrow} at 14:00`);
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
  expect((await tasks(page))[0]).toMatchObject({ title: "Check payment retries", date: tomorrow, time: "14:00" });
  await page.getByLabel("Quick add personal work").fill("Validate retry policy 2026-02-30");
  await expect(preview).toContainText("Enter a valid date");
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Enter a valid date");
  await expect(page.getByLabel("Quick add personal work")).toHaveValue("Validate retry policy 2026-02-30");
  expect(await tasks(page)).toHaveLength(1);
  await localOnly(page);
});

test("Backlog explicitly schedules only shown unfinished work with a visible date and undo", async ({ page }) => {
  await page.getByRole("button", { name: "Backlog", exact: true }).first().click();
  await add(page, "Review retry budget");
  await add(page, "Review worker shutdown");
  await add(page, "Write deployment notes");
  await expect(page.getByRole("button", { name: "Move unfinished to next day", exact: true })).toHaveCount(0);
  await page.getByLabel("Search backlog").fill("retry");
  await expect(page.locator(".plan-task")).toHaveCount(1);
  await page.getByLabel("Planning date").fill("2026-10-09");
  await page.getByRole("button", { name: "Schedule 1 shown task for 2026-10-09", exact: true }).click();
  const stored = await tasks(page);
  expect(stored.find((task) => task.title === "Review retry budget").date).toBe("2026-10-09");
  expect(stored.filter((task) => !task.date).map((task) => task.title)).toEqual(["Review worker shutdown", "Write deployment notes"]);
  await page.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  await expect(page.locator(".plan-task")).toContainText("Review retry budget");
  await page.getByLabel("Search backlog").fill("unmatched");
  await expect(page.getByRole("heading", { name: "No matching unscheduled work" })).toBeVisible();
  await page.getByRole("button", { name: "Clear backlog search", exact: true }).click();
  await expect(page.locator(".plan-task")).toHaveCount(3);
  await localOnly(page);
});

test("Completed backlog work is disclosed on demand and can be reopened", async ({ page }) => {
  await page.getByRole("button", { name: "Backlog", exact: true }).first().click();
  await add(page, "Read the retry policy");
  await add(page, "Check deployment health");
  await page.getByLabel("Complete Read the retry policy", { exact: true }).click();
  await expect(page.locator(".plan-task")).toHaveCount(1);
  await expect(page.getByLabel("Complete Check deployment health", { exact: true })).toBeFocused();
  await page.getByLabel("Show completed (1)", { exact: true }).check();
  await page.getByLabel("Reopen Read the retry policy", { exact: true }).click();
  expect((await tasks(page)).find((task) => task.title === "Read the retry policy").done).toBe(false);
  await page.getByLabel("Show completed", { exact: true }).uncheck();
  await expect(page.locator(".plan-task")).toHaveCount(2);
});

test("Already planned linked work has explicit reschedule actions and retains its original date on undo", async ({ page }) => {
  const inbox = page.locator(".live-inbox");
  const title = "PAY-382 Payment retry implementation";
  await inbox.getByRole("button", { name: "Add to Today", exact: true }).click();
  await expect(inbox.getByRole("button", { name: "In Today", exact: true })).toBeDisabled();
  await page.getByLabel(`Date for ${title}`, { exact: true }).fill("2026-10-09");
  await expect(inbox).toContainText("Planned 2026-10-09");
  await inbox.getByRole("button", { name: "Move to Today", exact: true }).click();
  expect(await tasks(page)).toHaveLength(1);
  await page.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  expect((await tasks(page))[0].date).toBe("2026-10-09");
  await inbox.getByRole("button", { name: "Move to Backlog", exact: true }).click();
  await expect(inbox.getByRole("button", { name: "In Backlog", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  expect((await tasks(page))[0].date).toBe("2026-10-09");
  await localOnly(page);
});

test("Weekly drag scheduling and returning to backlog are reversible on the same task", async ({ page }) => {
  await page.getByRole("button", { name: "Backlog", exact: true }).first().click();
  await add(page, "Review retry contract");
  const id = (await tasks(page))[0].id;
  await page.getByRole("button", { name: "This Week", exact: true }).first().click();
  const target = page.locator(".planning-grid section").nth(2);
  const targetDate = (await target.getAttribute("aria-label")).replace("Plan for ", "");
  await page.locator(`[data-plan-task-id="${id}"]`).dragTo(target);
  expect((await tasks(page))[0].date).toBe(targetDate);
  await page.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  await expect(page.getByRole("region", { name: "Unscheduled work" })).toContainText("Review retry contract");
  await page.locator(`[data-plan-task-id="${id}"]`).dragTo(target);
  await page.locator(`[data-plan-task-id="${id}"]`).dragTo(page.getByRole("region", { name: "Unscheduled work" }));
  expect((await tasks(page))[0]).toMatchObject({ id, date: "" });
  await page.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  expect((await tasks(page))[0]).toMatchObject({ id, date: targetDate });
  await localOnly(page);
});

test("Schedule undo preserves a task edited after its move while restoring unchanged tasks", async ({ page }) => {
  const today = await page.getByLabel("Planning date").inputValue();
  await add(page, "Review retry logic 10am");
  await add(page, "Prepare deployment checklist");
  await page.getByRole("button", { name: "Move unfinished to next day", exact: true }).click();
  const movedDate = await page.getByLabel("Planning date").inputValue();
  await page.getByLabel("Time for Review retry logic", { exact: true }).fill("14:30");
  await page.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  const stored = await tasks(page);
  expect(stored.find((task) => task.title === "Review retry logic")).toMatchObject({ date: movedDate, time: "14:30" });
  expect(stored.find((task) => task.title === "Prepare deployment checklist").date).toBe(today);
  await expect(page.locator(".plan-notice")).toContainText("1 task restored");
  await localOnly(page);
});

test("Backlog triage and weekly planning stay legible at desktop light and narrow dark widths", async ({ page }) => {
  await page.getByRole("button", { name: "Backlog", exact: true }).first().click();
  await add(page, "Review payment retry idempotency and worker shutdown behavior");
  await add(page, "Prepare deployment notes");
  await page.getByLabel("Quick add personal work").fill("Draft API contract tomorrow 2pm");
  for (const [width, height] of [[1440, 900], [980, 720]]) {
    await page.setViewportSize({ width, height });
    if (width === 980) await page.getByLabel("Toggle theme").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByLabel("Search backlog")).toBeVisible();
    await expect(page.getByRole("button", { name: /Schedule 2 shown tasks for/ })).toBeVisible();
    await page.screenshot({ animations: "disabled", path: `artifacts/todo-backlog-${width}.png` });
  }
  await add(page, "Daily standup 2026-10-05 9am");
  await add(page, "Review payment retries 2026-10-06 2pm");
  await add(page, "Prepare deployment checklist 2026-10-07");
  await page.getByRole("button", { name: "This Week", exact: true }).first().click();
  await page.screenshot({ animations: "disabled", path: "artifacts/todo-week-980.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel("Toggle theme").click();
  await page.screenshot({ animations: "disabled", path: "artifacts/todo-week-1440.png" });
});
