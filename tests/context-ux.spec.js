import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";

const issue = (page) => page.locator(".live-inbox").getByRole("button", { name: /PAY-382 Payment retry implementation/ }).click();
const mr = (page) => page.locator(".attention-row").getByRole("button", { name: /Payment retry review/ }).click();

test("Issue displays independent related results without blocking its draft or waiting for every service", async ({ page }) => {
  await installConnected(page);
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      if (action === "gitlab.mrs" && args.search) await new Promise((resolve) => { window.__completeRelated = resolve; });
      return invoke(action, args);
    };
  });
  await issue(page);
  const related = page.getByRole("region", { name: "Related work preview" });
  await expect(related.getByRole("button", { name: /Payment Retry Policy/ })).toBeVisible();
  await expect(related.getByRole("status")).toContainText("Finding mentions");
  await page.getByLabel("Jira comment").fill("Keep this issue context while reading the policy.");
  await related.getByRole("button", { name: /Payment Retry Policy/ }).click();
  await expect(page.locator(".remote-document")).toContainText("Bound retries");
  await page.getByLabel("Back in context").click();
  await expect(page.getByLabel("Jira comment")).toHaveValue("Keep this issue context while reading the policy.");
  await page.evaluate(() => window.__completeRelated());
  await expect(related.getByRole("button", { name: /Payment retry review/ })).toBeVisible();
  expect(await page.evaluate(() => window.__fixture.calls.some((call) => ["jira.comment", "jira.edit", "gitlab.comment"].includes(call.action)))).toBe(false);
});

test("Related work shows a provider failure alongside available matches and retries independently", async ({ page }) => {
  await installConnected(page);
  await page.evaluate(() => window.__fixture.setFailure("confluence.search"));
  await issue(page);
  const related = page.getByRole("region", { name: "Related work preview" });
  await expect(related.getByRole("alert")).toContainText("Could not check Confluence");
  await expect(related.getByRole("button", { name: /Payment retry review/ })).toBeVisible();
  await page.evaluate(() => window.__fixture.setFailure(""));
  await page.getByLabel("Refresh related work").click();
  await expect(related.getByRole("button", { name: /Payment Retry Policy/ })).toBeVisible();
  await expect(related.getByRole("alert")).toHaveCount(0);
});

test("A narrow issue preview keeps the context header and Assistant control unobscured", async ({ page }) => {
  await page.setViewportSize({ width: 980, height: 650 });
  await installConnected(page); await issue(page);
  await expect(page.getByRole("region", { name: "Related work preview" })).toBeVisible();
  const header = await page.locator(".object-panel-header").boundingBox();
  const inspector = await page.getByLabel("Live issue inspector").boundingBox();
  expect(inspector.y).toBeGreaterThanOrEqual(header.y + header.height);
  await page.locator(".object-panel-header").getByRole("button", { name: "Assistant", exact: true }).click();
  await expect(page.getByLabel("Ask Claude")).toBeVisible();
  await page.getByLabel("Close context preview").click();
  await expect(page.getByRole("heading", { name: "A clear start to your day" })).toBeVisible();
});

test("Wiki outline and issue references navigate directly while preserving the wiki view", async ({ page }) => {
  await installConnected(page);
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await invoke(action, args);
      if (action === "confluence.page") result.body.storage.value = '<h2>Retry boundary</h2><p>PAY-382 defines the retry contract.</p><p>' + 'Preserve idempotency across attempts. '.repeat(180) + '</p><h2>Failure handling</h2><p>Stop after three attempts.</p><h3>Escalation</h3><p>OPS-91 tracks production investigation.</p><img src="https://fixture.test/track.png"><script>window.bad=true</script>';
      return result;
    };
  });
  await page.locator('nav .nav-item[aria-label="Docs"]').click();
  await page.getByLabel("Find Confluence page").fill("Payment Retry Policy");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "Payment Retry Policy", exact: true }).click();
  const outline = page.getByRole("navigation", { name: "Document outline" });
  await outline.getByRole("button", { name: "Failure handling", exact: true }).click();
  await expect(page.locator(".remote-document").getByRole("heading", { name: "Failure handling" })).toBeFocused();
  await expect(outline.getByRole("button", { name: "Failure handling", exact: true })).toHaveAttribute("aria-current", "location");
  await page.locator(".document-issue-refs").getByRole("button", { name: "PAY-382", exact: true }).click();
  await expect(page.getByLabel("Live issue inspector")).toBeVisible();
  await page.getByLabel("Close context preview").click();
  await expect(page.getByRole("heading", { name: "Payment Retry Policy", exact: true })).toBeVisible();
  await expect(page.getByLabel("Find Confluence page")).toHaveValue("Payment Retry Policy");
  await expect(page.locator(".remote-document img,.remote-document script")).toHaveCount(0);
});

