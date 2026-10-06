import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";
async function issues(page) {
  await page.locator('nav .nav-item[aria-label="Projects"]').click();
  await page.getByRole("button", { name: "Issues", exact: true }).click();
  await expect(page.getByRole("button", { name: "PAY-382", exact: true })).toBeVisible();
}
async function inspector(page) {
  await issues(page);
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await expect(page.getByLabel("Live Jira comment")).toBeVisible();
}
async function sprint(page) {
  await issues(page);
  await page.getByRole("button", { name: "Sprint", exact: true }).click();
  await expect(page.getByLabel("Jira planning board")).toHaveValue("10");
  await expect(page.getByLabel("Jira planning sprint")).toHaveValue("24");
}
const actions = (page, action) => page.evaluate(action => window.__fixture.calls.filter(call => call.action === action), action);
test.beforeEach(async ({ page }) => installConnected(page));

test("Specific future sprint and true board backlog retain personal filters and inspector drafts", async ({ page }) => {
  await inspector(page);
  await page.getByLabel("Live Jira comment").fill("Plan the reconciliation handoff.");
  await page.getByRole("button", { name: "Sprint", exact: true }).click();
  await expect(page.getByLabel("Jira planning sprint")).toHaveValue("24");
  await page.getByLabel("Jira work filter").selectOption("mine");
  await page.getByLabel("Jira planning sprint").selectOption("25");
  await expect(page.getByLabel("Jira work filter")).toHaveValue("mine");
  await expect(page.locator(".page-heading h1")).toHaveText("Sprint 25");
  await expect.poll(async () => (await actions(page, "jira.sprintIssues")).at(-1)?.args.sprintId).toBe("25");
  const query = (await actions(page, "jira.sprintIssues")).at(-1).args;
  expect(query.boardId).toBe("10");
  expect(query.jql).toContain("assignee = currentUser()");
  expect(query.jql).not.toContain("openSprints");
  await expect(page.getByLabel("Live Jira comment")).toHaveValue("Plan the reconciliation handoff.");
  await page.getByLabel("Jira planning sprint").selectOption("backlog");
  await expect(page.locator(".page-heading h1")).toHaveText("Board backlog");
  await expect.poll(async () => (await actions(page, "jira.backlog")).at(-1)?.args.jql).toContain("assignee = currentUser()");
  expect((await actions(page, "jira.backlog")).at(-1).args).not.toHaveProperty("sprintId");
  expect(await actions(page, "jira.moveSprint")).toHaveLength(0);
});

test("Unknown Jira status still appears in Board with correct loaded count", async ({ page }) => {
  await page.evaluate(() => { window.__fixture.issue.fields.status = null; });
  await issues(page);
  await page.getByRole("button", { name: "Board", exact: true }).click();
  await expect(page.locator(".live-board-card")).toHaveCount(1);
  await expect(page.locator(".live-board h3")).toContainText("Unknown");
  await expect(page.locator(".live-board h3 .pill")).toHaveText("1");
});

test("Chosen assignee remains visible through a different search and submitted value matches UI", async ({ page }) => {
  await page.evaluate(() => {
    const invoke = window.__fixture.invoke;
    window.__fixture.invoke = async (action, args) => action === "jira.assignees" ? [{ accountId: args.query.toLowerCase(), displayName: args.query }] : invoke(action, args);
  });
  await inspector(page);
  await page.getByLabel("Find Jira assignee").fill("Daniel");
  await page.getByRole("button", { name: "Find people", exact: true }).click();
  await page.getByLabel("Jira assignee", { exact: true }).selectOption("daniel");
  await page.getByLabel("Find Jira assignee").fill("Sam");
  await page.getByRole("button", { name: "Find people", exact: true }).click();
  await expect(page.getByLabel("Jira assignee", { exact: true })).toContainText("Sam");
  await expect(page.getByLabel("Jira assignee", { exact: true })).toHaveValue("daniel");
  await page.getByRole("button", { name: "Save assignee in Jira" }).click();
  expect((await actions(page, "jira.edit")).at(-1).args.accountId).toBe("daniel");
});

test("Accepted comment after closing inspector clears only the submitted saved draft", async ({ page }) => {
  await page.evaluate(() => {
    const invoke = window.__fixture.invoke;
    window.__fixture.invoke = async (action, args) => {
      if (action === "jira.comment") await new Promise(resolve => { window.releaseComment = resolve; });
      return invoke(action, args);
    };
  });
  await inspector(page);
  await page.getByLabel("Live Jira comment").fill("Queue delivery verified.");
  await page.getByRole("button", { name: "Post to Jira", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.releaseComment))).toBe(true);
  await page.getByLabel("Close live issue").click();
  await page.evaluate(() => window.releaseComment());
  await expect.poll(() => page.evaluate(() => window.__fixture.issue.fields.comment.comments.length)).toBe(1);
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await expect(page.getByLabel("Live Jira comment")).toHaveValue("");
  await expect(page.locator(".component-comment")).toContainText("Queue delivery verified.");
  await expect(page.getByRole("button", { name: "Post to Jira", exact: true })).toBeDisabled();
});

