import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";

const nav = (page, name) => page.locator(`nav .nav-item[aria-label="${name}"]`).click();
test.beforeEach(async ({ page }) => installConnected(page));

test("Back from an MR cancels a pending refresh instead of reopening the review", async ({ page }) => {
  await nav(page, "Code");
  await page.locator(".connected-content button").filter({ hasText: "PAY-382 Payment retry review" }).click();
  await expect(page.getByRole("img", { name: "Dependency flow diagram" })).toBeVisible();
  await page.evaluate(() => {
    const original = window.__fixture.invoke.bind(window.__fixture);
    window.__fixture.invoke = async (action, args) => {
      if (action === "gitlab.mr") await new Promise((resolve) => { window.__releaseMR = resolve; });
      const result = await original(action, args);
      if (action === "gitlab.mr") window.__mrFinished = true;
      return result;
    };
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Merge requests", exact: true }).click();
  await page.evaluate(() => window.__releaseMR());
  await page.waitForFunction(() => window.__mrFinished);
  await expect(page.locator(".visual-review")).toHaveCount(0);
  await expect(page.locator(".connected-content")).toContainText("PAY-382 Payment retry review");
});

test("Changing wiki space cannot leave a hidden title filter behind", async ({ page }) => {
  await nav(page, "Docs");
  await page.getByLabel("Find Confluence page").fill("Payment Retry Policy");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByLabel("Confluence space").selectOption("s1");
  await expect(page.getByLabel("Find Confluence page")).toHaveValue("");
  await expect.poll(() => page.evaluate(() =>
    window.__fixture.calls.filter((call) => call.action === "confluence.pages").at(-1)?.args,
  )).toMatchObject({ spaceId: "s1" });
  expect(await page.evaluate(() =>
    window.__fixture.calls.filter((call) => call.action === "confluence.pages").at(-1).args.title,
  )).toBeFalsy();
});

test("Sprint options follow the latest board even when an older request finishes last", async ({ page }) => {
  await page.evaluate(() => {
    const original = window.__fixture.invoke.bind(window.__fixture);
    window.__fixture.invoke = async (action, args) => {
      if (action === "jira.boards") return { values: [{ id: 10, name: "Old board" }, { id: 20, name: "Current board" }] };
      if (action === "jira.sprints" && args.boardId === "10") {
        await new Promise((resolve) => { window.__releaseOldBoard = resolve; });
        window.__oldBoardFinished = true;
        return { values: [{ id: 101, name: "Old board sprint", state: "active" }] };
      }
      if (action === "jira.sprints" && args.boardId === "20") return { values: [{ id: 201, name: "Current board sprint", state: "active" }] };
      return original(action, args);
    };
  });
  await nav(page, "Projects");
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await page.getByText("Sprint & priority", { exact: true }).click();
  await page.getByRole("button", { name: "Load project options" }).click();
  await page.getByLabel("Jira scrum board").selectOption("10");
  await page.getByLabel("Jira scrum board").selectOption("20");
  await expect(page.getByLabel("Jira sprint", { exact: true })).toContainText("Current board sprint");
  await page.evaluate(() => window.__releaseOldBoard());
  await page.waitForFunction(() => window.__oldBoardFinished);
  await expect(page.getByLabel("Jira sprint", { exact: true })).toContainText("Current board sprint");
  await expect(page.getByLabel("Jira sprint", { exact: true })).not.toContainText("Old board sprint");
});

test("Issue comment drafts survive closing and reopening their context", async ({ page }) => {
  await nav(page, "Projects");
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await page.getByLabel("Live Jira comment").fill("Keep this unsent investigation note.");
  await page.getByLabel("Close live issue").click();
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await expect(page.getByLabel("Live Jira comment")).toHaveValue("Keep this unsent investigation note.");
  expect(await page.evaluate(() => window.__fixture.calls.filter((call) => call.action === "jira.comment"))).toHaveLength(0);
});

test("Global search opens future and backlog tasks in their actual plan", async ({ page }) => {
  await page.getByLabel("Quick add personal work").fill("Prepare audit handoff tomorrow 2pm");
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
  await page.keyboard.press("Meta+k");
  await page.getByLabel("Connected global search").fill("Prepare audit handoff");
  await page.locator("[cmdk-item]").filter({ hasText: "Prepare audit handoff" }).click();
  await expect(page.locator(".plan-task")).toContainText("Prepare audit handoff");
  await expect(page.locator(".plan-task-main button").filter({ hasText: "Prepare audit handoff" })).toBeFocused();
  await page.locator("nav .subnav button").filter({ hasText: /^Backlog$/ }).click();
  await page.getByLabel("Quick add personal work").fill("Future backlog research");
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
  await nav(page, "Home");
  await page.keyboard.press("Meta+k");
  await page.getByLabel("Connected global search").fill("Future backlog research");
  await page.locator("[cmdk-item]").filter({ hasText: "Future backlog research" }).click();
  await expect(page.locator(".plan-task")).toContainText("Future backlog research");
  await expect(page.getByRole("button", { name: "Future backlog research", exact: true })).toBeFocused();
});

test("Favorite wiki list reflects removal and remains available when page listing fails", async ({ page }) => {
  await nav(page, "Docs");
  await page.locator(".connected-docs aside").getByRole("button", { name: "Payment Retry Policy", exact: true }).click();
  await page.getByRole("button", { name: "Favorite", exact: true }).click();
  await page.locator("nav .subnav button").filter({ hasText: /^Favorites$/ }).click();
  await page.locator(".connected-docs aside").getByRole("button", { name: "Payment Retry Policy", exact: true }).click();
  await page.getByRole("button", { name: "Remove favorite", exact: true }).click();
  await expect(page.locator(".connected-docs aside")).not.toContainText("Payment Retry Policy");
  await page.getByRole("button", { name: "Favorite", exact: true }).click();
  await page.evaluate(() => window.__fixture.setFailure("confluence.pages"));
  await nav(page, "Home");
  await nav(page, "Docs");
  await page.locator("nav .subnav button").filter({ hasText: /^Favorites$/ }).click();
  await expect(page.locator(".connected-docs aside")).toContainText("Payment Retry Policy");
});

test("Pending creation locks submitted fields and failure unlocks the intact draft", async ({ page }) => {
  await page.evaluate(() => {
    const original = window.__fixture.invoke.bind(window.__fixture);
    window.__fixture.invoke = async (action, args) => {
      if (["jira.create", "confluence.create"].includes(action)) {
        await new Promise((resolve, reject) => { window.__rejectCreation = () => reject(new Error("Creation unavailable")); });
      }
      return original(action, args);
    };
  });
  await page.keyboard.press("Meta+n");
  for (const kind of ["Jira issue", "Wiki document"]) {
    await page.getByRole("button", { name: kind, exact: true }).click();
    if (kind === "Jira issue") {
      await page.getByLabel("New issue project").selectOption("PAY");
      await page.getByLabel("New issue type").selectOption("3");
    } else await page.getByLabel("New document space").selectOption("s1");
    await page.getByLabel("New work title").fill("Preserve submitted draft");
    await page.getByLabel("New work body").fill("Evidence stays available for a retry.");
    await page.getByRole("button", { name: kind === "Jira issue" ? "Create in Jira" : "Publish to Confluence", exact: true }).click();
    await expect(page.getByLabel("New work title")).toBeDisabled();
    await expect(page.getByLabel("New work body")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Task", exact: true })).toBeDisabled();
    await page.keyboard.press("Meta+k");
    await expect(page.getByLabel("Connected global search")).toHaveCount(0);
    await page.keyboard.press("Control+n");
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("New work title")).toBeDisabled();
    await expect(page.getByLabel("Close connected command")).toBeDisabled();
    if (kind === "Jira issue") {
      await expect(page.getByLabel("New issue project")).toBeDisabled();
      await expect(page.getByLabel("New issue type")).toBeDisabled();
    } else await expect(page.getByLabel("New document space")).toBeDisabled();
    await page.evaluate(() => window.__rejectCreation());
    await expect(page.getByRole("alert")).toContainText("Creation unavailable");
    await expect(page.getByLabel("New work title")).toBeEnabled();
    await expect(page.getByLabel("New work title")).toHaveValue("Preserve submitted draft");
    await expect(page.getByLabel("New work body")).toBeEnabled();
    await expect(page.getByLabel("New work body")).toHaveValue("Evidence stays available for a retry.");
  }
});
