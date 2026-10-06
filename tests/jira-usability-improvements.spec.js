import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";
const projects = async page => {
  await page.locator('nav .nav-item[aria-label="Projects"]').click();
  await page.getByRole("button", { name: "Issues", exact: true }).click();
  await expect(page.getByRole("button", { name: "PAY-382", exact: true })).toBeVisible();
};
const queryCalls = page => page.evaluate(() => window.__fixture.calls.filter(call => call.action === "jira.issues"));
test.beforeEach(async ({ page }) => installConnected(page));

test("Project, assigned-to-me, and issue-key search produce server queries without writes", async ({ page }) => {
  await projects(page);
  await page.getByLabel("Jira project filter").selectOption("PAY");
  await page.getByLabel("Jira work filter").selectOption("mine");
  await page.getByLabel("Find Jira issues").fill("pay-382");
  await page.getByRole("button", { name: "Search issues", exact: true }).click();
  await expect.poll(async () => (await queryCalls(page)).at(-1)?.args.jql).toContain('key = "PAY-382"');
  const query = (await queryCalls(page)).at(-1).args.jql;
  expect(query).toContain('project = "PAY"');
  expect(query).toContain("assignee = currentUser()");
  expect(query).toContain("statusCategory != Done");
  await expect(page.locator(".jira-advanced")).not.toHaveAttribute("open", "");
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => ["jira.edit", "jira.transition"].includes(call.action)))).toEqual([]);
});

test("Sprint opens active sprint issues immediately and describes the actual scope", async ({ page }) => {
  await projects(page);
  await page.getByRole("button", { name: "Sprint", exact: true }).click();
  await expect(page.getByLabel("Jira planning sprint")).toHaveValue("24");
  const calls = await page.evaluate(() => window.__fixture.calls.filter(call => call.action === "jira.sprintIssues"));
  expect(calls.at(-1).args).toMatchObject({ boardId: "10", sprintId: "24" });
  expect(calls.at(-1).args.jql).not.toContain("updated >= -30d");
  await expect(page.getByLabel("Jira work filter")).toHaveValue("sprint");
  await expect(page.locator(".live-mode-note")).toContainText("Issues in the selected sprint");
});

test("Changing project views and filters keeps the open inspector and field/comment drafts", async ({ page }) => {
  await projects(page);
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await page.getByLabel("Live Jira comment").fill("Keep queue retry evidence.");
  await page.getByLabel("Jira due date").fill("2026-10-15");
  await page.getByRole("button", { name: "Board", exact: true }).click();
  await page.getByLabel("Jira work filter").selectOption("mine");
  await expect(page.getByLabel("Live Jira comment")).toHaveValue("Keep queue retry evidence.");
  await expect(page.getByLabel("Jira due date")).toHaveValue("2026-10-15");
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => ["jira.edit", "jira.comment"].includes(call.action)))).toEqual([]);
});

test("Status changes from the issue table load legal transitions and write only on Apply", async ({ page }) => {
  await projects(page);
  await page.getByLabel("Change status of PAY-382").click();
  await expect(page.getByRole("button", { name: "Apply Done", exact: true })).toBeVisible();
  await expect(page.getByLabel("Live issue inspector")).toHaveCount(0);
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => call.action === "jira.transition"))).toHaveLength(0);
  await page.getByRole("button", { name: "Apply Done", exact: true }).click();
  await expect(page.getByLabel("Change status of PAY-382")).toContainText("Done");
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => call.action === "jira.transition").map(call => call.args))).toEqual([{ key: "PAY-382", transitionId: "31" }]);
});

test("Failed inline transition remains retryable and a canceled popover never writes", async ({ page }) => {
  await projects(page);
  await page.getByLabel("Change status of PAY-382").click();
  await page.getByRole("button", { name: "Apply Done", exact: true }).waitFor();
  await page.getByLabel("Change status of PAY-382").press("Escape");
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => call.action === "jira.transition"))).toHaveLength(0);
  await page.evaluate(() => window.__fixture.setFailure("jira.transition"));
  await page.getByLabel("Change status of PAY-382").click();
  await page.getByRole("button", { name: "Apply Done", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("unavailable");
  await page.evaluate(() => window.__fixture.setFailure(""));
  await page.getByRole("button", { name: "Apply Done", exact: true }).click();
  await expect(page.getByLabel("Change status of PAY-382")).toContainText("Done");
});

