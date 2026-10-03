import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";

test.beforeEach(async ({ page }) => installConnected(page));
async function add(page, title) {
  await page.getByLabel("Quick add personal work").fill(title);
  await page.getByRole("button", { name: "Add to plan", exact: true }).click();
}
async function ask(page, question) {
  await page.getByLabel("Ask Claude").fill(question);
  await page.getByRole("button", { name: "Send to Claude", exact: true }).click();
}

test("Local schedule proposal prefers the specific task title over a matching prefix", async ({ page }) => {
  await add(page, "release");
  await add(page, "release notes");
  await page.keyboard.press("Meta+j");
  await ask(page, "Move release notes tomorrow");
  await expect(page.locator(".assistant-proposal > b")).toHaveText("release notes");
});

test("Duplicate task titles require disambiguation instead of picking the first task", async ({ page }) => {
  await add(page, "Review changes");
  await add(page, "Review changes");
  await page.keyboard.press("Meta+j");
  await ask(page, "Move Review changes tomorrow");
  await expect(page.getByRole("alert")).toContainText("More than one task matches");
  await expect(page.getByRole("button", { name: "Confirm schedule", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.__fixture.calls.filter((call) => call.action === "claude.chat"))).toHaveLength(0);
});

test("A newer assistant question retires an older schedule proposal", async ({ page }) => {
  await add(page, "Review retries");
  await page.keyboard.press("Meta+j");
  await ask(page, "Move Review retries tomorrow");
  await expect(page.getByRole("button", { name: "Confirm schedule", exact: true })).toBeVisible();
  await ask(page, "Summarize my plan instead");
  await expect(page.locator(".live-chat-message.assistant")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm schedule", exact: true })).toHaveCount(0);
});

test("An issue-key prefix cannot select a different linked task", async ({ page }) => {
  await page.evaluate(() => { window.__fixture.issue.key = "PAY-38"; });
  await page.getByRole("button", { name: "Refresh work", exact: true }).click();
  await page.getByRole("button", { name: "Add to Today", exact: true }).click();
  await page.keyboard.press("Meta+j");
  await ask(page, "Move PAY-382 tomorrow");
  await expect(page.locator(".live-chat-message.assistant")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm schedule", exact: true })).toHaveCount(0);
});

test("Two separately named tasks are not silently reduced to one schedule change", async ({ page }) => {
  await add(page, "Release notes");
  await add(page, "Deploy");
  await page.keyboard.press("Meta+j");
  await ask(page, "Move Release notes and Deploy tomorrow");
  await expect(page.getByRole("alert")).toContainText("More than one task matches");
  await expect(page.getByRole("button", { name: "Confirm schedule", exact: true })).toHaveCount(0);
});

test("Refreshing available Claude models preserves the chosen model", async ({ page }) => {
  await page.evaluate(() => {
    const original = window.__fixture.invoke.bind(window.__fixture);
    window.__fixture.invoke = async (action, args) => {
      if (action === "config.save") return { ...args.config, token: undefined, tokenConfigured: true };
      if (action === "claude.models") return { data: [{ id: "claude-new-default" }, { id: "claude-fixture" }] };
      return original(action, args);
    };
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: /Claude · Anthropic API/ }).click();
  await expect(page.getByLabel("Claude model ID")).toHaveValue("claude-fixture");
  await page.getByRole("button", { name: "Fetch available models", exact: true }).click();
  await expect(page.locator(".provider-form .connection-success")).toContainText("Choose a model");
  await expect(page.getByLabel("Claude model ID")).toHaveValue("claude-fixture");
});
