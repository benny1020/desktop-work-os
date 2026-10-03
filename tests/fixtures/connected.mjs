import { demoSnapshot } from "../../src/lib/demo-review.js";
export const snapshot = {
  ...demoSnapshot({
    id: "381",
    repo: "payment-api",
    title: "PAY-382 Payment retry review",
  }),
};
snapshot.mr = {
  ...snapshot.mr,
  project_id: 42,
  iid: 7,
  id: 99,
  title: "PAY-382 Payment retry review",
  description: "Relates to PAY-382",
  web_url: "https://gitlab.fixture.test/platform/payment-api/-/merge_requests/7",
};
export function fixtureEngine(snapshot) {
  const configs = Object.fromEntries(
    ["jira", "gitlab", "confluence", "claude"].map((s) => [
      s,
      {
        url: `https://${s}.fixture.test`,
        tokenConfigured: true,
        email: "reviewer@example.test",
        model: "claude-fixture",
      },
    ]),
  );
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
      project: { key: "PAY", name: "Payments" },
      assignee: { accountId: "alex", displayName: "Alex Kim" },
      duedate: "2026-10-04",
      comment: { comments: [] },
    },
  };
  const page = {
    id: "p1",
    title: "Payment Retry Policy",
    spaceId: "s1",
    version: { number: 3 },
    body: {
      storage: {
        value:
          "<h2>Retry policy</h2><p>Bound retries to three attempts. Preserve the idempotency key.</p>",
      },
    },
  };
  const calls = [];
  let fail = "";
  return {
    calls,
    configs,
    issue,
    setFailure(v) {
      fail = v;
    },
    async invoke(action, args = {}) {
      calls.push({ action, args });
      if (fail === action)
        throw Error("Fixture service unavailable. Draft retained.");
      if (action === "config.list") return configs;
      if (action === "jira.issues") return { issues: [structuredClone(issue)] };
      if (action === "jira.issue") return structuredClone(issue);
      if (action === "jira.transitions") return [{ id: "31", name: "Done" }];
      if (action === "jira.transition") {
        issue.fields.status.name = "Done";
        return true;
      }
      if (action === "jira.comment") {
        issue.fields.comment.comments.push({
          id: String(Date.now()),
          author: { displayName: "Reviewer" },
          body: { type: "text", text: args.body },
        });
        return true;
      }
      if (action === "jira.editMetadata")
        return {
          fields: {
            priority: {
              allowedValues: [
                { id: "1", name: "High" },
                { id: "2", name: "Medium" },
              ],
            },
          },
        };
      if (action === "jira.boards")
        return { values: [{ id: 10, name: "Payments Scrum" }] };
      if (action === "jira.sprints")
        return {
          values: [
            { id: 24, name: "Sprint 24", state: "active" },
            { id: 25, name: "Sprint 25", state: "future" },
          ],
        };
      if (action === "jira.moveSprint") return true;
      if (action === "jira.assignees")
        return [{ accountId: "daniel", displayName: "Daniel Park" }];
      if (action === "jira.edit") {
        if (Object.hasOwn(args, "accountId"))
          issue.fields.assignee = args.accountId
            ? { accountId: args.accountId, displayName: "Daniel Park" }
            : null;
        if (Object.hasOwn(args, "due")) issue.fields.duedate = args.due;
        return true;
      }
      if (action === "jira.projects")
        return { values: [{ id: "100", key: "PAY", name: "Payments" }] };
      if (action === "jira.issueTypes")
        return { issueTypes: [{ id: "3", name: "Task", subtask: false }] };
      if (action === "jira.create") return { key: "PAY-500", id: "500" };
      if (action === "gitlab.projects")
        return {
          items: [{ id: 42, path_with_namespace: "platform/payment-api" }],
        };
      if (action === "gitlab.mrs")
        return {
          items: [
            {
              ...snapshot.mr,
              author: { name: "Daniel Park" },
              state: "opened",
            },
          ],
        };
      if (action === "gitlab.mrUpdates") return structuredClone({ mr: snapshot.mr, discussions: snapshot.discussions || [] });
      if (action === "gitlab.mr") return structuredClone(snapshot);
      if (action === "gitlab.mrPipelines" || action === "gitlab.pipelines")
        return [{ id: 482, status: "success", ref: "feature/retry" }];
      if (action === "gitlab.pipeline")
        return {
          id: 482,
          ref: "feature/retry",
          status: "success",
          sha: "a".repeat(40),
          jobs: [
            {
              id: 1,
              stage: "test",
              name: "unit-tests",
              status: "success",
              duration: 42,
            },
            {
              id: 2,
              stage: "deploy",
              name: "staging",
              status: "success",
              duration: 18,
            },
          ],
        };
      if (action === "gitlab.code")
        return {
          content: snapshot.files.find((f) => f.path === args.path).content,
        };
      if (action === "gitlab.comment")
        return {
          id: "posted",
          notes: [
            {
              id: 1,
              body: args.body,
              position: { new_path: args.path, new_line: args.line },
              author: { name: "Reviewer" },
            },
          ],
        };
      if (action === "gitlab.approve") return { approved: true };
      if (action === "confluence.spaces")
        return { results: [{ id: "s1", name: "Engineering" }] };
      if (action === "confluence.pages") return { results: [page] };
      if (action === "confluence.search")
        return { results: [{ content: { id: page.id, title: page.title } }] };
      if (action === "confluence.page") return page;
      if (action === "confluence.create")
        return { ...page, id: "p2", title: args.title };
      if (action === "claude.chat")
        return {
          content: [
            {
              type: "text",
              text: "Review idempotency handling and the bounded retry path.",
            },
          ],
        };
      if (action === "claude.review")
        return {
          ...snapshot.demoGuide,
          model: "claude-fixture",
          coverage: { files: 4, totalFiles: 4 },
        };
      throw Error("Unexpected fixture action " + action);
    },
  };
}
export async function installConnected(page) {
  await page.addInitScript(
    ({ source, snapshot }) => {
      window.__fixture = (0, eval)("(" + source + ")")(snapshot);
      window.orbit = { invoke: (...args) => window.__fixture.invoke(...args) };
    },
    { source: fixtureEngine.toString(), snapshot },
  );
  await page.goto("/");
  await page.getByLabel("Workspace data mode").selectOption("connected");
}