test("A failed new query retains previous pagination and the last successful sync query", async ({ page }) => {
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await original(action, args);
      if (action !== "jira.issues") return result;
      if (args.jql.includes('"failed query"')) throw Error("Search unavailable");
      const second = Boolean(args.nextPageToken);
      return { issues: [{ ...result.issues[0], id: second ? "2" : "1", key: second ? "PAY-383" : "PAY-382" }], nextPageToken: second ? undefined : "second-page" };
    };
  });
  await projects(page);
  const originalQuery = (await queryCalls(page)).at(-1).args.jql;
  await page.getByLabel("Find Jira issues").fill("failed query");
  await page.getByRole("button", { name: "Search issues", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Search unavailable");
  await expect(page.getByLabel("Jira result coverage")).toContainText("Previous query results");
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(page.getByRole("button", { name: "PAY-383", exact: true })).toBeVisible();
  expect((await queryCalls(page)).at(-1).args).toEqual({ jql: originalQuery, nextPageToken: "second-page" });
  await expect(page.getByLabel("Jira result coverage")).toContainText("Previous query results");
});

test("Failed work filter stays visibly unapplied after successful refresh of previous results", async ({ page }) => {
  await projects(page);
  const applied = (await queryCalls(page)).at(-1).args.jql;
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.rejectMine = true;
    window.orbit.invoke = async (action, args) => {
      if (action === "jira.issues" && args.jql.includes("assignee = currentUser()") && window.rejectMine) throw Error("Assigned work temporarily unavailable");
      return original(action, args);
    };
  });
  await page.getByLabel("Jira work filter").selectOption("mine");
  await expect(page.getByRole("alert")).toContainText("Assigned work temporarily unavailable");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect((await queryCalls(page)).at(-1).args.jql).toBe(applied);
  await expect(page.getByLabel("Jira work filter")).toHaveValue("mine");
  await expect(page.getByLabel("Jira result coverage")).toContainText("Previous query results");
  await page.evaluate(() => { window.rejectMine = false; });
  await page.getByRole("button", { name: "Retry selected query", exact: true }).click();
  await expect(page.getByLabel("Jira result coverage")).not.toContainText("Previous query results");
  expect((await queryCalls(page)).at(-1).args.jql).toContain("assignee = currentUser()");
});

test("Draft search and advanced JQL never run just because the user changes views", async ({ page }) => {
  await projects(page);
  await page.getByLabel("Find Jira issues").fill("UNSENT-999");
  await page.locator(".jira-advanced summary").click();
  await page.getByLabel("Jira query").fill("key = PAY-382");
  await page.getByRole("button", { name: "Run query", exact: true }).click();
  await page.getByLabel("Jira query").fill("key = UNSENT-888");
  await page.getByRole("button", { name: "Board", exact: true }).click();
  await expect.poll(async () => (await queryCalls(page)).at(-1)?.args.jql).toBe("key = PAY-382");
  await expect(page.getByLabel("Find Jira issues")).toHaveValue("UNSENT-999");
  await expect(page.getByLabel("Jira query")).toHaveValue("key = UNSENT-888");
});

test("Inspector disables unchanged edits, exposes subtasks, and loads planning choices on expansion", async ({ page }) => {
  await page.evaluate(() => { window.__fixture.issue.fields.subtasks = [{ key: "PAY-383", fields: { summary: "Verify idempotency retries", status: { name: "To Do" } } }]; });
  await projects(page);
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save assignee in Jira" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save due date in Jira" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /PAY-383 Verify idempotency retries/ })).toBeVisible();
  await page.locator(".issue-planning-details summary").click();
  await expect(page.getByLabel("Jira priority", { exact: true })).toContainText("Medium");
  await page.getByLabel("Jira scrum board").selectOption("10");
  await expect(page.getByLabel("Jira sprint", { exact: true })).toContainText("Sprint 24");
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => ["jira.edit", "jira.moveSprint"].includes(call.action)))).toEqual([]);
});

