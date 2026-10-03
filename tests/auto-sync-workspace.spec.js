import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-04T09:00:00+09:00") });
  await installConnected(page);
});
const nav = (page, section) => page.locator(`nav .nav-item[aria-label="${section}"]`).click();

test("Home automatically updates successful services while keeping failed service results and personal drafts", async ({ page }) => {
  await expect(page.locator(".live-inbox")).toContainText("Payment retry implementation");
  await expect(page.locator(".daily-connected .attention-row")).toContainText(["PAY-382 Payment retry review", "Payment retry implementation"]);
  await page.getByLabel("Quick add personal work").fill("Unsubmitted planning note");
  await page.evaluate(() => {
    window.__fixture.issue.fields.summary = "Fresh payment retry implementation";
    window.__fixture.setFailure("gitlab.mrs");
  });
  await page.clock.runFor(61_000);
  await expect(page.locator(".live-inbox")).toContainText("Fresh payment retry implementation");
  await expect(page.locator(".daily-connected .attention-row").first()).toContainText("PAY-382 Payment retry review");
  await expect(page.getByLabel("Quick add personal work")).toHaveValue("Unsubmitted planning note");
  await expect(page.locator(".daily-connected")).toContainText("Fixture service unavailable");
});

test("Periodic Jira sync refreshes all loaded pages and never applies unfinished JQL", async ({ page }) => {
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.listRevision = "Initial";
    window.orbit.invoke = async (action, args) => {
      const result = await original(action, args);
      if (action === "jira.issues") {
        const second = Boolean(args.nextPageToken);
        return { issues: [{ ...result.issues[0], id: second ? "2" : "1", key: second ? "PAY-383" : "PAY-382",
          fields: { ...result.issues[0].fields, summary: `${window.listRevision} page ${second ? 2 : 1}` } }],
          nextPageToken: second ? undefined : "page-two" };
      }
      return result;
    };
  });
  await nav(page, "Projects");
  await page.getByRole("button", { name: "Issues", exact: true }).click();
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(page.locator(".connected-content")).toContainText("Initial page 2");
  const applied = await page.getByLabel("Jira query").inputValue();
  await page.getByLabel("Jira query").fill("unfinished JQL that must not run");
  await page.evaluate(() => { window.listRevision = "Updated"; window.startOfSyncCalls = window.__fixture.calls.length; });
  await page.clock.runFor(61_000);
  await expect(page.locator(".connected-content")).toContainText("Updated page 1");
  await expect(page.locator(".connected-content")).toContainText("Updated page 2");
  await expect(page.getByLabel("Jira query")).toHaveValue("unfinished JQL that must not run");
  const calls = await page.evaluate(() => window.__fixture.calls.slice(window.startOfSyncCalls).filter(call => call.action === "jira.issues"));
  expect(calls).toHaveLength(2);
  expect(calls.map(call => call.args.jql)).toEqual([applied, applied]);
  expect(calls[1].args.nextPageToken).toBe("page-two");
});

test("Confluence auto sync preserves the open document and leaves unsent search text untouched", async ({ page }) => {
  await nav(page, "Docs");
  await page.getByRole("button", { name: "Payment Retry Policy", exact: true }).click();
  await expect(page.locator(".connected-docs article")).toContainText("Bound retries to three attempts");
  await page.getByLabel("Find Confluence page").fill("Unsubmitted title");
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.startOfSyncCalls = window.__fixture.calls.length;
    window.orbit.invoke = async (action, args) => {
      const result = await original(action, args);
      if (action === "confluence.page") result.body.storage.value = "<h2>Updated policy</h2><p>Retry with the same idempotency key.</p>";
      return result;
    };
  });
  await page.clock.runFor(61_000);
  await expect(page.locator(".connected-docs article")).toContainText("Retry with the same idempotency key");
  await expect(page.getByLabel("Find Confluence page")).toHaveValue("Unsubmitted title");
  const calls = await page.evaluate(() => window.__fixture.calls.slice(window.startOfSyncCalls).filter(call => call.action === "confluence.pages"));
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.every(call => !call.args.title)).toBe(true);
});

test("Attention sync keeps previous Jira results if Jira fails while updating review requests", async ({ page }) => {
  await page.getByLabel("Notifications", { exact: true }).click();
  const attention = page.getByRole("complementary", { name: "Connected attention center" });
  await expect(attention).toContainText("Payment retry implementation");
  await page.evaluate(() => {
    window.__fixture.setFailure("jira.issues");
    const original = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await original(action, args);
      if (action === "gitlab.mrs") result.items[0].title = "Updated review request";
      return result;
    };
  });
  await page.clock.runFor(61_000);
  await expect(attention).toContainText("Updated review request");
  await expect(attention).toContainText("Payment retry implementation");
  await expect(attention).toContainText("Last available results are kept");
});

test("GitLab lists synchronize in place without resetting the repository filter", async ({ page }) => {
  await nav(page, "Code");
  await page.getByLabel("GitLab repository").selectOption("42");
  await expect(page.locator(".connected-table")).toContainText("PAY-382 Payment retry review");
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.startOfSyncCalls = window.__fixture.calls.length;
    window.orbit.invoke = async (action, args) => {
      const result = await original(action, args);
      if (action === "gitlab.mrs") result.items[0].title = "Updated GitLab merge request";
      return result;
    };
  });
  await page.clock.runFor(61_000);
  await expect(page.locator(".connected-table")).toContainText("Updated GitLab merge request");
  await expect(page.getByLabel("GitLab repository")).toHaveValue("42");
  const calls = await page.evaluate(() => window.__fixture.calls.slice(window.startOfSyncCalls).filter(call => call.action === "gitlab.mrs"));
  expect(calls.every(call => call.args.projectId === "42")).toBe(true);
});

test("A failed later page never replaces the complete previously loaded Jira result", async ({ page }) => {
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.failSecondPage = false;
    window.orbit.invoke = async (action, args) => {
      const result = await original(action, args);
      if (action === "jira.issues") {
        if (args.nextPageToken && window.failSecondPage) throw new Error("Page two temporarily unavailable");
        const second = Boolean(args.nextPageToken);
        return { issues: [{ ...result.issues[0], id: second ? "2" : "1", key: second ? "PAY-383" : "PAY-382",
          fields: { ...result.issues[0].fields, summary: `${window.failSecondPage ? "New" : "Saved"} page ${second ? 2 : 1}` } }],
          nextPageToken: second ? undefined : "page-two" };
      }
      return result;
    };
  });
  await nav(page, "Projects");
  await page.getByRole("button", { name: "Issues", exact: true }).click();
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(page.locator(".connected-content")).toContainText("Saved page 2");
  await page.evaluate(() => { window.failSecondPage = true; });
  await page.clock.runFor(61_000);
  await expect(page.locator(".connected-content")).toContainText("Saved page 1");
  await expect(page.locator(".connected-content")).toContainText("Saved page 2");
  await expect(page.getByLabel("Automatic synchronization: Sync delayed · retrying automatically")).toBeVisible();
});
