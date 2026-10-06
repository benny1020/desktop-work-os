import test from "node:test";
import assert from "node:assert/strict";
import { jiraWorkspaceQuery } from "../../src/lib/jira-workspace.mjs";

test("Sprint scope has no recent-update cutoff and retains project/search constraints", () => {
  const query = jiraWorkspaceQuery({ scope: "sprint", project: "PAY", search: "pay-382" });
  assert.match(query, /sprint in openSprints\(\)/);
  assert.match(query, /project = "PAY"/);
  assert.match(query, /key = "PAY-382"/);
  assert.doesNotMatch(query, /-30d/);
});
test("Simple search treats punctuation as words and cannot inject JQL operators", () => {
  const query = jiraWorkspaceQuery({ project: 'PAY" OR project = OPS', search: 'retry" OR status = Done' });
  assert.ok(query.includes('project = "PAY\\" OR project = OPS"'));
  assert.ok(query.includes('text ~ "retry  OR status   Done"'));
});
test("Personal and due scopes exclude completed issues and order deadlines first", () => {
  assert.match(jiraWorkspaceQuery({ scope: "mine" }), /assignee = currentUser\(\) AND statusCategory != Done/);
  const due = jiraWorkspaceQuery({ scope: "due" });
  assert.match(due, /duedate <= endOfDay\("\+3d"\) AND statusCategory != Done/);
  assert.match(due, /ORDER BY duedate ASC, updated DESC$/);
});

test("Board scoped sprint leaves membership to the endpoint and intersects personal filters", () => {
  assert.equal(jiraWorkspaceQuery({ scope: "sprint", scopedSprint: true }), "ORDER BY updated DESC");
  const mine = jiraWorkspaceQuery({ scope: "mine", scopedSprint: true, search: "PAY-382" });
  assert.match(mine, /assignee = currentUser\(\)/);
  assert.match(mine, /key = "PAY-382"/);
  assert.doesNotMatch(mine, /openSprints\(\)/);
});