test("Accepted sprint move consumes selection even when membership refresh is unavailable", async ({ page }) => {
  await inspector(page);
  await page.getByText("Sprint & priority", { exact: true }).click();
  await expect(page.getByLabel("Jira sprint membership")).toContainText("Sprint 24");
  await page.getByLabel("Jira scrum board").selectOption("10");
  await page.getByLabel("Jira sprint", { exact: true }).selectOption("24");
  await expect(page.getByRole("button", { name: "Move to sprint in Jira" })).toBeDisabled();
  await page.getByLabel("Jira sprint", { exact: true }).selectOption("25");
  await page.evaluate(() => window.__fixture.setFailure("jira.agileIssue"));
  await page.getByRole("button", { name: "Move to sprint in Jira" }).click();
  await expect(page.getByLabel("Jira sprint", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Move to sprint in Jira" })).toBeDisabled();
  await expect(page.getByLabel("Jira sprint membership")).toContainText("Sprint 25");
  await expect(page.getByLabel("Live Jira comment")).toBeVisible();
  await expect(page.getByText(/Sprint membership refresh unavailable/)).toBeVisible();
  expect(await actions(page, "jira.moveSprint")).toHaveLength(1);
});

test("Transitions requiring Jira screens offer explicit recovery and never post doomed writes", async ({ page }) => {
  await page.evaluate(() => {
    const invoke = window.__fixture.invoke;
    window.__fixture.invoke = async (action, args) => action === "jira.transitions" ? [{ id: "31", name: "Done", fields: { resolution: { required: true, name: "Resolution" } } }] : invoke(action, args);
  });
  await issues(page);
  await page.getByLabel("Change status of PAY-382").click();
  await expect(page.getByRole("button", { name: "Apply Done", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Open in Jira", exact: true }).click();
  expect(await actions(page, "jira.openIssue")).toHaveLength(1);
  await page.getByLabel("Change status of PAY-382").press("Escape");
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await page.getByLabel("Jira status transition").selectOption("31");
  await expect(page.getByRole("button", { name: "Apply in Jira", exact: true })).toBeDisabled();
  await expect(page.getByText("This transition requires Resolution. Complete it in Jira.")).toBeVisible();
  expect(await actions(page, "jira.transition")).toHaveLength(0);
});

test("Linked Jira work can plan a chosen day and backlog using one canonical local task with guarded Undo", async ({ page }) => {
  await inspector(page);
  await page.getByRole("button", { name: "Plan…", exact: true }).click();
  expect((await page.getByRole("form", { name: "Schedule linked work" }).boundingBox()).height).toBeLessThan(200);
  await expect(page.getByLabel("Local planning date")).toBeFocused();
  await page.getByLabel("Local planning date").fill("2026-11-05");
  await page.getByRole("button", { name: "Add to local plan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Move to Today", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Plan…", exact: true }).click();
  await page.getByLabel("Local planning date").fill("");
  await page.getByRole("button", { name: "Move in local plan", exact: true }).click();
  await expect(page.getByText("In backlog · local plan", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo schedule move", exact: true }).click();
  await expect(page.getByText(/Planned Nov 5/)).toBeVisible();
  expect(await actions(page, "jira.moveSprint")).toHaveLength(0);
  expect(await actions(page, "jira.edit")).toHaveLength(0);
});

test("Paged board and sprint options are reachable instead of silently capped", async ({ page }) => {
  await page.evaluate(() => {
    const invoke = window.__fixture.invoke;
    window.__fixture.invoke = async (action, args) => {
      if (action === "jira.boards") return { values: [{ id: args.startAt ? 60 : 10, name: args.startAt ? "API planning" : "Payments" }], startAt: args.startAt || 0, maxResults: 50, isLast: Boolean(args.startAt) };
      if (action === "jira.sprints") return { values: [{ id: args.startAt ? 125 : 24, name: args.startAt ? "Next cycle" : "Current cycle", state: args.startAt ? "future" : "active" }], startAt: args.startAt || 0, maxResults: 50, isLast: Boolean(args.startAt) };
      return invoke(action, args);
    };
  });
  await issues(page);
  await page.getByRole("button", { name: "Sprint", exact: true }).click();
  await page.getByRole("button", { name: "Load more boards", exact: true }).click();
  await page.getByLabel("Jira planning board").selectOption("60");
  await page.getByRole("button", { name: "Load more sprints", exact: true }).click();
  await page.getByLabel("Jira planning sprint").selectOption("125");
  await expect(page.locator(".page-heading h1")).toHaveText("Next cycle");
  await expect.poll(async () => (await actions(page, "jira.sprintIssues")).at(-1)?.args).toMatchObject({ boardId: "60", sprintId: "125" });
});

test("Optional sprint membership request never delays reading or commenting on an issue", async ({ page }) => {
  await page.evaluate(() => {
    const invoke = window.__fixture.invoke;
    window.__fixture.invoke = async (action, args) => {
      if (action === "jira.agileIssue") await new Promise(resolve => { window.releaseMembership = resolve; });
      return invoke(action, args);
    };
  });
  await inspector(page);
  await page.getByLabel("Live Jira comment").fill("Readable while membership is pending.");
  await expect(page.getByLabel("Jira status transition")).toBeEnabled();
  await expect.poll(() => page.evaluate(() => Boolean(window.releaseMembership))).toBe(true);
  await page.evaluate(() => window.releaseMembership());
});

test("Failed target sprint retains previous loaded pages through refresh and retries the selected scope", async ({ page }) => {
  await page.evaluate(() => {
    const invoke = window.__fixture.invoke;
    window.__fixture.scopeReads = [];
    window.__fixture.failFuture = true;
    window.__fixture.invoke = async (action, args) => {
      if (action === "jira.sprintIssues") {
        window.__fixture.scopeReads.push(args);
        if (args.sprintId === "25") {
          if (window.__fixture.failFuture) throw Error("Future scope temporarily unavailable");
          return { issues: [], isLast: true };
        }
        const issue = structuredClone(window.__fixture.issue);
        if (args.nextPageToken) { issue.id = "2"; issue.key = "PAY-383"; issue.fields.summary = "Confirm retry rollout"; }
        return { issues: [issue], nextPageToken: args.nextPageToken ? null : "second-page" };
      }
      return invoke(action, args);
    };
  });
  await sprint(page);
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(page.locator(".live-board-card")).toHaveCount(2);
  await page.getByLabel("Jira planning sprint").selectOption("25");
  await expect(page.getByLabel("Jira result coverage")).toContainText("2 loaded · Previous query results");
  await expect(page.locator(".jira-scope-mismatch")).toContainText("Payments Scrum / Sprint 24");
  await expect(page.locator(".jira-scope-mismatch")).toContainText("Selected scope Payments Scrum / Sprint 25 has not loaded");
  await expect(page.locator(".live-mode-note")).toContainText("previous loaded scope (Payments Scrum / Sprint 24)");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".live-board-card")).toHaveCount(2);
  await expect(page.getByLabel("Jira result coverage")).toContainText("Previous query results");
  const reads = await page.evaluate(() => window.__fixture.scopeReads);
  expect(reads.at(-1)).toMatchObject({ boardId: "10", sprintId: "24", nextPageToken: "second-page" });
  await page.evaluate(() => { window.__fixture.failFuture = false; });
  await page.getByRole("button", { name: "Retry selected query", exact: true }).click();
  await expect(page.getByLabel("Jira result coverage")).toHaveText("0 loaded");
  expect((await page.evaluate(() => window.__fixture.scopeReads)).at(-1).sprintId).toBe("25");
});

test("Stale sprint options from the previous board cannot replace the chosen board", async ({ page }) => {
  await page.evaluate(() => {
    const invoke = window.__fixture.invoke;
    window.__fixture.invoke = async (action, args) => {
      if (action === "jira.boards") return { values: [{ id: 10, name: "Payments" }, { id: 20, name: "API" }], isLast: true };
      if (action === "jira.sprints") {
        if (args.boardId === "10") await new Promise(resolve => { window.releaseOldBoard = resolve; });
        return { values: [{ id: args.boardId === "10" ? 24 : 80, name: args.boardId === "10" ? "Payment cycle" : "API cycle", state: "active" }], isLast: true };
      }
      return invoke(action, args);
    };
  });
  await issues(page);
  await page.getByRole("button", { name: "Sprint", exact: true }).click();
  await page.getByLabel("Jira planning board").selectOption("10");
  await expect.poll(() => page.evaluate(() => Boolean(window.releaseOldBoard))).toBe(true);
  await page.getByLabel("Jira planning board").selectOption("20");
  await expect(page.getByLabel("Jira planning sprint")).toHaveValue("80");
  await page.evaluate(() => window.releaseOldBoard());
  await expect(page.getByLabel("Jira planning sprint")).not.toContainText("Payment cycle");
  await expect(page.getByLabel("Jira planning board")).toHaveValue("20");
});
