import { openReviewComposer } from "./fixtures/review-composer.mjs";
import { test, expect } from "@playwright/test";
import { installConnected } from "./fixtures/connected.mjs";
async function openReview(page) {
  await page.clock.install();
  await installConnected(page);
  await page.locator(".attention-row").getByRole("button", { name: /Payment retry review/ }).click();
  await openReviewComposer(page);
  await expect(page.getByLabel("Diagram review comment")).toBeVisible();
}
const count = (page, action) => page.evaluate(a => window.__fixture.calls.filter(c => c.action === a).length, action);

test("MR metadata sync preserves selected code and draft, without loading Git again", async ({ page }) => {
  await openReview(page);
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await openReviewComposer(page);
  await page.getByLabel("Diagram review comment").fill("Keep my review while teammates update metadata.");
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (a, args) => {
      const result = await invoke(a, args);
      if (a === "gitlab.mrUpdates") result.mr.title = "PAY-382 Updated by teammate";
      return result;
    };
  });
  const before = await count(page, "gitlab.mr");
  await page.clock.fastForward(61000);
  await expect(page.locator(".visual-review-title h1")).toContainText("Updated by teammate");
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("Keep my review while teammates update metadata.");
  await expect(page.getByRole("button", { name: "Source", exact: true })).toHaveClass(/active/);
  expect(await count(page, "gitlab.mr")).toBe(before);
  expect(await count(page, "gitlab.comment")).toBe(0);
  expect(await count(page, "claude.review")).toBe(0);
});

test("New revision is prepared once automatically; switching is explicit and prior draft remains saved", async ({ page }) => {
  await openReview(page);
  await openReviewComposer(page);
  await page.getByLabel("Diagram review comment").fill("This belongs to the original commit.");
  await page.evaluate(() => {
    const invoke = window.orbit.invoke;
    window.orbit.invoke = async (a, args) => {
      const result = await invoke(a, args);
      if (["gitlab.mrUpdates", "gitlab.mr"].includes(a)) {
        result.mr.diff_refs.head_sha = "f".repeat(40);
        result.mr.title = "PAY-382 Next revision";
      }
      return result;
    };
  });
  const before = await count(page, "gitlab.mr");
  await page.clock.fastForward(61000);
  await expect(page.getByText("New revision ready", { exact: true })).toBeVisible();
  expect(await count(page, "gitlab.mr")).toBe(before + 1);
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("This belongs to the original commit.");
  await expect(page.getByRole("button", { name: "Post to GitLab", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Approve MR", exact: true })).toBeDisabled();
  await page.clock.fastForward(61000);
  await expect.poll(() => count(page, "gitlab.mrUpdates")).toBeGreaterThanOrEqual(2);
  expect(await count(page, "gitlab.mr")).toBe(before + 1);
  await page.getByRole("button", { name: "Review new revision" }).click();
  await expect(page.locator(".visual-review-title h1")).toContainText("Next revision");
  await openReviewComposer(page);
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("");
  expect(await page.evaluate(() => Object.entries(localStorage).some(([k,v]) => k.startsWith("orbit-visual-drafts:") && v.includes("This belongs to the original commit.")))).toBe(true);
});

test("Offline polling pauses, reconnect syncs once, and failures preserve review context", async ({ page }) => {
  await openReview(page);
  await openReviewComposer(page);
  await page.getByLabel("Diagram review comment").fill("Network recovery must keep this.");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    window.dispatchEvent(new Event("offline"));
  });
  const before = await count(page, "gitlab.mrUpdates");
  await page.clock.fastForward(180000);
  expect(await count(page, "gitlab.mrUpdates")).toBe(before);
  await expect(page.locator(".review-auto-sync")).toContainText("Offline");
  await page.evaluate(() => {
    window.__fixture.setFailure("gitlab.mrUpdates");
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
    window.dispatchEvent(new Event("online"));
  });
  await expect(page.locator(".review-auto-sync")).toContainText("retrying automatically");
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("Network recovery must keep this.");
  await page.evaluate(() => window.__fixture.setFailure(""));
  await page.clock.fastForward(121000);
  await expect(page.locator(".review-auto-sync")).toContainText("Auto-sync on");
});

test("Simultaneous identical reads share a request; configuration changes reject stale results", async ({ page }) => {
  await installConnected(page);
  const result = await page.evaluate(async () => {
    const { invoke } = await import('/src/lib/integration-client.js');
    const original = window.orbit.invoke;
    let calls = 0, release;
    window.orbit.invoke = async (a,args) => {
      if (a === 'config.save') return true;
      if (a === 'gitlab.pipeline') { calls++; await new Promise(resolve => { release = resolve; }); return {id: 1}; }
      return original(a,args);
    };
    const one = invoke('gitlab.pipeline', {projectId:42,id:1});
    const two = invoke('gitlab.pipeline', {projectId:42,id:1});
    release(); await Promise.all([one,two]);
    const stale = invoke('gitlab.pipeline', {projectId:42,id:2}).then(() => false, () => true);
    await invoke('config.save',{service:'gitlab',config:{url:'https://gitlab.fixture.test',token:'replacement'}});
    release();
    return {calls, rejected: await stale};
  });
  expect(result).toEqual({calls: 2,rejected: true});
});

test("An MR that failed to open recovers automatically when GitLab returns", async ({page}) => {
  await page.clock.install();
  await installConnected(page);
  await page.evaluate(() => window.__fixture.setFailure('gitlab.mr'));
  await page.locator('.attention-row').getByRole('button', {name:/Payment retry review/}).click();
  await expect(page.locator('.object-panel .connection-error')).toContainText('Fixture service unavailable');
  await page.evaluate(() => window.__fixture.setFailure(''));
  await page.clock.fastForward(61000);
  await openReviewComposer(page);
  await expect(page.getByLabel('Diagram review comment')).toBeVisible();
});

test("Pipeline detail updates quietly without returning to its parent MR", async ({page}) => {
  await openReview(page);
  await page.getByRole('button',{name:'Pipeline',exact:true}).click();
  await page.getByRole('button',{name:'#482 · success',exact:true}).click();
  await expect(page.locator('.object-detail')).toContainText('Pipeline #482');
  await page.evaluate(() => {
    const original = window.orbit.invoke;
    window.orbit.invoke = async (action,args) => {
      const data=await original(action,args);
      if(action==='gitlab.pipeline') data.status='failed';
      return data;
    };
  });
  await page.clock.fastForward(61000);
  await expect(page.locator('.object-detail > .pill')).toHaveText('failed');
  await expect(page.locator('.object-detail')).toContainText('Pipeline #482');
});
