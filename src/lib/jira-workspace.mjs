export const jiraScopes = [
  { id: "recent", label: "Recent work", clause: "updated >= -30d" },
  { id: "all", label: "All work", clause: "" },
  { id: "open", label: "Open work", clause: 'statusCategory != Done' },
  { id: "mine", label: "Assigned to me", clause: 'assignee = currentUser() AND statusCategory != Done' },
  { id: "due", label: "Due soon", clause: 'duedate <= endOfDay("+3d") AND statusCategory != Done' },
  { id: "sprint", label: "Active sprint", clause: "sprint in openSprints()" },
];
const literal = value => JSON.stringify(String(value));
export const jiraStatusChoices = [
  { id: "all", label: "Any status", clause: "" },
  { id: "open", label: "Open", clause: "statusCategory != Done" },
  { id: "todo", label: "To do", clause: 'statusCategory = "To Do"' },
  { id: "progress", label: "In progress", clause: 'statusCategory = "In Progress"' },
  { id: "done", label: "Done", clause: "statusCategory = Done" },
];
export const jiraAssigneeChoices = [
  { id: "all", label: "Anyone", clause: "" },
  { id: "me", label: "Assigned to me", clause: "assignee = currentUser()" },
  { id: "unassigned", label: "Unassigned", clause: "assignee IS EMPTY" },
];
export const jiraDeadlineChoices = [
  { id: "all", label: "Any deadline", clause: "" },
  { id: "overdue", label: "Overdue", clause: "duedate < startOfDay()" },
  { id: "today", label: "Due today", clause: "duedate >= startOfDay() AND duedate <= endOfDay()" },
  { id: "soon", label: "Due within 3 days", clause: 'duedate <= endOfDay("+3d")' },
  { id: "week", label: "Due this week", clause: "duedate >= startOfWeek() AND duedate <= endOfWeek()" },
  { id: "none", label: "No deadline", clause: "duedate IS EMPTY" },
];
export function jiraFilterDefaults(scope) {
  return { status: ["open", "mine", "due"].includes(scope) ? "open" : "all",
    assignee: scope === "mine" ? "me" : "all", deadline: scope === "due" ? "soon" : "all" };
}
export function jiraWorkspaceQuery({ scope = "recent", project = "", search = "", scopedSprint = false,
  status = "", assignee = "", deadline = "" } = {}) {
  const defaults = jiraFilterDefaults(scope);
  const clauses = [];
  const query = search.trim();
  const exactKey = /^[A-Z][A-Z0-9_]*-\d+$/i.test(query);
  if (scope === "recent" && !exactKey) clauses.push("updated >= -30d");
  if (scope === "sprint" && !scopedSprint) clauses.push("sprint in openSprints()");
  const values = [[jiraAssigneeChoices, assignee || defaults.assignee], [jiraStatusChoices, status || defaults.status],
    [jiraDeadlineChoices, deadline || defaults.deadline]];
  // Keep preset clauses grouped, while allowing each visual filter to override its dimension.
  const dimensions = values.map(([choices, id]) => choices.find(item => item.id === id)?.clause).filter(Boolean);
  if (dimensions.length) clauses.push(dimensions.join(" AND "));
  if (project) clauses.push(`project = ${literal(project)}`);
  if (query) {
    if (exactKey) clauses.push(`key = ${literal(query.toUpperCase())}`);
    else {
      // Treat ordinary search as words, never as query-language operators.
      const words = query.replace(/[^\p{L}\p{N} _-]/gu, " ").trim();
      if (words) clauses.push(`text ~ ${literal(words)}`);
    }
  }
  const dueFirst = (deadline || defaults.deadline) !== "all" && (deadline || defaults.deadline) !== "none";
  return `${clauses.length ? clauses.map(clause => `(${clause})`).join(" AND ") + " " : ""}ORDER BY ${dueFirst ? "duedate ASC, " : ""}updated DESC`;
}
export const nextAgilePage = data => data?.isLast === false && data.values?.length
  ? Number(data.startAt || 0) + Number(data.maxResults || data.values.length) : null;
export const requiredTransitionFields = transition => Object.values(transition?.fields || {}).filter(field => field.required).map(field => field.name || "Required field");
