import { openReviewComposer } from "./fixtures/review-composer.mjs";
import { test, expect } from "@playwright/test";
import { installConnected, snapshot } from "./fixtures/connected.mjs";

const paths = snapshot.files.map((file) => file.path);
const openReview = (page) => page.locator(".attention-row")
  .getByRole("button", { name: /Payment retry review/ }).click();
const viewed = (page, path) => page.getByRole("checkbox", { name: `Mark ${path} as viewed`, exact: true });

test.beforeEach(async ({ page }) => {
  await installConnected(page);
  await openReview(page);
});

test("Visual review progress persists, skips viewed files, wraps, and never approves", async ({ page }) => {
  await expect(page.getByRole("progressbar", { name: "Files viewed" })).toHaveAttribute("value", "0");
  await viewed(page, paths[0]).check();
  await page.getByRole("button", { name: "Next unreviewed", exact: true }).click();
  await expect(viewed(page, paths[1])).not.toBeChecked();
  await viewed(page, paths[1]).check();
  await page.getByRole("button", { name: "Next unreviewed", exact: true }).click();
  await expect(viewed(page, paths[2])).toBeVisible();
  await page.getByLabel("Close context preview").click();
  await page.reload();
  await openReview(page);
  await expect(viewed(page, paths[0])).toBeChecked();
  await expect(page.getByRole("progressbar", { name: "Files viewed" })).toHaveAttribute("value", "2");
  await page.getByRole("button", { name: "Next unreviewed", exact: true }).click();
  await expect(viewed(page, paths[2])).toBeVisible();
  for (const path of paths.slice(2)) {
    await viewed(page, path).check();
    if (path !== paths.at(-1)) await page.getByRole("button", { name: "Next unreviewed", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Next unreviewed", exact: true })).toBeDisabled();
  // A reviewed file remains directly reachable, and reopening it does not erase its status.
  await page.getByRole("button", { name: `Open component ${paths[0].split("/").at(-1)}`, exact: true }).click();
  await viewed(page, paths[0]).uncheck();
  await page.getByRole("button", { name: `Open component ${paths.at(-1).split("/").at(-1)}`, exact: true }).click();
  await page.getByRole("button", { name: "Next unreviewed", exact: true }).click();
  await expect(viewed(page, paths[0])).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Approve MR", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => window.__fixture.calls.some((call) => call.action === "gitlab.approve"))).toBe(false);
});

test("New diff SHA and another server's same MR cannot inherit viewed status", async ({ page }) => {
  await viewed(page, paths[0]).check();
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await invoke(action, args);
      if (action === "gitlab.mr") result.mr.diff_refs.head_sha = "new-commit-after-review";
      return result;
    };
  });
  await page.locator(".visual-review-heading").getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".visual-review-heading")).toContainText("new-comm");
  await expect(viewed(page, paths[0])).not.toBeChecked();
  await viewed(page, paths[0]).check();
  await page.getByLabel("Close context preview").click();
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await invoke(action, args);
      if (action === "gitlab.mr") result.mr.web_url = "https://other.fixture.test/platform/payment-api/-/merge_requests/7";
      return result;
    };
  });
  await openReview(page);
  await expect(viewed(page, paths[0])).not.toBeChecked();
});

test("Typing while a review comment is posting preserves the new draft", async ({ page }) => {
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      if (action !== "gitlab.comment") return invoke(action, args);
      return new Promise((resolve) => {
        window.__completeComment = async () => resolve(await invoke(action, args));
      });
    };
  });
  await openReviewComposer(page);
  const draft = page.getByRole("textbox", { name: "Diagram review comment" });
  await draft.fill("Please cover timeout retries.");
  await page.getByRole("button", { name: "Post to GitLab", exact: true }).click();
  await expect(page.getByRole("button", { name: "Posting…", exact: true })).toBeDisabled();
  await draft.fill("Also check duplicate delivery.");
  await page.evaluate(() => window.__completeComment());
  await expect(page.getByRole("button", { name: "Post to GitLab", exact: true })).toBeEnabled();
  await expect(draft).toHaveValue("Also check duplicate delivery.");
  await page.getByLabel("Close context preview").click();
  await openReview(page);
  await expect(draft).toHaveValue("Also check duplicate delivery.");
  const call = await page.evaluate(() => window.__fixture.calls.find((item) => item.action === "gitlab.comment"));
  expect(call.args.body).toBe("Please cover timeout retries.");
});