test("Pipeline failure summary filters real jobs and jumps to the failing job without losing MR context", async ({ page }) => {
  await installConnected(page);
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await invoke(action, args);
      if (action === "gitlab.pipeline") {
        result.status = "failed";
        result.jobs = Array.from({ length: 24 }, (_, index) => ({ id: index, stage: index < 20 ? "test" : "deploy", name: `job-${index}`, status: index === 22 ? "failed" : "success", duration: 4 + index }));
      }
      return result;
    };
  });
  await mr(page);
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  await page.getByRole("button", { name: "#482 · success", exact: true }).click();
  await expect(page.getByRole("region", { name: "Pipeline execution summary" })).toContainText("24 / 24 jobs finished");
  await page.getByRole("button", { name: "Failed jobs (1)", exact: true }).click();
  await expect(page.locator(".pipeline-job")).toHaveCount(1);
  await page.getByRole("button", { name: "deploy / job-22", exact: true }).click();
  await expect(page.locator(".pipeline-job")).toHaveCount(24);
  await expect(page.locator('[data-pipeline-job="22"]')).toBeFocused();
  await expect(page.locator('[data-pipeline-job="22"]')).toBeInViewport();
  await page.getByLabel("Back in context").click();
  await expect(page.getByRole("img", { name: "Dependency flow diagram" })).toBeVisible();
});

test("A deep wiki reading position returns after a searched issue without leaking its scroll into the issue", async ({ page }) => {
  await installConnected(page);
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await invoke(action, args);
      if (action === "confluence.page") result.body.storage.value = '<h2>Policy</h2><p>' + 'Review the retry budget and duplicate delivery behavior. '.repeat(320) + '</p><h2>Release checks</h2><p>Validate idempotency.</p>';
      return result;
    };
  });
  await issue(page);
  await page.getByRole("region", { name: "Related work preview" }).getByRole("button", { name: /Payment Retry Policy/ }).click();
  await page.getByRole("navigation", { name: "Document outline" }).getByRole("button", { name: "Release checks", exact: true }).click();
  const position = await page.locator(".object-detail").evaluate((element) => element.scrollTop);
  expect(position).toBeGreaterThan(300);
  await page.keyboard.press("Meta+k");
  await page.getByLabel("Connected global search").fill("PAY-382");
  await page.locator("[cmdk-item]").filter({ hasText: "PAY-382 Payment retry implementation" }).click();
  await expect(page.getByLabel("Live issue inspector")).toBeVisible();
  await expect.poll(() => page.locator(".object-content-main").evaluate((element) => element.scrollTop)).toBe(0);
  await page.getByLabel("Back in context").click();
  await expect(page.locator(".remote-document")).toContainText("Validate idempotency");
  await expect.poll(() => page.locator(".object-detail").evaluate((element) => element.scrollTop)).toBe(position);
});