test("A board API failure still leaves successfully loaded priority edits usable", async ({ page }) => {
  await page.evaluate(() => window.__fixture.setFailure("jira.boards"));
  await projects(page);
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await page.locator(".issue-planning-details summary").click();
  await expect(page.getByLabel("Jira priority", { exact: true })).toContainText("Medium");
  await expect(page.getByRole("alert")).toContainText("unavailable");
  await page.getByLabel("Jira priority", { exact: true }).selectOption("2");
  await page.getByRole("button", { name: "Save priority in Jira" }).click();
  await expect.poll(() => page.evaluate(() => window.__fixture.calls.filter(call => call.action === "jira.edit").at(-1)?.args)).toEqual({ key: "PAY-382", priorityId: "2" });
});

test("Transition-only failure preserves the readable issue and comment editor and retries independently", async ({ page }) => {
  await page.evaluate(() => window.__fixture.setFailure("jira.transitions"));
  await projects(page);
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  const inspector = page.getByLabel("Live issue inspector");
  await expect(inspector).toContainText("Retry transient failures with idempotency keys.");
  await page.getByLabel("Live Jira comment").fill("Keep readable issue during status outage.");
  await expect(page.getByLabel("Jira status transition")).toBeDisabled();
  await expect(inspector.getByRole("alert")).toContainText("Status options unavailable");
  const reads = await page.evaluate(() => window.__fixture.calls.filter(call => call.action === "jira.issue").length);
  await page.evaluate(() => window.__fixture.setFailure(""));
  await inspector.getByRole("button", { name: "Retry status options", exact: true }).click();
  await expect(page.getByLabel("Jira status transition")).toBeEnabled();
  await expect(page.getByLabel("Live Jira comment")).toHaveValue("Keep readable issue during status outage.");
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => call.action === "jira.issue").length)).toBe(reads);
});

test("A failed background issue read superseding a pending status retry cannot lock future retries", async ({ page }) => {
  await page.evaluate(() => window.__fixture.setFailure("jira.transitions"));
  await projects(page);
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  const retry = page.getByLabel("Live issue inspector").getByRole("button", { name: "Retry status options", exact: true });
  await expect(retry).toBeEnabled();
  await page.evaluate(() => {
    window.__fixture.setFailure("");
    const original = window.orbit.invoke;
    let held = false;
    window.orbit.invoke = async (action, args) => {
      if (action === "jira.transitions" && !held) {
        held = true;
        await new Promise(resolve => { window.releaseStatusRetry = resolve; });
      }
      if (action === "jira.issue") {
        window.backgroundIssueFailed = true;
        throw Error("Background issue read unavailable");
      }
      return original(action, args);
    };
  });
  await retry.click();
  await expect(retry).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(() => window.backgroundIssueFailed);
  await page.evaluate(() => window.releaseStatusRetry());
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(page.getByLabel("Jira status transition")).toBeEnabled();
  await expect(retry).toHaveCount(0);
});

test("Accepted status writes stay explicit and cannot be repeated when the following issue refresh fails", async ({ page }) => {
  await projects(page);
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await page.getByLabel("Jira status transition").selectOption("31");
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.rejectRead = false;
    window.orbit.invoke = async (action, args) => {
      if (action === "jira.issue" && window.rejectRead) throw Error("Issue refresh unavailable");
      const result = await original(action, args);
      if (action === "jira.transition") window.rejectRead = true;
      return result;
    };
  });
  await page.getByRole("button", { name: "Apply in Jira", exact: true }).click();
  await expect(page.locator(".issue-feedback")).toContainText("Status updated in Jira.");
  await expect(page.locator(".issue-feedback")).toContainText("Update saved in Jira. Issue refresh failed");
  await expect(page.getByRole("button", { name: "Apply in Jira", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Jira status transition")).toHaveValue("");
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => call.action === "jira.transition"))).toHaveLength(1);
  await page.evaluate(() => { window.rejectRead = false; });
  await page.getByRole("button", { name: "Retry issue refresh", exact: true }).click();
  await expect(page.getByLabel("Live issue inspector").locator(".inline .pill").first()).toContainText("Done");
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => call.action === "jira.transition"))).toHaveLength(1);
});

