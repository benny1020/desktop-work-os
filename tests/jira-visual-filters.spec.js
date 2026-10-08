import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";
const calls = page => page.evaluate(() => window.__fixture.calls.filter(call => call.action === "jira.issues"));
const issues = async page => {
  await page.locator('nav .nav-item[aria-label="Projects"]').click();
  await page.getByRole("button", { name: "Issues", exact: true }).click();
  await expect(page.getByRole("button", { name: "PAY-382", exact: true })).toBeVisible();
};
test.beforeEach(async ({ page }) => installConnected(page));

test("Visual filters combine on the server, preserve inspector drafts and remove individually", async ({ page }) => {
  await issues(page);
  await expect(page.getByText(/JQL|Run query/)).toHaveCount(0);
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await page.getByLabel("Live Jira comment").fill("Keep the review context.");
  await page.getByLabel("Jira work filter").selectOption("mine");
  await page.locator(".jira-visual-filters summary").click();
  await page.getByLabel("Jira status filter").selectOption("done");
  await page.getByLabel("Jira deadline filter").selectOption("today");
  const query = (await calls(page)).at(-1).args.jql;
  expect(query).toContain("assignee = currentUser()"); expect(query).toContain("statusCategory = Done");
  expect(query).not.toContain("statusCategory != Done"); expect(query).toContain("duedate >= startOfDay()");
  await page.getByLabel("Jira deadline filter").press("Escape");
  await expect(page.locator(".jira-visual-filters summary")).toBeFocused();
  await page.getByLabel("Remove deadline filter").click();
  expect((await calls(page)).at(-1).args.jql).not.toContain("duedate");
  await expect(page.getByLabel("Live Jira comment")).toHaveValue("Keep the review context.");
  expect(await page.evaluate(() => window.__fixture.calls.filter(c => ["jira.edit", "jira.comment", "jira.transition"].includes(c.action)))).toEqual([]);
});

test("Clear filters restores default query and search without changing the open issue", async ({ page }) => {
  await issues(page);
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await page.getByLabel("Jira project filter").selectOption("PAY");
  await page.getByLabel("Jira work filter").selectOption("all");
  await page.getByLabel("Find Jira issues").fill("pay-382");
  await page.getByRole("button", { name: "Search issues", exact: true }).click();
  expect((await calls(page)).at(-1).args.jql).not.toContain("-30d");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByLabel("Find Jira issues")).toHaveValue("");
  await expect(page.getByLabel("Jira project filter")).toHaveValue("");
  expect((await calls(page)).at(-1).args.jql).toBe("(updated >= -30d) ORDER BY updated DESC");
  await expect(page.getByLabel("Live issue inspector")).toBeVisible();
});

test("Project search and pagination reach projects beyond the initial page", async ({ page }) => {
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      if (action === "jira.projects") {
        await original(action, args);
        if (args.query === "Platform") return { values: args.startAt ? [{ key: "API", name: "Platform API" }] : [{ key: "OPS", name: "Platform Operations" }], startAt: args.startAt || 0, maxResults: 1, isLast: Boolean(args.startAt) };
        return { values: [{ key: "PAY", name: "Payments" }], isLast: true };
      }
      return original(action, args);
    };
  });
  await issues(page);
  await page.locator(".jira-project-lookup summary").click();
  await expect(page.getByLabel("Search Jira projects")).toBeFocused();
  await page.getByLabel("Search Jira projects").fill("Platform");
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await page.getByRole("button", { name: "Load more projects", exact: true }).click();
  await page.getByRole("button", { name: "API Platform API", exact: true }).click();
  await expect(page.getByLabel("Jira project filter")).toHaveValue("API");
  await expect(page.locator(".jira-project-lookup summary")).toBeFocused();
  expect((await calls(page)).at(-1).args.jql).toContain('project = "API"');
  await page.getByRole("button", { name: "Board", exact: true }).click();
  await expect(page.getByLabel("Jira project filter")).toHaveValue("API");
});

test("Project search failures retain old options and retry the intended search", async ({ page }) => {
  await issues(page);
  await page.locator(".jira-project-lookup summary").click();
  await page.evaluate(() => window.__fixture.setFailure("jira.projects"));
  await page.getByLabel("Search Jira projects").fill("Orders");
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Project search unavailable");
  await expect(page.getByLabel("Jira project filter")).toContainText("PAY");
  await page.evaluate(() => window.__fixture.setFailure(""));
  await page.getByRole("button", { name: "Retry project search", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => window.__fixture.calls.filter(c => c.action === "jira.projects").at(-1).args)).toEqual({ query: "Orders", startAt: 0 });
});

test("Sprint filters and reset stay inside the selected board and sprint", async ({ page }) => {
  await issues(page);
  await page.getByRole("button", { name: "Sprint", exact: true }).click();
  await expect(page.getByLabel("Jira planning sprint")).toHaveValue("24");
  await page.locator(".jira-visual-filters summary").click();
  await page.getByLabel("Jira assignee filter").selectOption("unassigned");
  await expect.poll(() => page.evaluate(() => window.__fixture.calls.filter(c => c.action === "jira.sprintIssues").at(-1)?.args.jql)).toContain("assignee IS EMPTY");
  await page.getByLabel("Jira assignee filter").press("Escape");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  const last = await page.evaluate(() => window.__fixture.calls.filter(c => c.action === "jira.sprintIssues").at(-1).args);
  expect(last).toMatchObject({ boardId: "10", sprintId: "24", jql: "ORDER BY updated DESC" });
});

test("Visual filters remain within the window in a narrow dark inspector", async ({ page }) => {
  await page.setViewportSize({ width: 980, height: 720 });
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await issues(page);
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await page.locator(".jira-visual-filters summary").click();
  await expect(page.getByLabel("Jira status filter")).toBeVisible();
  const bounds = await page.locator(".jira-filter-fields").boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(980);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(980);
});
