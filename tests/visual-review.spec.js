import { test, expect } from "@playwright/test";
import { demoSnapshot } from "../src/lib/demo-review.js";
const demo = demoSnapshot({
  id: "391",
  repo: "order-api",
  title: "Fix order status mapping",
});
const nav = (p, name) =>
  p.locator(`nav .nav-item[aria-label="${name}"]`).click();
const openDemo = async (p) => {
  await p.goto("/");
  await p.getByRole("button", { name: /Review changes/ }).click();
  await p.getByRole("button", { name: "File groups", exact: true }).click();
  await p.getByRole("button", { name: "Diff", exact: true }).click();
};
test("Visual review: dependency component opens exact code and separate sequence view", async ({
  page,
}) => {
  await openDemo(page);
  await expect(
    page.getByRole("img", { name: "Dependency flow diagram" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Open component OrderService.ts",
      exact: true,
    })
    .click();
  await expect(page.locator(".visual-code-heading")).toContainText(
    "src/OrderService.ts",
  );
  await expect(page.getByLabel("Component code")).toContainText(
    "StatusMapper.toPublic",
  );
  await page.getByRole("tab", { name: "Sequence", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Sequence diagram" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Inspect sequence step 1:/ }).click();
  await expect(page.locator(".code-provenance")).toContainText(
    "Selected new line",
  );
});
test("Visual review: per-component drafts, source code and posted comments", async ({
  page,
}) => {
  await openDemo(page);
  await page
    .getByRole("button", {
      name: "Open component OrderService.ts",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(page.getByLabel("Component code")).toContainText(
    "export class OrderService",
  );
  await page
    .getByRole("button", { name: "Select source line 7", exact: true })
    .click();
  await page
    .getByLabel("Diagram review comment")
    .fill("Check not-found behavior.");
  await page
    .getByRole("button", {
      name: "Open component StatusMapper.ts",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("");
  await page
    .getByRole("button", {
      name: "Open component OrderService.ts",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Select source line 7", exact: true })
    .click();
  await expect(page.getByLabel("Diagram review comment")).toHaveValue(
    "Check not-found behavior.",
  );
  await page
    .getByRole("button", { name: "Add demo comment", exact: true })
    .click();
  await expect(page.locator(".component-comment")).toContainText(
    "Check not-found behavior.",
  );
  await expect(page.getByLabel("Diagram review comment")).toHaveValue("");
});
test("Visual review: AI reading order jumps to evidence and approval requires explicit action", async ({
  page,
}) => {
  await openDemo(page);
  await page
    .getByRole("button", { name: "Preview AI guide", exact: true })
    .click();
  await expect(page.locator(".guide-summary")).toContainText("주문 응답");
  await page.getByText("Suggested reading order", {exact:true}).click();
  await page.locator(".reading-order button").nth(1).click();
  await expect(page.locator(".visual-code-heading")).toContainText(
    "OrderService.ts",
  );
  await expect(page.locator(".code-provenance")).toContainText(
    "Selected new line 7",
  );
  await page.getByRole("button", { name: "Approve MR", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm approval", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Approve MR", exact: true }),
  ).toBeEnabled();
});
test("Integration scope: browser cannot save tokens; Dooray and Observe remain placeholders", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("API token")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save & test connection", exact: true }),
  ).toBeDisabled();
  await expect(
    page.locator(".deferred-provider").filter({ hasText: "Dooray" }),
  ).toContainText("Menu only");
  await page.getByRole("button", { name: /Confluence Cloud/ }).click();
  await expect(page.getByLabel("Atlassian email")).toBeVisible();
  await page.getByRole("button", { name: /Claude · Anthropic API/ }).click();
  await expect(page.getByLabel("Claude model ID")).toBeVisible();
  await expect(
    page.locator("nav").getByRole("button", { name: "Team", exact: true }),
  ).toHaveCount(0);
  await nav(page, "Observe");
  await expect(
    page.getByText(
      "Mock data · Observe integration will be implemented separately.",
    ),
  ).toBeVisible();
});
async function liveFixture(page, { stale = false } = {}) {
  const snapshot = {
    ...demo,
    mr: {
      ...demo.mr,
      project_id: 42,
      iid: 7,
      id: 99,
      web_url: "https://gitlab.fixture.test/project/-/merge_requests/7",
    },
    files: demo.files.map(({ content, ...f }) => f),
  };
  await page.addInitScript(
    ({ snapshot, contents, stale }) => {
      const configs = Object.fromEntries(
        ["jira", "confluence", "gitlab", "claude"].map((s) => [
          s,
          {
            url: `https://${s}.fixture.test`,
            email: "user@example.test",
            model: "claude-fixture",
            tokenConfigured: true,
            verifiedAt: "2026-10-03",
          },
        ]),
      );
      window.__calls = [];
      window.orbit = {
        invoke: async (action, args = {}) => {
          window.__calls.push({ action, args });
          if (action === "config.list") return configs;
          if (action === "config.save") {
            configs[args.service] = { ...args.config, tokenConfigured: true };
            delete configs[args.service].token;
            return configs[args.service];
          }
          if (action === "config.test")
            return {
              ...configs[args.service],
              verifiedAt: "2026-10-03",
              identity: "Test user",
            };
          if (action === "gitlab.projects")
            return {
              items: [
                {
                  id: 42,
                  path_with_namespace: "platform/order-api",
                  visibility: "private",
                },
              ],
            };
          if (action === "gitlab.mrs")
            return {
              items: [
                { ...snapshot.mr, author: { name: "Daniel" }, state: "opened" },
              ],
            };
          if (action === "gitlab.mr") return snapshot;
          if (action === "gitlab.code")
            return {
              content: contents[args.path],
              path: args.path,
              ref: args.ref,
            };
          if (action === "gitlab.comment") {
            if (stale)
              throw Error(
                "MR changed since you opened it. Refresh before posting. Your draft is retained.",
              );
            return {
              id: "posted",
              notes: [
                {
                  id: 1,
                  body: args.body,
                  author: { name: "Reviewer" },
                  position: { new_path: args.path, new_line: args.line },
                },
              ],
            };
          }
          if (action === "claude.review")
            return {
              ...snapshot.demoGuide,
              model: "claude-fixture",
              headSha: snapshot.mr.diff_refs.head_sha,
            };
          if (action === "confluence.spaces")
            return { results: [{ id: "sp1", name: "Engineering" }] };
          if (action === "confluence.pages")
            return { results: [{ id: "p1", title: "Actual wiki page" }] };
          if (action === "confluence.page")
            return {
              id: "p1",
              title: "Actual wiki page",
              version: { number: 3 },
              body: {
                storage: {
                  value:
                    '<h2>Retry rules</h2><p>Use idempotency keys.</p><img src=x onerror="window.__xss=true"><script>window.__xss=true</script>',
                },
              },
            };
          if (action === "jira.issues")
            return {
              issues: [
                {
                  id: "1",
                  key: "PAY-999",
                  fields: {
                    summary: "Real fixture issue",
                    status: { name: "In Progress" },
                    assignee: { displayName: "Reviewer" },
                  },
                },
              ],
            };
          throw Error("Unexpected fixture action " + action);
        },
      };
    },
    {
      snapshot,
      contents: Object.fromEntries(demo.files.map((f) => [f.path, f.content])),
      stale,
    },
  );
  await page.goto("/");
  await page.getByLabel("Workspace data mode").selectOption("connected");
}
test("Connected MR: fetches commit source; Claude invoked only by explicit generate; comments use selected path and line", async ({
  page,
}) => {
  await liveFixture(page);
  await nav(page, "Code");
  await page.getByRole("button", { name: /Fix order status mapping/ }).click();
  await expect(page.getByText("GitLab · live", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.__calls.some((c) => c.action === "claude.review"),
    ),
  ).toBe(false);
  await page
    .getByRole("button", {
      name: "Open component OrderService.ts",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(page.getByLabel("Component code")).toContainText(
    "export class OrderService",
  );
  await page
    .getByRole("button", { name: "Select source line 7", exact: true })
    .click();
  await page
    .getByLabel("Diagram review comment")
    .fill("Please verify empty orders.");
  await page
    .getByRole("button", { name: "Post to GitLab", exact: true })
    .click();
  await expect(page.locator(".component-comment")).toContainText(
    "Please verify empty orders.",
  );
  const post = await page.evaluate(() =>
    window.__calls.find((c) => c.action === "gitlab.comment"),
  );
  expect(post.args.path).toBe("src/OrderService.ts");
  expect(post.args.line).toBe(7);
  expect(post.args.headSha).toBe(demo.mr.diff_refs.head_sha);
  await page
    .getByRole("button", { name: "Generate AI guide", exact: true })
    .click();
  await expect(page.locator(".guide-summary")).toBeVisible();
  expect(
    await page.evaluate(
      () => window.__calls.filter((c) => c.action === "claude.review").length,
    ),
  ).toBe(1);
});
test("Connected review: stale MR keeps draft and shows failure without pretending to post", async ({
  page,
}) => {
  await liveFixture(page, { stale: true });
  await nav(page, "Code");
  await page.getByRole("button", { name: /Fix order status mapping/ }).click();
  await page
    .getByLabel("Diagram review comment")
    .fill("Keep this draft on failure.");
  await page
    .getByRole("button", { name: "Post to GitLab", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("MR changed");
  await expect(page.getByLabel("Diagram review comment")).toHaveValue(
    "Keep this draft on failure.",
  );
  await expect(page.locator(".component-comment")).toHaveCount(0);
});
test("Connected wiki and Jira show server data with no sample fallback; remote HTML is sanitized", async ({
  page,
}) => {
  await liveFixture(page);
  await nav(page, "Projects");
  await expect(
    page.getByRole("button", { name: "PAY-999", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "PAY-382", exact: true }),
  ).toHaveCount(0);
  await nav(page, "Docs");
  await page
    .getByRole("button", { name: "Actual wiki page", exact: true })
    .click();
  await expect(page.locator(".remote-document")).toContainText(
    "Use idempotency keys.",
  );
  await expect(
    page.locator(".remote-document img,.remote-document script"),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});
test("Connected settings: separate URLs and tokens flow through bridge, never localStorage", async ({
  page,
}) => {
  await liveFixture(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Service URL").fill("https://gitlab.company.test");
  await page.getByLabel("API token").fill("ui-fixture-secret");
  await page
    .getByRole("button", { name: "Save & test connection", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Connection verified" }),
  ).toBeVisible();
  const save = await page.evaluate(() =>
    window.__calls.find((c) => c.action === "config.save"),
  );
  expect(save.args.service).toBe("gitlab");
  expect(save.args.config.url).toBe("https://gitlab.company.test");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "ui-fixture-secret",
  );
  await expect(page.getByLabel("API token")).toHaveValue("");
});