test("MR source selection, sequence, guide and line draft survive a pipeline round trip", async ({ page }) => {
  await installConnected(page); await mr(page);
  await page.getByRole("button", { name: "Generate AI guide", exact: true }).click();
  await expect(page.locator(".guide-summary")).toBeVisible();
  const summary = await page.locator(".guide-summary").textContent();
  await page.getByRole("tab", { name: "Sequence", exact: true }).click();
  await page.getByRole("button", { name: "Open component RetryQueue.ts", exact: true }).click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.getByRole("button", { name: "Select source line 7", exact: true }).click();
  await page.getByLabel("Diagram review comment").fill("Retain the idempotency key check at this line.");
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  await page.getByRole("button", { name: "#482 · success", exact: true }).click();
  await expect(page.locator(".pipeline-stages")).toBeVisible();
  await page.getByLabel("Back in context").click();
  await expect(page.getByRole("tab", { name: "Sequence", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".visual-code-heading")).toContainText("src/RetryQueue.ts");
  await expect(page.locator(".code-provenance")).toContainText("Selected new line 7");
  await expect(page.getByRole("button", { name: "Select source line 7", exact: true })).toHaveClass(/selected/);
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("Retain the idempotency key check at this line.");
  await expect(page.locator(".guide-summary")).toHaveText(summary);
  expect(await page.evaluate(() => window.__fixture.calls.filter((call) => call.action === "claude.review").length)).toBe(1);
});

test("MR cached view and AI guide do not resume against a changed base even with the same head", async ({ page }) => {
  await installConnected(page); await mr(page);
  await page.getByRole("button", { name: "Generate AI guide", exact: true }).click();
  await expect(page.locator(".guide-summary")).toBeVisible();
  await page.getByRole("button", { name: "Open component RetryQueue.ts", exact: true }).click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.getByRole("button", { name: "Select source line 7", exact: true }).click();
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  await page.getByRole("button", { name: "#482 · success", exact: true }).click();
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (action, args) => {
      const result = await invoke(action, args);
      if (action === "gitlab.mr") result.mr.diff_refs.base_sha = "changed-base";
      return result;
    };
  });
  await page.getByLabel("Back in context").click();
  await expect(page.locator(".visual-code-heading")).toContainText("src/PaymentController.ts");
  await expect(page.locator(".code-provenance")).not.toContainText("Selected new line 7");
  await expect(page.getByRole("button", { name: "Diff", exact: true })).toHaveClass(/active/);
  await expect(page.locator(".guide-summary")).toHaveCount(0);
});

for (const outcome of ["success", "failure"]) test(`A pending GitLab comment cannot be duplicated through context navigation and unlocks after ${outcome}`, async ({ page }) => {
  await installConnected(page); await mr(page);
  await page.evaluate(() => {
    const invoke = window.orbit.invoke; window.__postAttempts = 0;
    window.orbit.invoke = async (action, args) => {
      if (action === "gitlab.comment") {
        window.__postAttempts++;
        await new Promise((resolve, reject) => { window.__finishReview = resolve; window.__failReview = () => reject(Error("GitLab could not accept the review.")); });
      }
      return invoke(action, args);
    };
  });
  await page.getByLabel("Diagram review comment").fill("Please verify exactly once.");
  await page.getByRole("button", { name: "Post to GitLab", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Posting review comment…" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pipeline", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Back in context")).toBeDisabled();
  await expect(page.getByLabel("Close context preview")).toBeDisabled();
  await page.keyboard.press("Meta+k");
  await expect(page.getByLabel("Connected global search")).toHaveCount(0);
  await page.keyboard.press("Meta+n");
  await expect(page.locator("[cmdk-root]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Diagram review comment")).toBeVisible();
  await page.getByLabel("Diagram review comment").fill("An additional thought while the review sends.");
  expect(await page.evaluate(() => window.__postAttempts)).toBe(1);
  if (outcome === "success") await page.evaluate(() => window.__finishReview());
  else await page.evaluate(() => window.__failReview());
  await expect(page.getByRole("button", { name: "Pipeline", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Close context preview")).toBeEnabled();
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("An additional thought while the review sends.");
  if (outcome === "failure") await expect(page.getByRole("alert")).toContainText("GitLab could not accept");
  await page.getByRole("button", { name: "Pipeline", exact: true }).click();
  await page.getByRole("button", { name: "#482 · success", exact: true }).click();
  await page.getByLabel("Back in context").click();
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("An additional thought while the review sends.");
});
