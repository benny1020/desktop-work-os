export const jiraScopes = [
  { id: "recent", label: "Recent work", clause: "updated >= -30d" },
  { id: "open", label: "Open work", clause: 'statusCategory != Done' },
  { id: "mine", label: "Assigned to me", clause: 'assignee = currentUser() AND statusCategory != Done' },
  { id: "due", label: "Due soon", clause: 'duedate <= endOfDay("+3d") AND statusCategory != Done' },
  { id: "sprint", label: "Active sprint", clause: "sprint in openSprints()" },
];
const literal = value => JSON.stringify(String(value));
export function jiraWorkspaceQuery({ scope = "recent", project = "", search = "" } = {}) {
  const clauses = [jiraScopes.find(item => item.id === scope)?.clause || jiraScopes[0].clause];
  if (project) clauses.push(`project = ${literal(project)}`);
  const query = search.trim();
  if (query) {
    if (/^[A-Z][A-Z0-9_]*-\d+$/i.test(query)) clauses.push(`key = ${literal(query.toUpperCase())}`);
    else {
      // Jira text uses Lucene syntax inside JQL. Treat ordinary search as words;
      // advanced operators remain available in the separate JQL editor.
      const words = query.replace(/[^\p{L}\p{N} _-]/gu, " ").trim();
      if (words) clauses.push(`text ~ ${literal(words)}`);
    }
  }
  return `${clauses.map(clause => `(${clause})`).join(" AND ")} ORDER BY ${scope === "due" ? "duedate ASC, " : ""}updated DESC`;
}
