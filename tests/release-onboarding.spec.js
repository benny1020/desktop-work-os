import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";

const settings = (page) => page.getByRole("button", { name: "Settings", exact: true }).click();
const tab = (page, name) => page.locator(".tabs").getByRole("button", { name, exact: true }).click();

async function savedConnectionFixture(page) {
  await installConnected(page);
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.connectionFailure = "";
    window.orbit.invoke = async (action, args) => {
      if (action === "config.save") {
        if (window.connectionFailure === "save") throw Error("Connection storage unavailable.");
        const { token, verifiedAt, ...config } = args.config;
        const saved = { ...config, tokenConfigured: Boolean(token || window.__fixture.configs[args.service]?.tokenConfigured) };
        window.__fixture.configs[args.service] = saved;
        return saved;
      }
      if (action === "config.test") {
        if (window.connectionFailure === "test") throw Error("Could not verify access.");
        const saved = { ...window.__fixture.configs[args.service], verifiedAt: "2026-10-08", identity: "Test account" };
        window.__fixture.configs[args.service] = saved;
        return saved;
      }
      if (action === "config.remove") { delete window.__fixture.configs[args.service]; return true; }
      return invoke(action, args);
    };
  });
}

test("Connection drafts survive settings tabs and navigation, then disappear on app reload", async ({ page }) => {
  await savedConnectionFixture(page);
  await settings(page);
  await page.getByLabel("Service URL").fill("https://draft.gitlab.example.test");
  await page.getByLabel("API token").fill("volatile-test-draft");
  await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toBeVisible();
  await tab(page, "Preferences");
  await tab(page, "Integrations");
  await expect(page.getByLabel("Service URL")).toHaveValue("https://draft.gitlab.example.test");
  await expect(page.getByLabel("API token")).toHaveValue("volatile-test-draft");
  await page.getByRole("button", { name: /Jira Cloud/ }).click();
  await page.getByLabel("Service URL").fill("https://draft.atlassian.net");
  await page.locator('nav .nav-item[aria-label="Home"]').click();
  await settings(page);
  await expect(page.locator(".provider-heading")).toContainText("Jira Cloud");
  await expect(page.getByLabel("Service URL")).toHaveValue("https://draft.atlassian.net");
  await page.getByRole("button", { name: /GitLab Self-Managed/ }).click();
  await expect(page.getByLabel("API token")).toHaveValue("volatile-test-draft");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("volatile-test-draft");
  await page.reload();
  await settings(page);
  await expect(page.getByLabel("API token")).toHaveValue("");
  await expect(page.getByLabel("Service URL")).toHaveValue("https://gitlab.fixture.test");
});

test("Connect actions open the service requested by the empty screen", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Workspace data mode").selectOption("connected");
  for (const [section, provider] of [["Projects", "Jira Cloud"], ["Docs", "Confluence Cloud"], ["Code", "GitLab Self-Managed"]]) {
    await page.locator(`nav .nav-item[aria-label="${section}"]`).click();
    await page.getByRole("button", { name: "Open integration settings" }).click();
    await expect(page.locator(".provider-heading")).toContainText(provider);
  }
});

test("Choosing a service in a narrow window brings its form into view and keyboard reach", async ({ page }) => {
  await page.setViewportSize({ width: 860, height: 760 });
  await savedConnectionFixture(page);
  await settings(page);
  await page.getByRole("button", { name: /Jira Cloud/ }).click();
  const heading = page.locator(".provider-heading h2");
  await expect(heading).toHaveText("Jira Cloud");
  await expect(heading).toBeInViewport();
  await expect(heading).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Service URL")).toBeFocused();
});

test("Storage failure retains the draft and Cancel changes restores saved connection without a write", async ({ page }) => {
  await savedConnectionFixture(page);
  await settings(page);
  await page.getByLabel("Service URL").fill("https://unsaved.gitlab.example.test");
  await page.getByLabel("API token").fill("failed-save-draft");
  await page.evaluate(() => { window.connectionFailure = "save"; });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Connection storage unavailable");
  await tab(page, "Preferences");
  await tab(page, "Integrations");
  await expect(page.getByLabel("API token")).toHaveValue("failed-save-draft");
  await page.getByRole("button", { name: "Cancel changes", exact: true }).click();
  await expect(page.getByLabel("Service URL")).toHaveValue("https://gitlab.fixture.test");
  await expect(page.getByLabel("API token")).toHaveValue("");
  await expect(page.getByRole("status").filter({ hasText: "discarded" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel changes", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.__fixture.configs.gitlab.url)).toBe("https://gitlab.fixture.test");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("failed-save-draft");
});

test("Saved but unverified connection clears token and reports the two outcomes accurately", async ({ page }) => {
  await savedConnectionFixture(page);
  await settings(page);
  await page.getByLabel("API token").fill("saved-test-token");
  await page.evaluate(() => { window.connectionFailure = "test"; });
  await page.getByRole("button", { name: "Save & test connection", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not verify access");
  await expect(page.getByRole("status").filter({ hasText: "Connection saved" })).toBeVisible();
  await expect(page.getByLabel("API token")).toHaveValue("");
  await expect(page.getByRole("button", { name: /GitLab Self-Managed/ })).toContainText("Saved · test needed");
  await tab(page, "Preferences");
  await tab(page, "Integrations");
  await expect(page.getByLabel("API token")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Cancel changes", exact: true })).toHaveCount(0);
});

test("Removing a connection clears its unsaved draft across navigation", async ({ page }) => {
  await savedConnectionFixture(page);
  await settings(page);
  await page.getByLabel("API token").fill("discard-on-remove");
  await page.getByRole("button", { name: "Remove connection", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "removed" })).toBeVisible();
  await tab(page, "Preferences");
  await tab(page, "Integrations");
  await expect(page.getByLabel("Service URL")).toHaveValue("");
  await expect(page.getByLabel("API token")).toHaveValue("");
  await expect(page.getByRole("button", { name: /GitLab Self-Managed/ })).toContainText("Not configured");
  await expect(page.getByRole("button", { name: "Cancel changes", exact: true })).toHaveCount(0);
});
