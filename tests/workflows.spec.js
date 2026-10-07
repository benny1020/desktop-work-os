import { test, expect } from "@playwright/test";
const nav = async (page, name) =>
  page.locator("nav").getByRole("button", { name, exact: true }).click();
const inspector = (page) =>
  page.getByRole("complementary", { name: "Detail inspector" });
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("Morning: schedule, tasks, brief, and one-click review", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Good morning, Alex." }),
  ).toBeVisible();
  await expect(page.getByText("Daily standup", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Assistant brief", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Review changes/ }).click();
  await expect(
    page.getByRole("heading", { name: "Fix order status mapping" }),
  ).toBeVisible();
  await expect(
    page.getByText("Architecture layers", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/review-light.png" });
});
test("Development: linked previews preserve issue list and editable state", async ({
  page,
}) => {
  await nav(page, "Projects");
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  const panel = inspector(page);
  await panel.getByLabel("Inspector Status").selectOption("In Review");
  await expect(page.getByLabel("Status PAY-382", { exact: true })).toHaveValue(
    "In Review",
  );
  await panel
    .getByRole("button", { name: /Documentation Payment Retry Policy/ })
    .click();
  await expect(
    panel.getByRole("heading", { name: "Payment Retry Policy", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Project issues" }),
  ).toBeVisible();
  await panel.getByLabel("Back in inspector").click();
  await panel.getByRole("button", { name: /Merge request !381/ }).click();
  await panel.getByRole("button", { name: /Pipeline #482/ }).click();
  await expect(
    panel.getByRole("heading", { name: "Pipeline #482" }),
  ).toBeVisible();
  await panel.getByLabel("Close inspector").click();
  await page.reload();
  await nav(page, "Projects");
  await expect(page.getByLabel("Status PAY-382", { exact: true })).toHaveValue(
    "In Review",
  );
});
test("Review: structure node, line comment, discussion, approve", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Review changes/ }).click();
  await page.getByRole("button", { name: "Review overview", exact: true }).click();
  await page
    .locator(".change-map")
    .getByRole("button", { name: "StatusMapper", exact: true })
    .click();
  await expect(page.locator(".diff-file-title")).toContainText(
    "StatusMapper.ts",
  );
  await page.getByLabel("Comment on line 24", { exact: true }).click();
  await page
    .getByLabel("Review comment", { exact: true })
    .pressSequentially("Can we cover duplicate requests?");
  await expect(page.getByLabel("Review comment", { exact: true })).toHaveValue(
    "Can we cover duplicate requests?",
  );
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await page.getByRole("button", { name: "Discussion", exact: true }).click();
  await expect(
    page.getByText("StatusMapper.ts:24 — Can we cover duplicate requests?", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Changes", exact: true }).click();
  await page
    .getByRole("button", { name: "Approve changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Approved", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "My reviews", exact: true })
    .last()
    .click();
});
test("Incident: alert to logs to deploy to incident and assigned issue", async ({
  page,
}) => {
  await nav(page, "Observe");
  await page
    .locator(".tabs")
    .getByRole("button", { name: /Alerts/ })
    .click();
  await page
    .getByRole("button", { name: /Payment API error rate elevated/ })
    .click();
  await inspector(page)
    .getByRole("button", { name: "Explore logs", exact: true })
    .click();
  await expect(page.getByLabel("Service", { exact: true })).toHaveValue(
    "payment-api",
  );
  await expect(page.getByLabel("Log level", { exact: true })).toHaveValue(
    "ERROR",
  );
  await page.locator(".log-table tbody tr").first().click();
  await inspector(page)
    .getByRole("button", {
      name: "!376 Configure payment connection pool",
      exact: true,
    })
    .click();
  await expect(
    inspector(page).getByRole("heading", {
      name: "Configure payment connection pool",
    }),
  ).toBeVisible();
  await inspector(page).getByLabel("Back in inspector").click();
  await inspector(page)
    .getByRole("button", { name: "Create incident", exact: true })
    .click();
  await inspector(page)
    .getByRole("button", { name: "Create assigned issue", exact: true })
    .click();
  await expect(
    inspector(page).getByRole("button", { name: /Issue OPS-\d+ created/ }),
  ).toBeDisabled();
  await expect(page.getByLabel("Service", { exact: true })).toHaveValue(
    "payment-api",
  );
});
test("End of day: completion, tomorrow move, assistant approval gate", async ({
  page,
}) => {
  await nav(page, "My Work");
  await page.getByLabel("Complete API-128", { exact: true }).click();
  await page
    .getByRole("button", { name: "Show completed", exact: true })
    .click();
  await expect(page.locator(".task-row.completed")).toContainText("API-128");
  await page.getByLabel("Move PAY-382 to tomorrow", { exact: true }).click();
  await page
    .getByRole("button", { name: "Tomorrow, Oct 4", exact: true })
    .click();
  await expect(page.locator(".task-row")).toContainText(["PAY-382"]);
  await page
    .getByRole("button", { name: /PAY-382 Payment retry implementation/ })
    .click();
  await page.getByRole("button", { name: /Assistant ⌘ J/ }).click();
  await page
    .getByRole("button", { name: "Add this issue to today", exact: true })
    .click();
  await expect(inspector(page).getByLabel("Issue due date")).toHaveValue(
    "2025-10-04",
  );
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(inspector(page).getByLabel("Issue due date")).toHaveValue(
    "2025-10-03",
  );
});
test("Keyboard search, create, navigation, light and dark shell", async ({
  page,
}) => {
  await page.screenshot({ path: "artifacts/home-light.png" });
  await page.keyboard.press("Control+k");
  await page.getByLabel("Global search input").pressSequentially("PAY-382");
  await expect(page.getByRole("option")).toHaveCount(7);
  await expect(page.getByRole("option").filter({ hasText: "Separate capture and refund request paths" })).toHaveCount(1);
  await expect(page.getByRole("option").filter({ hasText: "Introduce durable payment recovery" })).toHaveCount(1);
  await expect(page.getByRole("option").filter({ hasText: "Unify settlement API, Kafka delivery and reconciliation" })).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(inspector(page)).toContainText("Payment retry handling");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+n");
  await page
    .getByLabel("New item title")
    .fill("Check retry queue tomorrow 2pm");
  await page.keyboard.press("Enter");
  await page.keyboard.press("g");
  await page.keyboard.press("m");
  await page
    .getByRole("button", { name: "Tomorrow, Oct 4", exact: true })
    .click();
  await expect(
    page.getByText("Check retry queue", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Toggle theme").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("g");
  await page.keyboard.press("h");
  await page.screenshot({ path: "artifacts/home-dark.png" });
  await page.getByLabel("Collapse sidebar").click();
  await expect(page.locator(".app")).toHaveClass(/sidebar-collapsed/);
});
test("Weekly drag, board drag, logs filtering, calendar modes", async ({
  page,
}) => {
  await nav(page, "My Work");
  await page
    .locator(".tabs")
    .getByRole("button", { name: "This Week", exact: true })
    .click();
  await page
    .locator(".backlog-tray")
    .getByRole("button", { name: /OPS-88/ })
    .dragTo(page.locator(".week-day").nth(4));
  await expect(page.locator(".week-day").nth(4)).toContainText("OPS-88");
  await page
    .locator(".tabs")
    .getByRole("button", { name: "Calendar", exact: true })
    .click();
  for (const mode of ["Day", "Month", "Week"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect(
      page.locator(mode === "Month" ? ".month-grid" : ".calendar-grid"),
    ).toBeVisible();
  }
  await nav(page, "Projects");
  await page
    .locator(".tabs")
    .getByRole("button", { name: "Board", exact: true })
    .click();
  await page
    .locator(".board-card")
    .filter({ hasText: "API-128" })
    .dragTo(page.locator(".board-column").nth(3));
  await expect(page.locator(".board-column").nth(3)).toContainText("API-128");
  await nav(page, "Observe");
  await page
    .getByLabel("Search logs")
    .pressSequentially("ConnectionPoolTimeout");
  await expect(page.locator(".log-table tbody tr")).toHaveCount(7);
  await page.screenshot({ path: "artifacts/logs-light.png" });
});
test("Every navigation destination renders without runtime errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const sections = {
    "My Work": [
      "Today",
      "This Week",
      "Backlog",
      "Calendar",
      "Inbox",
      "My Activity",
    ],
    Projects: ["Overview", "Issues", "Board", "Sprint", "Roadmap"],
    Code: [
      "Merge Requests",
      "My Reviews",
      "Repositories",
      "Pipelines",
      "Architecture",
    ],
    Observe: ["Overview", "Logs", "Dashboards", "Alerts", "Incidents"],
    Docs: ["Home", "Spaces", "Recent", "Favorites"],
  };
  for (const [section, views] of Object.entries(sections)) {
    await nav(page, section);
    for (const view of views) {
      await page
        .locator(".subnav")
        .getByRole("button", { name: view, exact: true })
        .click();
      await expect(page.locator(".main-content")).not.toBeEmpty();
    }
  }
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  for (const view of [
    "Integrations",
    "Notifications",
    "Workspace",
    "Preferences",
  ]) {
    await page
      .locator(".tabs")
      .getByRole("button", { name: view, exact: true })
      .click();
    await expect(page.locator(".main-content")).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});
test("Calendar drag updates issue date and Today uses the same task", async ({
  page,
}) => {
  await nav(page, "My Work");
  await page
    .locator(".tabs")
    .getByRole("button", { name: "Calendar", exact: true })
    .click();
  await page
    .locator(".calendar-all-day")
    .getByRole("button", { name: /PAY-382/ })
    .dragTo(page.locator(".calendar-day-title").nth(2));
  await page
    .locator(".tabs")
    .getByRole("button", { name: "Today", exact: true })
    .click();
  await expect(
    page.locator(".task-row").filter({ hasText: "PAY-382" }),
  ).toHaveCount(0);
  await nav(page, "Projects");
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await expect(inspector(page).getByLabel("Issue due date")).toHaveValue(
    "2025-10-01",
  );
});
test("Assistant cancellation and quick-create document and incident", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: /PAY-382 Payment retry implementation/ })
    .click();
  await page.keyboard.press("Control+j");
  await page
    .getByRole("button", { name: "Move this issue to tomorrow", exact: true })
    .click();
  await page.screenshot({ path: "artifacts/assistant-confirm.png" });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(inspector(page).getByLabel("Issue due date")).toHaveValue(
    "2025-10-03",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+n");
  await page.getByRole("button", { name: "Document", exact: true }).click();
  await page.getByLabel("New item title").fill("Payment failover decision");
  await page.getByRole("button", { name: /Create document/ }).click();
  await expect(
    page.getByRole("heading", { name: "Payment failover decision" }),
  ).toBeVisible();
  await page.keyboard.press("Control+n");
  await page.getByRole("button", { name: "Incident", exact: true }).click();
  await page.getByLabel("New item title").fill("Investigate gateway latency");
  await page.keyboard.press("Enter");
  await expect(
    inspector(page).getByRole("heading", {
      name: "Investigate gateway latency",
    }),
  ).toBeVisible();
});
test("Today reorder, navigation history, and responsive screenshot", async ({
  page,
}) => {
  await nav(page, "My Work");
  await page
    .locator(".task-row")
    .filter({ hasText: "API-128" })
    .locator(".drag-handle")
    .dragTo(page.locator(".task-row").filter({ hasText: "PAY-382" }));
  await expect(page.locator(".task-row").first()).toContainText("API-128");
  await nav(page, "Projects");
  await nav(page, "Code");
  await page.getByLabel("Go back", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Project issues" }),
  ).toBeVisible();
  await page.getByLabel("Go forward", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Merge Requests", exact: true }),
  ).toBeVisible();
  await nav(page, "Home");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Good morning, Alex." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "artifacts/home-mobile.png" });
});
