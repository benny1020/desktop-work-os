import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";

test.beforeEach(async ({ page }) => {
  await installConnected(page);
  await page.locator('nav .nav-item[aria-label="Projects"]').click();
  await page.getByRole("button", { name: "PAY-382", exact: true }).click();
  await page.getByLabel("Live Jira comment").waitFor();
  await page.evaluate(() => {
    const original = window.__fixture.invoke.bind(window.__fixture);
    window.__fixture.invoke = async (action, args) => {
      if (action === "jira.comment") {
        await new Promise((resolve, reject) => {
          window.__finishComment = resolve;
          window.__failComment = () => reject(new Error("Comment submission failed"));
        });
      }
      return original(action, args);
    };
  });
});

test("Jira comment success preserves text written while the submission was pending", async ({ page }) => {
  const draft = page.getByLabel("Live Jira comment");
  await draft.fill("Submitted retry evidence.");
  await page.getByRole("button", { name: "Post to Jira" }).click();
  await draft.fill("New follow-up thought typed during submission.");
  await page.evaluate(() => window.__finishComment());
  await expect(page.getByRole("button", { name: "Post to Jira" })).toBeEnabled();
  await expect(draft).toHaveValue("New follow-up thought typed during submission.");
  const posted = await page.evaluate(() =>
    window.__fixture.calls.filter((call) => call.action === "jira.comment"),
  );
  expect(posted).toHaveLength(1);
  expect(posted[0].args.body).toBe("Submitted retry evidence.");
});

test("Jira comment clears the submitted draft only when it has not changed", async ({ page }) => {
  const draft = page.getByLabel("Live Jira comment");
  await draft.fill("Submitted retry evidence.");
  await page.getByRole("button", { name: "Post to Jira" }).click();
  await page.evaluate(() => window.__finishComment());
  await expect(draft).toHaveValue("");
});

test("Jira comment failure preserves the latest draft for retry", async ({ page }) => {
  const draft = page.getByLabel("Live Jira comment");
  await draft.fill("Submitted retry evidence.");
  await page.getByRole("button", { name: "Post to Jira" }).click();
  await draft.fill("Updated evidence to retry.");
  await page.evaluate(() => window.__failComment());
  await expect(page.getByRole("alert")).toContainText("Comment submission failed");
  await expect(draft).toHaveValue("Updated evidence to retry.");
  await expect(page.getByRole("button", { name: "Post to Jira" })).toBeEnabled();
});
