import { test, expect } from "@playwright/test";
test.setTimeout(15000);
const nav = (p, name) =>
  p.locator("nav").getByRole("button", { name, exact: true }).click();
const panel = (p) => p.getByRole("complementary", { name: "Detail inspector" });
const openReview = async (p) => {
  await nav(p, "Home");
  await p.getByRole("button", { name: /Review changes/ }).click();
  await p.getByRole("button", { name: "Review overview", exact: true }).click();
};
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("OSS-01 topmost Escape preserves inspector and returns focus", async ({
  page,
}) => {
  await nav(page, "Projects");
  const origin = page.getByRole("button", { name: "PAY-382", exact: true });
  await origin.click();
  await page.keyboard.press("Control+k");
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(origin).toBeFocused();
});
test("OSS-02 scoped search survives screen changes and history", async ({
  page,
}) => {
  await nav(page, "Projects");
  await page.getByPlaceholder("Filter issues…").fill("retry");
  await nav(page, "Code");
  await page.getByPlaceholder("Filter merge requests…").fill("order");
  await page.getByLabel("Go back", { exact: true }).click();
  await expect(page.getByPlaceholder("Filter issues…")).toHaveValue("retry");
  await nav(page, "Code");
  await expect(page.getByPlaceholder("Filter merge requests…")).toHaveValue(
    "order",
  );
});
test("OSS-03 command combobox has stable selection, empty recovery, IME protection", async ({
  page,
}) => {
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox", { name: "Global search input" });
  await expect(input).toBeVisible();
  await input.fill("PAY-382");
  await expect(page.getByRole("option")).toHaveCount(7);
  await expect(page.getByRole("option").filter({ hasText: "Separate capture and refund request paths" })).toHaveCount(1);
  await expect(page.getByRole("option").filter({ hasText: "Introduce durable payment recovery" })).toHaveCount(1);
  await expect(page.getByRole("option").filter({ hasText: "Unify settlement API, Kafka delivery and reconciliation" })).toHaveCount(1);
  await page.keyboard.press("End");
  await expect(page.getByRole("option").last()).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Home");
  await expect(page.getByRole("option").first()).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).toBeTruthy();
  await input.dispatchEvent("keydown", {
    key: "Enter",
    code: "Enter",
    isComposing: true,
    keyCode: 229,
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await input.fill("zzzzzz-no-results");
  await expect(page.getByRole("option")).toHaveCount(0);
  await page.keyboard.press("ArrowDown");
  await input.fill("order mapping");
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(panel(page)).toContainText("Fix order status mapping");
});
test("OSS-04 issue focus mode and local draft survive dismissal", async ({
  page,
}) => {
  await nav(page, "Projects");
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await panel(page)
    .getByRole("button", { name: "Expand inspector", exact: true })
    .click();
  await expect(panel(page)).toHaveClass(/expanded/);
  await panel(page)
    .getByLabel("Issue comment")
    .fill("Verify the retry budget before rollout.");
  await panel(page).getByLabel("Close inspector").click();
  await page.getByRole("button", { name: "API-128", exact: true }).click();
  await expect(panel(page).getByLabel("Issue comment")).toHaveValue("");
  await panel(page).getByLabel("Close inspector").click();
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await expect(panel(page).getByLabel("Issue comment")).toHaveValue(
    "Verify the retry budget before rollout.",
  );
  await panel(page).getByLabel("Issue comment").press("Control+Enter");
  await expect(
    panel(page).getByText("Verify the retry budget before rollout.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("OSS-05 GitLab-style viewed files persist without approving the MR", async ({
  page,
}) => {
  await openReview(page);
  await page.getByRole("checkbox", { name: "Viewed OrderService.ts" }).check();
  await expect(page.getByTestId("review-progress")).toHaveText(
    "1 / 4 files viewed",
  );
  await expect(page.getByText("This file is marked as viewed.")).toBeVisible();
  await page
    .getByRole("button", { name: "Next unviewed file", exact: true })
    .click();
  await expect(page.locator(".diff-file-title")).toContainText(
    "StatusMapper.ts",
  );
  await page.reload();
  await openReview(page);
  await expect(page.getByTestId("review-progress")).toHaveText(
    "1 / 4 files viewed",
  );
  await expect(
    page.getByRole("button", { name: "Approve changes", exact: true }),
  ).toBeEnabled();
});
test("OSS-06 review drafts remain private until explicit submission", async ({
  page,
}) => {
  await openReview(page);
  await page.getByLabel("Comment on line 24", { exact: true }).click();
  await page
    .getByLabel("Review comment", { exact: true })
    .fill("Please test unknown order states.");
  await page
    .getByRole("button", { name: "Add to review", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Review draft (1)", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("orbit-comments") || "{}")["mr-391"] ||
        [],
    ),
  ).toHaveLength(0);
  await page
    .getByRole("button", { name: "Review draft (1)", exact: true })
    .click();
  await page.getByLabel("Review outcome").selectOption("Approve");
  await page
    .getByRole("button", { name: "Submit review", exact: true })
    .click();
  await expect(
    page.getByText("OrderService.ts:24 — Please test unknown order states.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("orbit-mrs")).find(
          (m) => m.id === "391",
        ).status,
    ),
  ).toBe("Approved");
});
test("OSS-07 log include/exclude filters preserve query and JSON contains same event", async ({
  page,
}) => {
  await nav(page, "Observe");
  await page.getByLabel("Search logs").fill("ConnectionPoolTimeout");
  await page.getByLabel("Log level", { exact: true }).selectOption("ERROR");
  await page.locator(".log-table tbody tr").first().click();
  await panel(page)
    .getByRole("button", {
      name: "Filter for service payment-api",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Search logs")).toHaveValue(
    "ConnectionPoolTimeout",
  );
  await expect(page.getByLabel("Log level", { exact: true })).toHaveValue(
    "ERROR",
  );
  await expect(page.locator(".filter-chips")).toContainText(
    "service = payment-api",
  );
  await panel(page).getByRole("button", { name: "JSON", exact: true }).click();
  await expect(panel(page).locator(".log-json")).toContainText(
    '"service": "payment-api"',
  );
  await panel(page)
    .getByRole("button", { name: "Fields", exact: true })
    .click();
  await panel(page)
    .getByRole("button", {
      name: "Filter out service payment-api",
      exact: true,
    })
    .click();
  await expect(page.locator(".filter-chips")).toContainText(
    "service ≠ payment-api",
  );
  await expect(page.locator(".filter-chip")).toHaveCount(1);
  for (const text of await page
    .locator(".log-table tbody tr td:nth-child(2)")
    .allTextContents())
    expect(text).not.toBe("payment-api");
  await page
    .getByRole("button", { name: "Remove filter service", exact: true })
    .click();
  await expect(page.locator(".log-table tbody tr")).toHaveCount(7);
});
test("OSS-08 log details navigate current result set and surrounding logs keep search intact", async ({
  page,
}) => {
  await nav(page, "Observe");
  await page.getByLabel("Service", { exact: true }).selectOption("payment-api");
  await page.getByLabel("Log level", { exact: true }).selectOption("ERROR");
  await page.locator(".log-table tbody tr").first().click();
  const first = await panel(page).locator(".panel-hero p").textContent();
  await panel(page).getByLabel("Next result").click();
  await expect(panel(page).locator(".panel-hero p")).not.toHaveText(first);
  await panel(page)
    .getByRole("button", { name: "Surrounding logs", exact: true })
    .click();
  await expect(panel(page).getByTestId("surrounding-logs")).toBeVisible();
  await expect(page.getByLabel("Log level", { exact: true })).toHaveValue(
    "ERROR",
  );
});
