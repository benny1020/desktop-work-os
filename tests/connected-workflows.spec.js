import { test, expect } from "@playwright/test";
import { revealPlanningActions } from "./fixtures/planning-controls.mjs";
import { installConnected } from "./fixtures/connected.mjs";
const nav = (p, n) => p.locator(`nav .nav-item[aria-label="${n}"]`).click();
const shortcut = (p, key) => p.keyboard.press(`Meta+${key}`);
test.beforeEach(async ({ page }) => installConnected(page));
test("Morning: actual review requests preview without leaving the daily command center", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Your workday" }),
  ).toBeVisible();
  await page
    .locator(".attention-row")
    .getByRole("button", { name: /Payment retry review/ })
    .click();
  await expect(
    page.getByRole("group", { name: "Dependency flow diagram" }),
  ).toBeVisible();
  await page.getByLabel("Close context preview").click();
  await expect(
    page.getByRole("heading", { name: "Your workday" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.__fixture.calls.some((c) => c.action === "claude.review"),
    ),
  ).toBe(false);
});
test("One task dataset: natural language, calendar scheduling, completion, and reload", async ({
  page,
}) => {
  await page
    .getByLabel("Quick add personal work")
    .fill("Prepare deployment tomorrow 2pm");
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
  await page.getByLabel("Next planning period").click();
  await expect(page.locator(".plan-task")).toContainText("Prepare deployment");
  await revealPlanningActions(page, 'Prepare deployment');
  await expect(page.getByLabel("Time for Prepare deployment")).toHaveValue(
    "14:00",
  );
  await page.getByLabel("Complete Prepare deployment").click();
  await expect(page.locator(".plan-task.done")).toContainText(
    "Prepare deployment",
  );
  await page.reload();
  await expect(page.getByLabel("Workspace data mode")).toHaveValue("connected");
  await page.getByLabel("Next planning period").click();
  await expect(page.locator(".plan-task.done")).toContainText(
    "Prepare deployment",
  );
  expect(
    await page.evaluate(() =>
      window.__fixture.calls.some((c) => c.action === "jira.transition"),
    ),
  ).toBe(false);
});
test("Weekly planning: backlog drag into date and month/week/day use same work", async ({
  page,
}) => {
  await page
    .locator('.live-inbox [data-linked-work="PAY-382"]')
    .getByRole("button", { name: "Backlog", exact: true })
    .click();
  await page
    .getByRole("button", { name: "This Week", exact: true })
    .first()
    .click();
  const task = page
    .locator(".plan-task")
    .filter({ hasText: "Payment retry implementation" })
    .last();
  const target = page.locator(".planning-grid section").nth(2);
  const label = await target.getAttribute("aria-label");
  await task.dragTo(target);
  await expect(target).toContainText("Payment retry implementation");
  await page
    .getByRole("button", { name: "Calendar", exact: true })
    .first()
    .click();
  await page.getByLabel("Calendar range").selectOption("Month");
  await expect(page.locator(".planning-grid section")).toHaveCount(42);
  await page.getByLabel("Planning date").fill(label.replace("Plan for ", ""));
  await page.getByLabel("Calendar range").selectOption("Day");
  await expect(page.locator(".planning-grid")).toContainText(
    "Payment retry implementation",
  );
});
test("End of day moves only unfinished tasks and shows next day", async ({
  page,
}) => {
  for (const title of ["Completed work", "Unfinished work"]) {
    await page.getByLabel("Quick add personal work").fill(title);
    await page
      .getByRole("button", { name: "Add to plan", exact: true })
      .click();
  }
  await page.getByLabel("Complete Completed work").click();
  await page
    .getByRole("button", { name: "Move unfinished to next day" })
    .click();
  await expect(page.getByRole("region", { name: "Personal agenda" })).toContainText(
    "Unfinished work",
  );
  await expect(page.getByRole("region", { name: "Personal agenda" })).not.toContainText(
    "Completed work",
  );
  await page.getByLabel("Previous planning period").click();
  await expect(page.locator(".plan-task.done")).toContainText("Completed work");
});
test("Global search keyboard opens real result and preserves original view", async ({
  page,
}) => {
  await shortcut(page, "k");
  await page.getByLabel("Connected global search").fill("PAY-382");
  await expect(
    page
      .locator("[cmdk-item]")
      .filter({ hasText: "PAY-382 Payment retry implementation" }),
  ).toBeVisible();
  await page.getByLabel("Connected global search").press("Home");
  await page.getByLabel("Connected global search").press("Enter");
  await expect(page.getByLabel("Live issue inspector")).toContainText(
    "Payment retry implementation",
  );
  await page.getByLabel("Close context preview").click();
  await expect(
    page.getByRole("heading", { name: "Your workday" }),
  ).toBeVisible();
});
test("Development: issue → wiki → back → MR → pipeline in a retained context stack", async ({
  page,
}) => {
  await page
    .locator(".live-inbox")
    .getByRole("button", { name: /PAY-382 Payment retry implementation/ })
    .click();
  await page.getByRole("button", { name: "Find linked MR & wiki" }).click();
  await page
    .getByRole("button", { name: "Payment Retry Policy", exact: true })
    .click();
  await expect(page.locator(".remote-document")).toContainText("Bound retries");
  await page.getByLabel("Back in context").click();
  await page
    .getByRole("button", {
      name: "!7 PAY-382 Payment retry review",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  await page
    .getByRole("button", { name: "#482 · success", exact: true })
    .click();
  await expect(page.locator(".pipeline-stages")).toContainText("unit-tests");
  await page.getByLabel("Close context preview").click();
  await expect(page.locator(".live-inbox")).toBeVisible();
});
test("Issue edits: explicit assignee and due date writes, failed comment retains draft", async ({
  page,
}) => {
  await nav(page, "Projects");
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await page.getByLabel("Find Jira assignee").fill("Daniel");
  await page.getByRole("button", { name: "Find people" }).click();
  await page
    .getByLabel("Jira assignee", { exact: true })
    .selectOption("daniel");
  await page.getByRole("button", { name: "Save assignee in Jira" }).click();
  await expect(page.getByLabel("Live issue inspector")).toContainText(
    "Daniel Park",
  );
  await page.getByLabel("Jira due date").fill("2026-10-09");
  await page.getByRole("button", { name: "Save due date in Jira" }).click();
  await page.evaluate(() => window.__fixture.setFailure("jira.comment"));
  await page.getByLabel("Live Jira comment").fill("Retain the retry evidence.");
  await page.getByRole("button", { name: "Post to Jira" }).click();
  await expect(page.getByRole("alert")).toContainText("unavailable");
  await expect(page.getByLabel("Live Jira comment")).toHaveValue(
    "Retain the retry evidence.",
  );
  const edits = await page.evaluate(() =>
    window.__fixture.calls.filter((c) => c.action === "jira.edit"),
  );
  expect(edits.map((c) => c.args)).toEqual([
    { key: "PAY-382", accountId: "daniel" },
    { key: "PAY-382", due: "2026-10-09" },
  ]);
});
test("Quick creation uses selected Jira project/type and never posts before submit", async ({
  page,
}) => {
  await shortcut(page, "n");
  await page.getByRole("button", { name: "Jira issue", exact: true }).click();
  await page.getByLabel("New issue project").selectOption("PAY");
  await page.getByLabel("New issue type").selectOption("3");
  await page.getByLabel("New work title").fill("Investigate retry delay");
  await page.getByLabel("New work body").fill("Check queue latency.");
  expect(
    await page.evaluate(() =>
      window.__fixture.calls.some((c) => c.action === "jira.create"),
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Create in Jira" }).click();
  await expect(page.getByLabel("Live issue inspector")).toBeVisible();
  const post = await page.evaluate(() =>
    window.__fixture.calls.find((c) => c.action === "jira.create"),
  );
  expect(post.args).toEqual({
    project: "PAY",
    issueType: "3",
    summary: "Investigate retry delay",
    description: "Check queue latency.",
  });
});
test("Wiki publish failure preserves text; favorites and recent are usable", async ({
  page,
}) => {
  await shortcut(page, "n");
  await page
    .getByRole("button", { name: "Wiki document", exact: true })
    .click();
  await page.getByLabel("New document space").selectOption("s1");
  await page.getByLabel("New work title").fill("Retry follow-up");
  await page.getByLabel("New work body").fill("Keep a bounded queue.");
  await page.evaluate(() => window.__fixture.setFailure("confluence.create"));
  await page.getByRole("button", { name: "Publish to Confluence" }).click();
  await expect(page.getByLabel("New work body")).toHaveValue(
    "Keep a bounded queue.",
  );
  await expect(page.getByRole("alert")).toContainText("unavailable");
  await page.getByLabel("Close connected command").click();
  await nav(page, "Docs");
  await page
    .getByRole("button", { name: "Payment Retry Policy", exact: true })
    .click();
  await page.getByRole("button", { name: "Favorite", exact: true }).click();
  await page
    .locator("nav .subnav button")
    .filter({ hasText: "Favorites" })
    .click();
  await expect(page.locator(".connected-docs aside")).toContainText(
    "Payment Retry Policy",
  );
});
test("Search isolates provider failure while showing available results", async ({
  page,
}) => {
  await page.evaluate(() => window.__fixture.setFailure("confluence.search"));
  await shortcut(page, "k");
  await page.getByLabel("Connected global search").fill("Payment");
  await expect(page.getByRole("alert")).toContainText("Wiki:");
  await expect(
    page
      .locator("[cmdk-item]")
      .filter({ hasText: "PAY-382 Payment retry implementation" }),
  ).toBeVisible();
});
test("Project views use the same real Jira query and inspector", async ({
  page,
}) => {
  await nav(page, "Projects");
  for (const view of ["Board", "Sprint", "Roadmap", "Overview"]) {
    await page
      .locator("nav .subnav button")
      .filter({ hasText: new RegExp("^" + view + "$") })
      .click();
    await expect(page.locator(".connected-content")).toContainText(
      "Payment retry implementation",
    );
    const target = page
      .locator(".connected-content button")
      .filter({ hasText: "Payment retry implementation" })
      .first();
    await target.click();
    await expect(page.getByLabel("Live issue inspector")).toBeVisible();
    await page.getByLabel("Close live issue").click();
  }
});
test("Assistant reschedule is a concrete local proposal and requires confirmation", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add to Today", exact: true }).click();
  await page
    .getByRole("button", { name: /Assistant/ })
    .first()
    .click();
  await page.getByLabel("Ask Claude").fill("PAY-382 내일로 옮겨줘");
  await page.getByRole("button", { name: "Send to Claude" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm schedule" }),
  ).toBeVisible();
  await expect(page.locator(".daily-columns .plan-task")).toContainText(
    "PAY-382",
  );
  await page.getByRole("button", { name: "Confirm schedule" }).click();
  await expect(page.locator(".daily-columns .plan-task")).toHaveCount(0);
  await page.getByLabel("Close assistant").click();
  await page.getByLabel("Next planning period").click();
  await expect(page.locator(".plan-task")).toContainText("PAY-382");
  expect(
    await page.evaluate(() =>
      window.__fixture.calls.some((c) =>
        ["jira.edit", "jira.transition", "claude.chat"].includes(c.action),
      ),
    ),
  ).toBe(false);
});
test("Invalid quick-add date retains text and does not create task", async ({
  page,
}) => {
  await page
    .getByLabel("Quick add personal work")
    .fill("Prepare release 2026-02-31");
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("valid date");
  await expect(page.getByLabel("Quick add personal work")).toHaveValue(
    "Prepare release 2026-02-31",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("orbit.connected.plan.v1") || '{"tasks":[]}',
        ).tasks.length,
    ),
  ).toBe(0);
});
test("Saved links from another endpoint cannot fetch a same-id resource from the new host", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add to Today", exact: true }).click();
  await page.evaluate(
    () => (window.__fixture.configs.jira.url = "https://another.fixture.test"),
  );
  await page
    .locator(".plan-task-main")
    .getByRole("button", { name: /PAY-382/ })
    .click();
  await expect(page.getByRole("alert")).toContainText("different service URL");
  expect(
    await page.evaluate(
      () =>
        window.__fixture.calls.filter((c) => c.action === "jira.issue").length,
    ),
  ).toBe(0);
});
test("Sprint and priority use server options and explicit mutation buttons", async ({
  page,
}) => {
  await nav(page, "Projects");
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await page.getByText("Sprint & priority", { exact: true }).click();
  await page.getByLabel("Jira priority", { exact: true }).selectOption("2");
  await page.getByRole("button", { name: "Save priority in Jira" }).click();
  await page.getByLabel("Jira scrum board").selectOption("10");
  await page.getByLabel("Jira sprint", { exact: true }).selectOption("25");
  expect(
    await page.evaluate(() =>
      window.__fixture.calls.some((c) => c.action === "jira.moveSprint"),
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Move to sprint in Jira" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Sprint updated" }),
  ).toBeVisible();
});
test("Connected notification grouping adds a real review to Today and recent preview reopens", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await page
    .getByLabel("Connected attention center")
    .getByRole("button", { name: "Today", exact: true })
    .last()
    .click();
  await expect(page.locator(".daily-columns .plan-task")).toContainText(
    "Payment retry review",
  );
  await page.getByLabel("Close attention").click();
  await page
    .locator(".plan-task-main")
    .getByRole("button", { name: /Payment retry review/ })
    .click();
  await expect(
    page.getByRole("group", { name: "Dependency flow diagram" }),
  ).toBeVisible();
  await page.getByLabel("Close context preview").click();
  await page
    .getByRole("button", { name: "Recently viewed", exact: true })
    .click();
  await page
    .locator(".recent-popover")
    .getByRole("button", { name: /Payment retry review/ })
    .click();
  await expect(
    page.getByRole("group", { name: "Dependency flow diagram" }),
  ).toBeVisible();
});
test("Personal work can be edited without losing typing focus and removed locally", async ({
  page,
}) => {
  await page.getByLabel("Quick add personal work").fill("Draft runbook");
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
  await page
    .locator(".plan-task-main")
    .getByRole("button", { name: "Draft runbook", exact: true })
    .click();
  await page.getByLabel("Personal work title").fill("Review runbook");
  await page.getByRole("button", { name: "Save personal work" }).click();
  await expect(page.locator(".plan-task")).toContainText("Review runbook");
  await page
    .locator(".plan-task-main")
    .getByRole("button", { name: "Review runbook", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete personal work" }).click();
  await expect(page.locator(".plan-task")).toHaveCount(0);
});
test('Assistant is available inside an MR preview without hiding behind the context panel',async({page})=>{
 await page.locator('.attention-row').getByRole('button',{name:/Payment retry review/}).click();await expect(page.getByRole('group',{name:'Dependency flow diagram'})).toBeVisible();await page.keyboard.press('Meta+j');await expect(page.locator('.object-panel').getByLabel('Ask Claude')).toBeVisible();await page.locator('.object-panel').getByLabel('Ask Claude').fill('리뷰할 부분 알려줘');await page.locator('.object-panel').getByRole('button',{name:'Send to Claude'}).click();await expect(page.locator('.object-panel .live-chat-message.assistant')).toContainText('idempotency');const call=await page.evaluate(()=>window.__fixture.calls.find(c=>c.action==='claude.chat'));expect(call.args.context).toContain('PAY-382');
});
test('Month overview fits six weeks and diagram fit avoids hidden components',async({page})=>{
 await page.getByRole('button',{name:'Calendar',exact:true}).first().click();await page.getByLabel('Calendar range').selectOption('Month');const bounds=await page.locator('.planning-grid').boundingBox();expect(bounds.height).toBeLessThan(520);await nav(page,'Home');await page.locator('.attention-row').getByRole('button',{name:/Payment retry review/}).click();await page.keyboard.press('Meta+j');await page.getByLabel('Fit diagram to panel').click();const fits=await page.locator('.diagram-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+1);expect(fits).toBe(true);
});
test('Calendar advances by actual months and days, including month-end clamping',async({page})=>{
 await page.getByRole('button',{name:'Calendar',exact:true}).first().click();await page.getByLabel('Calendar range').selectOption('Month');await page.getByLabel('Planning date').fill('2026-01-31');await page.getByLabel('Next planning period').click();await expect(page.getByLabel('Planning date')).toHaveValue('2026-02-28');await page.getByLabel('Calendar range').selectOption('Day');await page.getByLabel('Next planning period').click();await expect(page.getByLabel('Planning date')).toHaveValue('2026-03-01');
});