test("Comment posting supports explicit keyboard submission and shows accepted write feedback", async ({ page }) => {
  await projects(page);
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await page.getByLabel("Live Jira comment").fill("Check retry budget before release.");
  await page.getByLabel("Live Jira comment").press("Control+Enter");
  await expect(page.getByLabel("Live Jira comment")).toHaveValue("");
  await expect(page.locator(".issue-feedback")).toContainText("Comment posted to Jira.");
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => call.action === "jira.comment").map(call => call.args))).toEqual([{ key: "PAY-382", body: "Check retry budget before release." }]);
});

test("Compact issue filters and inspector remain usable at narrow desktop width in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 1050, height: 900 });
  await projects(page);
  await page.getByLabel("Toggle theme").click();
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await expect(page.getByRole("button", { name: "Search issues", exact: true })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Add to Today", exact: true }).last()).toBeInViewport();
  await page.getByLabel("Live Jira comment").scrollIntoViewIfNeeded();
  await expect(page.getByLabel("Live Jira comment")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

for (const type of ["issue", "mr"]) test(`Already planned ${type} shows its date and moves explicitly with guarded Undo`, async ({ page }) => {
  const dates = await page.evaluate(type => {
    const date = new Date(), tomorrow = new Date(); tomorrow.setDate(date.getDate() + 1);
    const key = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
    const object = type === "issue" ? { type, key: "PAY-382", origin: "https://jira.fixture.test" } : { type, projectId: 42, iid: 7, origin: "https://gitlab.fixture.test" };
    localStorage.setItem("orbit.connected.plan.v1", JSON.stringify({ tasks: [{ id: "planned-source", kind: "task", title: "Existing linked work", date: key(tomorrow), time: "14:00", done: false, object }], recent: [], favorites: [], activity: [] }));
    return { today: key(date), tomorrow: key(tomorrow) };
  }, type);
  await page.reload();
  if (type === "issue") { await projects(page); await page.getByRole("button", { name: "PAY-382", exact: true }).click(); }
  else {
    await page.locator('nav .nav-item[aria-label="Code"]').click();
    await page.locator(".connected-object").filter({ hasText: "PAY-382 Payment retry review" }).click();
  }
  const action = page.locator(type === "issue" ? ".live-inspector .plan-object-action" : ".mr-linked-context .plan-object-action");
  await expect(action).toContainText("Planned");
  await expect(action).toContainText("14:00");
  await action.getByRole("button", { name: "Move to Today", exact: true }).click();
  await expect(action.getByRole("button", { name: "In Today", exact: true })).toBeDisabled();
  await action.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("orbit.connected.plan.v1")).tasks[0].date)).toBe(dates.tomorrow);
  await action.getByRole("button", { name: "Move to Today", exact: true }).click();
  await page.evaluate(async () => { const activeModule = performance.getEntriesByType("resource").find(entry => new URL(entry.name).pathname === "/src/lib/planning.js")?.name || "/src/lib/planning.js"; const planning = await import(activeModule); planning.updateTask("planned-source", { time: "15:00" }); });
  await action.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  const plan = await page.evaluate(() => JSON.parse(localStorage.getItem("orbit.connected.plan.v1")));
  expect(plan.tasks).toHaveLength(1);
  expect(plan.tasks[0]).toMatchObject({ date: dates.today, time: "15:00" });
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => ["jira.edit", "jira.transition", "gitlab.comment", "gitlab.approve"].includes(call.action)))).toEqual([]);
});
