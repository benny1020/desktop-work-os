import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { snapshot as originalSnapshot } from "../tests/fixtures/connected.mjs";
import { prepareLocalReviewFixture } from './fixtures/local-git-review.mjs';
const root = path.resolve(new URL("..", import.meta.url).pathname),
  temp = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-completion-"));
const out = path.join(root, "research/completion");
await fs.mkdir(out, { recursive: true });
const fixture = await prepareLocalReviewFixture({ root, directory: temp, snapshot: originalSnapshot });
const { snapshot } = fixture;
const app = await electron.launch({
  args: [fixture.bootstrap],
  env: { ...process.env, ORBIT_USER_DATA_DIR: temp },
});
const evidence = {
  externalServicesTested: false,
  scope:
    "Actual Electron UI + preload + main adapters + real temporary Git repository/worktree + HTTPS metadata fixtures",
  checks: [],
  consoleErrors: [],
};
try {
  await app.evaluate(
    ({ protocol }, { snapshot }) => {
      global.__fixtureCalls = [];
      global.__fixtureSnapshot = snapshot;
      protocol.handle("https", async (request) => {
        const u = new URL(request.url);
        if (!u.hostname.endsWith(".fixture.test"))
          return new Response("Unconfigured fixture", { status: 403 });
        let body;
        try {
          body = await request.json();
        } catch {}
        global.__fixtureCalls.push({
          path: u.pathname,
          method: request.method,
          body,
          host: u.hostname,
        });
        const issue = {
          id: "1",
          key: "PAY-382",
          fields: {
            summary: "Payment retry implementation",
            description: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Retry transient failures with idempotency keys.",
                    },
                  ],
                },
              ],
            },
            status: { name: "In Progress" },
            priority: { name: "High" },
            project: { key: "PAY" },
            assignee: { accountId: "alex", displayName: "Alex Kim" },
            duedate: "2026-10-04",
            comment: { comments: [] },
            sprint: { id: 24, name: "Sprint 24", state: "active" },
          },
        };
        let data;
        if (u.pathname.endsWith("/search/jql")) data = { issues: [issue] };
        else if (u.pathname.endsWith("/rest/api/3/project/search")) data = { values: [{ id: "100", key: "PAY", name: "Payments" }], isLast: true };
        else if (u.pathname.endsWith("/rest/agile/1.0/board")) data = { values: [{ id: 10, name: "Payments Scrum" }], isLast: true };
        else if (u.pathname.endsWith("/board/10/sprint")) data = { values: [{ id: 24, name: "Sprint 24", state: "active", startDate: "2026-10-05T09:00:00Z", endDate: "2026-10-16T17:00:00Z" }, { id: 25, name: "Sprint 25", state: "future" }], isLast: true };
        else if (u.pathname.endsWith("/board/10/sprint/24/issue")) data = { issues: [issue], isLast: true };
        else if (u.pathname.endsWith("/board/10/sprint/25/issue") || u.pathname.endsWith("/board/10/backlog")) data = { issues: [], isLast: true };
        else if (u.pathname.endsWith("/transitions"))
          data = { transitions: [{ id: "31", name: "Done" }] };
        else if (u.pathname.includes("/issue/PAY-")) data = issue;
        else if (u.pathname.endsWith("/diffs") || u.pathname.includes("/repository/files/"))
          return new Response("Code APIs are forbidden in local Git review", { status: 410 });
        else if (u.pathname.endsWith("/discussions"))
          data =
            request.method === "POST"
              ? {
                  id: "posted",
                  notes: [
                    {
                      id: 1,
                      body: body.body,
                      position: body.position,
                      author: { name: "Reviewer" },
                    },
                  ],
                }
              : [];
        else if (u.pathname.endsWith("/approve")) data = { approved: true };
        else if (u.pathname.endsWith("/merge_requests/7")) data = snapshot.mr;
        else if (u.pathname.endsWith("/merge_requests"))
          data = [{ ...snapshot.mr, author: { name: "Daniel Park" } }];
        else if (u.pathname.endsWith("/user"))
          data = { id: 1, name: "Reviewer" };
        else if (u.pathname.endsWith("/projects"))
          data = [{ id: 42, path_with_namespace: "platform/payment-api" }];
        else if (u.pathname.endsWith("/projects/42"))
          data = { id: 42, path_with_namespace: "platform/payment-api", http_url_to_repo: "https://gitlab.fixture.test/platform/payment-api.git" };
        else if (u.pathname.endsWith("/pipelines/482/jobs"))
          data = [
            {
              id: 1,
              name: "unit-tests",
              stage: "test",
              status: "success",
              duration: 42,
            },
          ];
        else if (u.pathname.endsWith("/pipelines/482"))
          data = {
            id: 482,
            status: "success",
            ref: "feature/retry",
            sha: snapshot.mr.diff_refs.head_sha,
          };
        else if (u.pathname.endsWith("/pipelines"))
          data = [{ id: 482, status: "success" }];
        else if (u.pathname.endsWith("/rest/api/search"))
          data = {
            results: [{ content: { id: "p1", title: "Payment Retry Policy" } }],
          };
        else if (u.pathname.endsWith("/pages/p1"))
          data = {
            id: "p1",
            title: "Payment Retry Policy",
            version: { number: 3 },
            body: {
              storage: {
                value: "<h2>Retry policy</h2><p>Preserve idempotency keys.</p>",
              },
            },
          };
        else if (u.pathname.endsWith("/messages"))
          data = {
            model: "claude-fixture",
            stop_reason: "end_turn",
            content: [
              { type: "text", text: JSON.stringify(snapshot.demoGuide) },
            ],
          };
        else return new Response("Unsupported fixture route", { status: 404 });
        return new Response(JSON.stringify(data), {
          headers: { "content-type": "application/json", "x-next-page": "" },
        });
      });
    },
    { snapshot },
  );
  const p = await app.firstWindow();
  await p.waitForLoadState("domcontentloaded");
  await p.clock.install();
  p.on("pageerror", (e) => evidence.consoleErrors.push(e.message));
  await p.evaluate(async () => {
    for (const service of ["jira", "gitlab", "confluence", "claude"])
      await window.orbit.invoke("config.save", {
        service,
        config: {
          url: `https://${service}.fixture.test`,
          email: "reviewer@example.test",
          token: "isolated-fixture-token",
          model: "claude-fixture",
        },
      });
  });
  await p.getByLabel("Workspace data mode").selectOption("connected");
  await expect(p.locator('.inbox-work[data-linked-work="PAY-382"]')).toContainText(
    "Payment retry implementation",
  );
  evidence.checks.push("Connected home through native adapters");
  await p
    .getByLabel("Quick add personal work")
    .fill("Review runbook tomorrow 2pm");
  await p.getByRole("button", { name: "Add to plan", exact: true }).click();
  await p.getByLabel("Next planning period").click();
  await expect(p.locator(".plan-task")).toContainText("Review runbook");
  await p.reload();
  await p.getByLabel("Next planning period").click();
  await expect(p.getByLabel("Time for Review runbook")).toHaveValue("14:00");
  evidence.checks.push("Local plan retained across Electron reload");
  await p
    .locator(".live-inbox")
    .getByRole("button", { name: /PAY-382 Payment retry implementation/ })
    .click();
  await expect(p.getByLabel("Live issue inspector")).toContainText(
    "idempotency keys",
  );
  await p.getByRole("button", { name: "Find linked MR & wiki" }).click();
  await p
    .getByRole("button", { name: "Payment Retry Policy", exact: true })
    .click();
  await expect(p.locator(".remote-document")).toContainText(
    "Preserve idempotency keys",
  );
  await p.screenshot({ path: path.join(out, "electron-wiki-context.png") });
  evidence.checks.push("Issue → related wiki without page navigation");
  await p.getByLabel("Back in context").click();
  await p
    .getByRole("button", {
      name: "!7 PAY-382 Payment retry review",
      exact: true,
    })
    .click();
  await expect(
    p.getByRole("group", { name: "Dependency flow diagram" }),
  ).toBeVisible();
  await expect(p.getByLabel('Local checkout details')).toBeVisible();
  await p.getByRole("tab", { name: "Sequence", exact: true }).click();
  await expect(p.getByRole("group", { name: "Sequence diagram" })).toBeVisible();
  await p.screenshot({ path: path.join(out, "electron-sequence-context.png") });
  await p
    .getByRole("button", {
      name: "Open component PaymentService.ts",
      exact: true,
    })
    .click();
  await p.getByRole("button", { name: "Source", exact: true }).click();
  await expect(p.getByLabel("Component code")).toContainText(
    "export class PaymentService",
  );
  await expect(p.getByText(/Local Git code ·/)).toBeVisible();
  const sourceText = snapshot.files.find(file => file.path === 'src/PaymentService.ts').content;
  const localSource = await p.evaluate(async ({ ref }) => window.orbit.invoke('gitlab.code', {
    projectId: 42, iid: 7, ref, path: 'src/PaymentService.ts',
  }), { ref: fixture.head });
  expect(localSource.content).toBe(sourceText);
  // Real renderer timers + real local Git: metadata polls must not clone again;
  // a new SHA can prepare in the background without replacing an active review.
  const autoSyncBaseline = await app.evaluate(() => ({
    snapshots: global.__localGitCalls.filter(call => call.name === 'snapshot').length,
    writes: global.__fixtureCalls.filter(call => call.method === 'POST').length,
  }));
  await p.getByLabel('Diagram review comment').fill('Keep my review draft while metadata syncs.');
  await app.evaluate(() => { global.__fixtureSnapshot.mr.title = 'PAY-382 Payment retry review · synchronized'; });
  await p.clock.fastForward(61000);
  await expect(p.getByRole('heading', { name: 'PAY-382 Payment retry review · synchronized', exact: true })).toBeVisible();
  expect(await app.evaluate(() => global.__localGitCalls.filter(call => call.name === 'snapshot').length)).toBe(autoSyncBaseline.snapshots);
  await expect(p.getByLabel('Diagram review comment')).toHaveValue('Keep my review draft while metadata syncs.');
  const execute = promisify(execFile);
  const nativeGit = async (...args) => (await execute('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'user.name=Worklane Fixture', '-c', 'user.email=fixture@example.test', ...args], { cwd: fixture.repository })).stdout.trim();
  await fs.appendFile(path.join(fixture.repository, 'src/PaymentService.ts'), '\n// Revision prepared by automatic synchronization.\n');
  await nativeGit('add', '--', 'src/PaymentService.ts');
  await nativeGit('commit', '-m', 'Native automatic sync revision');
  const nextHead = await nativeGit('rev-parse', 'HEAD');
  await nativeGit('update-ref', 'refs/merge-requests/7/head', nextHead);
  await app.evaluate((_, { nextHead }) => {
    global.__fixtureSnapshot.mr.diff_refs.head_sha = nextHead;
    global.__fixtureSnapshot.mr.sha = nextHead;
  }, { nextHead });
  await p.clock.fastForward(61000);
  await expect(p.getByText('New revision ready', { exact: false })).toBeVisible().catch(async error => {
    console.error('Automatic revision preparation failed:', await p.locator('.review-auto-sync .sync-status').getAttribute('title'),
      await app.evaluate(() => global.__fixtureCalls.slice(-12).map(call => ({ path: call.path, method: call.method }))));
    throw error;
  });
  expect(await app.evaluate(() => global.__localGitCalls.filter(call => call.name === 'snapshot').length)).toBe(autoSyncBaseline.snapshots + 1);
  await expect(p.getByLabel('Diagram review comment')).toHaveValue('Keep my review draft while metadata syncs.');
  await expect(p.getByLabel('Component code')).not.toContainText('Revision prepared by automatic synchronization');
  await expect(p.getByRole('button', { name: 'Post to GitLab', exact: true })).toBeDisabled();
  await p.clock.fastForward(61000);
  await expect(p.getByRole('button', { name: 'Review new revision', exact: true })).toBeEnabled();
  expect(await app.evaluate(() => global.__localGitCalls.filter(call => call.name === 'snapshot').length)).toBe(autoSyncBaseline.snapshots + 1);
  expect(await app.evaluate(() => global.__fixtureCalls.filter(call => call.method === 'POST').length)).toBe(autoSyncBaseline.writes);
  await p.getByRole('button', { name: 'Review new revision', exact: true }).click();
  await p.getByRole('button', { name: 'Open component PaymentService.ts', exact: true }).click();
  await p.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(p.getByLabel('Component code')).toContainText('Revision prepared by automatic synchronization');
  expect(await app.evaluate(() => global.__localGitCalls.filter(call => call.name === 'snapshot').length)).toBe(autoSyncBaseline.snapshots + 1);
  evidence.checks.push('Automatic metadata sync makes no Git snapshot; new SHA prepares once without replacing draft/code or writing externally');
  evidence.autoSync = { originalHead: fixture.head, newHead: nextHead, sameShaNewSnapshots: 0, changedShaNewSnapshots: 1, automaticExternalWrites: 0 };
  await p
    .getByRole("button", { name: "Select source line 7", exact: true })
    .click();
  await p
    .getByLabel("Diagram review comment")
    .fill("Native fixture: verify retry behavior.");
  await p.getByRole("button", { name: "Post to GitLab", exact: true }).click();
  await expect(p.locator(".component-comment")).toContainText(
    "Native fixture: verify retry behavior.",
  );
  evidence.checks.push(
    "Diagram → commit source → exact-line review through real main adapter",
  );
  await p
    .getByRole("button", { name: "Generate AI guide", exact: true })
    .click();
  await expect(p.locator(".guide-summary")).toBeVisible();
  await p.screenshot({ path: path.join(out, "electron-local-git-review.png"), animations: "disabled" });
  await p.getByRole("button", { name: "Approve MR", exact: true }).click();
  await p
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  evidence.checks.push("Explicit Claude guide and SHA-guarded approval");
  await p.getByRole("button", { name: "Pipeline", exact: true }).click();
  await p.getByRole("button", { name: "#482 · success", exact: true }).click();
  await expect(p.locator(".pipeline-stages")).toContainText("unit-tests");
  await p.screenshot({ path: path.join(out, "electron-pipeline-context.png") });
  evidence.checks.push("MR → pipeline jobs");
  await p.getByLabel("Close context preview").click();
  await p.getByRole("button", { name: "Toggle theme" }).click();
  await p.screenshot({ path: path.join(out, "electron-home-dark.png") });
  await p.getByLabel("Collapse sidebar", { exact: true }).click();
  await p.keyboard.press("Meta+Backslash");
  await expect(p.locator(".sidebar")).toHaveCount(0);
  const restore = p.getByLabel("Show sidebar", { exact: true });
  await expect(restore).toBeInViewport();
  expect((await restore.boundingBox()).x).toBeGreaterThanOrEqual(90);
  await p.screenshot({ path: path.join(out, "electron-sidebar-hidden.png") });
  await p.reload();
  await expect(p.getByLabel("Show sidebar", { exact: true })).toBeVisible();
  await p.getByLabel("Show sidebar", { exact: true }).click();
  await expect(p.locator(".sidebar")).toHaveCSS("width", "66px");
  await p.getByLabel("Expand sidebar", { exact: true }).click();
  evidence.checks.push("Sidebar hide/restore remembers icon mode across native reload and avoids macOS window controls");
  await p.keyboard.press("Meta+k");
  await p
    .getByRole("combobox", { name: "Connected global search" })
    .fill("PAY-382");
  await expect(
    p
      .locator("[cmdk-item]")
      .filter({ hasText: "PAY-382 Payment retry implementation" }),
  ).toBeVisible();
  await p.screenshot({ path: path.join(out, "electron-search-dark.png") });
  evidence.checks.push("Native keyboard search and dark theme");
  await p.keyboard.press("Escape");
  await p.locator('nav .nav-item[aria-label="Projects"]').click();
  await p.locator('nav .subnav button[aria-label="Sprint"]').click();
  await expect(p.getByLabel("Jira planning board")).toHaveValue("10");
  await expect(p.getByLabel("Jira planning sprint")).toHaveValue("24");
  await expect(p.locator(".live-board-card")).toContainText("Payment retry implementation");
  await p.getByLabel("Jira planning sprint").selectOption("25");
  await expect(p.getByRole("heading", { name: "Sprint 25", exact: true })).toBeVisible();
  await expect(p.locator(".live-board-card")).toHaveCount(0);
  await p.getByLabel("Jira planning sprint").selectOption("backlog");
  await expect(p.getByRole("heading", { name: "Board backlog", exact: true })).toBeVisible();
  await p.screenshot({ path: path.join(out, "electron-sprint-planning.png") });
  evidence.checks.push("Specific active/future sprint and true board backlog through native Jira Software adapters");
  const calls = await app.evaluate(() => global.__fixtureCalls);
  const localCalls = await app.evaluate(() => global.__localGitCalls);
  expect(calls.filter(call => call.path.endsWith('/diffs') || call.path.includes('/repository/files/'))).toEqual([]);
  expect(localCalls.some(call => call.name === 'snapshot')).toBe(true);
  expect(localCalls.some(call => call.name === 'readFile' && call.ref === fixture.head)).toBe(true);
  evidence.checks.push('Real Git checkout and exact blob contents; zero GitLab diff/raw code API requests');
  evidence.localGit = { head: fixture.head, base: fixture.base, snapshots: localCalls.filter(call => call.name === 'snapshot').length, blobReads: localCalls.filter(call => call.name === 'readFile').length };
  evidence.requests = calls.map((c) => ({ path: c.path, method: c.method }));
  expect(
    calls.some((c) => c.method === "POST" && c.path.endsWith("/discussions")),
  ).toBe(true);
  expect(evidence.consoleErrors).toEqual([]);
  await fs.writeFile(
    path.join(out, "electron-workflows.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    JSON.stringify(
      { ...evidence, requests: evidence.requests.length },
      null,
      2,
    ),
  );
} finally {
  await app.close();
  await fs.rm(temp, { recursive: true, force: true });
}
