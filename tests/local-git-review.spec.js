import { openReviewComposer } from "./fixtures/review-composer.mjs";
import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";

async function localReview(page) {
  await installConnected(page);
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await original(action, args);
      if (action === "gitlab.mr") result.local = {
        mode: "local-git", headSha: result.mr.diff_refs.head_sha,
        sourceBranch: "feature/payment-retry", syncedAt: "2026-10-04T01:20:00.000Z",
        worktreePath: "/private/worklane/repositories/payment-api/reviews/7",
      };
      return result;
    };
  });
  await page.locator(".attention-row").getByRole("button", { name: /Payment retry review/ }).click();
}

test("Local checkout provenance is explicit, keyboard dismissible, and source reads are cached", async ({ page }) => {
  await localReview(page);
  const summary = page.getByLabel("Local checkout details");
  await summary.click();
  await expect(page.locator(".review-local-checkout-details")).toContainText("feature/payment-retry");
  await expect(page.locator(".review-local-checkout-details")).toContainText("outside the encrypted assistant memory");
  await expect(page.locator(".review-local-checkout-details")).toContainText("/private/worklane/repositories/payment-api/reviews/7");
  await summary.press("Escape");
  await expect(page.locator(".review-local-checkout-details")).not.toBeVisible();
  await expect(page.locator(".review-workbench")).toBeVisible();
  await expect(summary).toBeFocused();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(page.getByLabel("Component code")).toContainText("PaymentController");
  await expect(page.locator(".code-provenance")).toContainText("Local Git code");
  await page.getByRole("button", { name: "Diff", exact: true }).click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  const calls = await page.evaluate(() => window.__fixture.calls.filter(call => call.action === "gitlab.code"));
  expect(calls).toHaveLength(1);
  expect(calls[0].args.projectId).toBe(42);
  expect(calls[0].args.path).toMatch(/PaymentController/);
  expect(calls[0].args.ref).toBeTruthy();
});

test("Explicit refresh requests a fetch and keeps a pending local review draft", async ({ page }) => {
  await localReview(page);
  await openReviewComposer(page);
  await page.getByLabel("Diagram review comment").fill("Check the local implementation before posting.");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__fixture.calls.filter(call => call.action === "gitlab.mr").length)).toBe(2);
  const calls = await page.evaluate(() => window.__fixture.calls.filter(call => call.action === "gitlab.mr"));
  expect(calls.at(-1).args.refresh).toBe(true);
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("Check the local implementation before posting.");
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toHaveAttribute("title", "Fetch latest commits and refresh review metadata");
});

test("Snapshots without local checkout evidence do not claim local source storage", async ({ page }) => {
  await installConnected(page);
  await page.locator(".attention-row").getByRole("button", { name: /Payment retry review/ }).click();
  await expect(page.getByLabel("Local checkout details")).toHaveCount(0);
  await expect(page.locator(".code-provenance")).toContainText("Repository code");
});

test("Slow checkout refresh keeps code and editable draft visible while deferring new review submissions", async ({ page }) => {
  await localReview(page);
  await openReviewComposer(page);
  await page.getByLabel("Diagram review comment").fill("Initial checkout review.");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(page.getByLabel("Component code")).toContainText("PaymentController");
  await page.getByRole("button", { name: "Approve MR", exact: true }).click();
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      if (action === "gitlab.mr") await new Promise(resolve => { window.releaseCheckoutRefresh = resolve; });
      return original(action, args);
    };
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("Refreshing checkout and review context… You can keep reading and editing your draft.")).toBeVisible();
  await expect(page.getByLabel("Component code")).toContainText("PaymentController");
  await openReviewComposer(page);
  await page.getByLabel("Diagram review comment").fill("Keep this draft through the fetch.");
  await expect(page.getByRole("button", { name: "Post to GitLab", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Confirm approval", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Generate AI guide", exact: true })).toBeDisabled();
  await page.getByLabel("Diagram review comment").press("Control+Enter");
  expect(await page.evaluate(() => window.__fixture.calls.filter(call => ["gitlab.comment", "gitlab.approve", "claude.review"].includes(call.action)))).toHaveLength(0);
  await page.evaluate(() => window.releaseCheckoutRefresh());
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("Keep this draft through the fetch.");
  await expect(page.getByLabel("Component code")).toContainText("PaymentController");
});

test("Failed checkout refresh keeps review context and draft available for retry", async ({ page }) => {
  await localReview(page);
  await openReviewComposer(page);
  await page.getByLabel("Diagram review comment").fill("Private draft stays with this commit.");
  await page.evaluate(() => window.__fixture.setFailure("gitlab.mr"));
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Fixture service unavailable");
  await expect(page.getByLabel("Component code")).toBeVisible();
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("Private draft stays with this commit.");
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  await page.evaluate(() => window.__fixture.setFailure(""));
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("Private draft stays with this commit.");
});
