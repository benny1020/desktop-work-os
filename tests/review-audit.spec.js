import { openReviewComposer } from "./fixtures/review-composer.mjs";
import { test, expect } from "@playwright/test";
import { installConnected, snapshot } from "./fixtures/connected.mjs";

const openReview = (page) => page.locator(".attention-row").getByRole("button", { name: /Payment retry review/ }).click();
test("Switching a removed diff line to head source cannot post against the old line", async ({ page }) => {
  await installConnected(page);
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await invoke(action, args);
      if (action === "gitlab.mr") result.files[0].rows.unshift({ kind: "removed", text: "return oldCapture(request);", oldLine: 5, newLine: null });
      return result;
    };
  });
  await openReview(page);
  await page.getByRole("button", { name: "Select old line 5", exact: true }).click();
  await openReviewComposer(page);
  await page.getByLabel("Diagram review comment").fill("This applies to the deleted implementation.");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(page.locator(".code-provenance")).not.toContainText("Selected old line");
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("");
  await page.getByRole("button", { name: "Select source line 5", exact: true }).click();
  await openReviewComposer(page);
  await page.getByLabel("Diagram review comment").fill("Check the current implementation.");
  await page.getByRole("button", { name: "Post to GitLab", exact: true }).click();
  const call = await page.evaluate(() => window.__fixture.calls.find((c) => c.action === "gitlab.comment"));
  expect(call.args.side).toBe("new");
  await page.getByRole("button", { name: "Diff", exact: true }).click();
  await page.getByRole("button", { name: "Select old line 5", exact: true }).click();
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("This applies to the deleted implementation.");
});

test("Invalid persisted draft shape cannot crash an MR preview", async ({ page }) => {
  await installConnected(page);
  await page.evaluate(({ mr }) => {
    localStorage.setItem(`orbit-visual-drafts:live:${mr.web_url}:${mr.iid}:${mr.diff_refs.head_sha}`, "null");
  }, snapshot);
  await openReview(page);
  await openReviewComposer(page);
  await expect(page.getByLabel("Diagram review comment")).toBeVisible();
});

test("Full local storage keeps the review usable and reports an unsaved draft", async ({ page }) => {
  await installConnected(page);
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith("orbit-visual-drafts:")) throw new DOMException("Storage is full", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  });
  await openReview(page);
  await openReviewComposer(page);
  await page.getByLabel("Diagram review comment").fill("Keep this draft visible.");
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("Keep this draft visible.");
  await expect(page.getByRole("alert")).toContainText("Draft could not be saved");
});

test("Short narrow review keeps comment, failed approval, and retry reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 650 });
  await installConnected(page); await openReview(page);
  await page.getByRole("button", { name: "Open component PaymentService.ts", exact: true }).click();
  await openReviewComposer(page);
  await page.getByLabel("Diagram review comment").fill("Check retry bounds.");
  await page.getByRole("button", { name: "Post to GitLab", exact: true }).click();
  await page.evaluate(() => window.__fixture.setFailure("gitlab.approve"));
  await page.getByRole("button", { name: "Approve MR", exact: true }).click();
  await page.getByRole("button", { name: "Confirm approval", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Fixture service unavailable");
  await page.evaluate(() => window.__fixture.setFailure(""));
  await page.getByRole("button", { name: "Confirm approval", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approved", exact: true })).toBeDisabled();
});

test("Changing the base revision isolates old-line drafts and returning restores the original draft", async ({ page }) => {
  await installConnected(page);
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.__baseRevision = "base-one";
    window.orbit.invoke = async (action, args) => {
      if (action === "gitlab.code") return { content: `// ${args.ref}\nexport const removed = '${args.ref}';` };
      const result = await invoke(action, args);
      if (action === "gitlab.mr") {
        result.mr.diff_refs.base_sha = window.__baseRevision;
        result.files[0].deleted_file = true;
        result.files[0].rows = [{ kind: "removed", text: `export const removed = '${window.__baseRevision}';`, oldLine: 2, newLine: null }];
      }
      return result;
    };
  });
  await page.locator('nav .nav-item[aria-label="Code"]').click();
  await page.getByRole("button", { name: /PAY-382 Payment retry review/ }).click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.getByRole("button", { name: "Select source line 2", exact: true }).click();
  await openReviewComposer(page);
  await page.getByLabel("Diagram review comment").fill("This applies only to base-one.");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("This applies only to base-one.");
  await page.getByRole("button", { name: "Generate AI guide", exact: true }).click();
  await expect(page.locator(".guide-summary")).toBeVisible();
  await page.evaluate(() => window.__baseRevision = "base-two");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByLabel("Component code")).toContainText("base-two");
  await expect(page.locator(".code-provenance")).not.toContainText("Selected");
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("");
  await expect(page.locator(".guide-summary")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Diff base changed" })).toBeVisible();
  await page.getByRole("button", { name: "Select source line 2", exact: true }).click();
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("");
  await openReviewComposer(page);
  await page.getByLabel("Diagram review comment").fill("This applies only to base-two.");
  await page.evaluate(() => window.__baseRevision = "base-one");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Select source line 2", exact: true }).click();
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("This applies only to base-one.");
});

test("Legacy old-line drafts require explicit reuse without losing their original saved text", async ({ page }) => {
  await installConnected(page);
  await page.evaluate(({ mr, files }) => {
    const original = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await original(action, args);
      if (action === "gitlab.mr") result.files[0].rows.unshift({ kind: "removed", text: "old implementation", oldLine: 90, newLine: null });
      return result;
    };
    localStorage.setItem(`orbit-visual-drafts:live:${mr.web_url}:${mr.iid}:${mr.diff_refs.head_sha}`, JSON.stringify({ [`${files[0].path}:old:90`]: "Earlier version's review note." }));
  }, snapshot);
  await openReview(page);
  await page.getByRole("button", { name: "Select old line 90", exact: true }).click();
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("");
  await page.getByText("Earlier draft needs a base revision check", { exact: true }).click();
  await expect(page.locator(".legacy-review-draft pre")).toContainText("Earlier version's review note.");
  await page.getByRole("button", { name: "Use text for this version", exact: true }).click();
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("Earlier version's review note.");
  const saved = await page.evaluate(({ mr }) => JSON.parse(localStorage.getItem(`orbit-visual-drafts:live:${mr.web_url}:${mr.iid}:${mr.diff_refs.head_sha}`)), snapshot);
  expect(saved[`${snapshot.files[0].path}:old:90`]).toBe("Earlier version's review note.");
  expect(Object.keys(saved).some((key) => key.includes(":refs:"))).toBe(true);
});
